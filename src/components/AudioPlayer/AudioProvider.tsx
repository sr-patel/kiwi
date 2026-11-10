import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '@/store';
import { libraryService } from '@/services/libraryService';

interface AudioContextType {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  setVolume: (v: number) => void;
  setMuted: (m: boolean) => void;
  analyzerNode: AnalyserNode | null;
  getFrequencyData: () => Uint8Array | null;
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

/**
 * How often podcast progress is written back to the store.
 *
 * `timeupdate` fires roughly four times a second. Persisting on every tick
 * meant a store write plus a synchronous `localStorage` write four times a
 * second, and — because most components subscribed to the whole store — a
 * full application re-render for every one of them.
 */
const PROGRESS_SAVE_INTERVAL_MS = 5_000;

const pickShuffledIndex = (length: number, currentIndex: number): number => {
  if (length <= 1) return 0;
  let next = currentIndex;
  while (next === currentIndex) next = Math.floor(Math.random() * length);
  return next;
};

export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const audioRef = useRef<HTMLAudioElement>(null);

  const currentAudio = useAppStore((state) => state.audioPlayer.currentAudio);
  const playlist = useAppStore((state) => state.audioPlayer.playlist);
  const currentIndex = useAppStore((state) => state.audioPlayer.currentIndex);
  const isPlayingRequested = useAppStore((state) => state.audioPlayer.isPlaying);
  const volume = useAppStore((state) => state.audioPlayer.volume);
  const isMuted = useAppStore((state) => state.audioPlayer.isMuted);
  const isLooped = useAppStore((state) => state.audioPlayer.isLooped);
  const isShuffled = useAppStore((state) => state.audioPlayer.isShuffled);
  const podcastEnabled = useAppStore((state) => state.podcastMode.enabled);
  const setAudioPlayerState = useAppStore((state) => state.setAudioPlayerState);
  const saveAudioTime = useAppStore((state) => state.saveAudioTime);
  const getAudioTime = useAppStore((state) => state.getAudioTime);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const mediaSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const frequencyBufferRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const lastSavedAtRef = useRef(0);
  const currentAudioIdRef = useRef<string | null>(null);

  // Setup audio context and analyzer once.
  useEffect(() => {
    const element = audioRef.current;
    if (!element) return;

    const AudioContextCtor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (AudioContextCtor) {
      try {
        const context = new AudioContextCtor();
        const analyzer = context.createAnalyser();
        analyzer.fftSize = 256;
        analyzer.smoothingTimeConstant = 0.8;
        const source = context.createMediaElementSource(element);
        source.connect(analyzer);
        analyzer.connect(context.destination);
        audioContextRef.current = context;
        analyzerRef.current = analyzer;
        mediaSourceRef.current = source;
      } catch (error) {
        // The visualizer is optional; playback still works without it.
        console.warn('Audio visualizer unavailable', error);
      }
    }

    return () => {
      try {
        mediaSourceRef.current?.disconnect();
        analyzerRef.current?.disconnect();
      } catch {
        // Already torn down.
      }
      void audioContextRef.current?.close().catch(() => undefined);
      audioContextRef.current = null;
      analyzerRef.current = null;
      mediaSourceRef.current = null;
      frequencyBufferRef.current = null;
    };
  }, []);

  // Reuse one buffer; allocating per animation frame caused constant GC churn.
  const getFrequencyData = useCallback(() => {
    const analyzer = analyzerRef.current;
    if (!analyzer) return null;
    const length = analyzer.frequencyBinCount;
    let buffer = frequencyBufferRef.current;
    if (!buffer || buffer.length !== length) {
      buffer = new Uint8Array(length);
      frequencyBufferRef.current = buffer;
    }
    analyzer.getByteFrequencyData(buffer);
    return buffer;
  }, []);

  // Apply volume/mute preferences to the element.
  useEffect(() => {
    const element = audioRef.current;
    if (!element) return;
    element.volume = volume;
    element.muted = isMuted;
  }, [volume, isMuted]);

  // Load a new source when the track changes, saving the outgoing position.
  useEffect(() => {
    const element = audioRef.current;
    if (!element) return;

    const previousId = currentAudioIdRef.current;
    if (previousId && previousId !== currentAudio?.id && podcastEnabled) {
      saveAudioTime(previousId, element.currentTime);
    }
    currentAudioIdRef.current = currentAudio?.id ?? null;
    lastSavedAtRef.current = 0;

    if (!currentAudio) {
      element.removeAttribute('src');
      element.load();
      setCurrentTime(0);
      setDuration(0);
      return;
    }

    element.src = libraryService.getPhotoFileUrl(currentAudio.id, currentAudio.ext, currentAudio.name);
    element.load();
    setCurrentTime(0);
    setDuration(0);

    if (!podcastEnabled) return;
    const savedTime = getAudioTime(currentAudio.id);
    if (savedTime <= 0) return;

    const restore = () => {
      if (Number.isFinite(element.duration) && savedTime < element.duration) {
        element.currentTime = savedTime;
        setCurrentTime(savedTime);
      }
      element.removeEventListener('loadedmetadata', restore);
    };
    element.addEventListener('loadedmetadata', restore);
    return () => element.removeEventListener('loadedmetadata', restore);
  }, [currentAudio, podcastEnabled, getAudioTime, saveAudioTime]);

  // Mirror requested play/pause onto the element.
  useEffect(() => {
    const element = audioRef.current;
    if (!element) return;
    if (!isPlayingRequested) {
      element.pause();
      setIsPlaying(false);
      return;
    }
    if (!element.getAttribute('src')) return;

    // Autoplay policies can leave the context suspended, which would mute
    // playback now that the element routes through WebAudio.
    void audioContextRef.current?.resume().catch(() => undefined);
    element
      .play()
      .then(() => setIsPlaying(true))
      .catch(() => setIsPlaying(false));
  }, [isPlayingRequested, currentAudio]);

  // Element events.
  useEffect(() => {
    const element = audioRef.current;
    if (!element) return;

    const onTimeUpdate = () => {
      setCurrentTime(element.currentTime);
      if (!podcastEnabled) return;
      const id = currentAudioIdRef.current;
      if (!id) return;
      const now = Date.now();
      if (now - lastSavedAtRef.current < PROGRESS_SAVE_INTERVAL_MS) return;
      lastSavedAtRef.current = now;
      saveAudioTime(id, element.currentTime);
    };

    const onLoadedMetadata = () => setDuration(element.duration);

    const onEnded = () => {
      if (isLooped) {
        element.currentTime = 0;
        void element.play().catch(() => setIsPlaying(false));
        return;
      }
      if (playlist.length > 1) {
        const nextIndex = isShuffled
          ? pickShuffledIndex(playlist.length, currentIndex)
          : (currentIndex + 1) % playlist.length;
        setAudioPlayerState({ currentAudio: playlist[nextIndex], currentIndex: nextIndex });
        return;
      }
      setIsPlaying(false);
      setAudioPlayerState({ isPlaying: false });
    };

    element.addEventListener('timeupdate', onTimeUpdate);
    element.addEventListener('loadedmetadata', onLoadedMetadata);
    element.addEventListener('ended', onEnded);
    return () => {
      element.removeEventListener('timeupdate', onTimeUpdate);
      element.removeEventListener('loadedmetadata', onLoadedMetadata);
      element.removeEventListener('ended', onEnded);
    };
  }, [currentIndex, isLooped, isShuffled, playlist, podcastEnabled, saveAudioTime, setAudioPlayerState]);

  // Flush progress when the tab goes away.
  useEffect(() => {
    const flush = () => {
      const element = audioRef.current;
      const id = currentAudioIdRef.current;
      if (!element || !id || !podcastEnabled) return;
      saveAudioTime(id, element.currentTime);
    };
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('beforeunload', flush);
      flush();
    };
  }, [podcastEnabled, saveAudioTime]);

  const play = useCallback(() => setAudioPlayerState({ isPlaying: true }), [setAudioPlayerState]);

  const pause = useCallback(() => setAudioPlayerState({ isPlaying: false }), [setAudioPlayerState]);

  const seek = useCallback(
    (time: number) => {
      const element = audioRef.current;
      if (element) element.currentTime = time;
      setCurrentTime(time);
      setAudioPlayerState({ currentTime: time });
    },
    [setAudioPlayerState],
  );

  const setVolume = useCallback(
    (nextVolume: number) => setAudioPlayerState({ volume: nextVolume }),
    [setAudioPlayerState],
  );

  const setMuted = useCallback(
    (nextMuted: boolean) => setAudioPlayerState({ isMuted: nextMuted }),
    [setAudioPlayerState],
  );

  const value = useMemo<AudioContextType>(
    () => ({
      audioRef,
      isPlaying,
      currentTime,
      duration,
      volume,
      isMuted,
      play,
      pause,
      seek,
      setVolume,
      setMuted,
      analyzerNode: analyzerRef.current,
      getFrequencyData,
    }),
    [
      currentTime,
      duration,
      getFrequencyData,
      isMuted,
      isPlaying,
      pause,
      play,
      seek,
      setMuted,
      setVolume,
      volume,
    ],
  );

  return (
    <AudioContext.Provider value={value}>
      {children}
      <audio ref={audioRef} hidden />
    </AudioContext.Provider>
  );
};

export function useAudio() {
  const ctx = useContext(AudioContext);
  if (!ctx) throw new Error('useAudio must be used within AudioProvider');
  return ctx;
}
