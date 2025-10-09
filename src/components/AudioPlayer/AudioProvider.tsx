import React, { createContext, useContext, useRef, useState, useEffect, useCallback } from 'react';
import { useAppStore } from '@/store';
import { libraryService } from '@/services/libraryService';

interface AudioContextType {
  audioRef: React.RefObject<HTMLAudioElement>;
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

export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const { audioPlayer, setAudioPlayerState, podcastMode, getAudioTime, saveAudioTime } = useAppStore();
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(1);
  const [isMuted, setMutedState] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const mediaSourceRef = useRef<MediaElementAudioSourceNode | null>(null);

  // Setup audio context and analyzer
  useEffect(() => {
    if (!audioRef.current) return;
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (!analyzerRef.current) {
      analyzerRef.current = audioContextRef.current.createAnalyser();
      analyzerRef.current.fftSize = 256;
      analyzerRef.current.smoothingTimeConstant = 0.8;
    }
    if (!mediaSourceRef.current) {
      mediaSourceRef.current = audioContextRef.current.createMediaElementSource(audioRef.current);
    }
    // Connect: mediaSource -> analyzer -> destination
    try {
      mediaSourceRef.current.disconnect();
      analyzerRef.current.disconnect();
    } catch {}
    mediaSourceRef.current.connect(analyzerRef.current);
    analyzerRef.current.connect(audioContextRef.current.destination);
  }, [audioRef.current]);

  // Provide a function to get frequency data
  const getFrequencyData = useCallback(() => {
    if (!analyzerRef.current) return null;
    const bufferLength = analyzerRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyzerRef.current.getByteFrequencyData(dataArray);
    return dataArray;
  }, []);

  // Sync state from store
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = audioPlayer.volume;
      audioRef.current.muted = audioPlayer.isMuted;
    }
    setVolumeState(audioPlayer.volume);
    setMutedState(audioPlayer.isMuted);
  }, [audioPlayer.volume, audioPlayer.isMuted]);

  // Load new audio source when currentAudio changes
  useEffect(() => {
    if (audioRef.current && audioPlayer.currentAudio) {
      audioRef.current.src = libraryService.getPhotoFileUrl(
        audioPlayer.currentAudio.id,
        audioPlayer.currentAudio.ext,
        audioPlayer.currentAudio.name
      );
      audioRef.current.load();
      setCurrentTime(0);
      setDuration(0);
      
      // Check if podcast mode is enabled and restore saved time
      if (podcastMode.enabled && audioPlayer.currentAudio) {
        const savedTime = getAudioTime(audioPlayer.currentAudio.id);
        if (savedTime > 0) {
          // Set the audio element time after it loads
          const handleLoadedMetadata = () => {
            if (savedTime < audioRef.current!.duration) {
              audioRef.current!.currentTime = savedTime;
              setCurrentTime(savedTime);
              setAudioPlayerState({ currentTime: savedTime });
            }
            audioRef.current!.removeEventListener('loadedmetadata', handleLoadedMetadata);
          };
          audioRef.current.addEventListener('loadedmetadata', handleLoadedMetadata);
        }
      }
    }
  }, [audioPlayer.currentAudio, podcastMode.enabled, getAudioTime, setAudioPlayerState]);

  // Play/pause from store
  useEffect(() => {
    if (!audioRef.current) return;
    if (audioPlayer.isPlaying) {
      audioRef.current.play();
    } else {
      audioRef.current.pause();
    }
  }, [audioPlayer.isPlaying]);

  // Audio element event handlers
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      setAudioPlayerState({ currentTime: audio.currentTime });
      
      // Save time for podcast mode if enabled
      if (podcastMode.enabled && audioPlayer.currentAudio) {
        saveAudioTime(audioPlayer.currentAudio.id, audio.currentTime);
      }
    };
    const onLoadedMetadata = () => {
      setDuration(audio.duration);
    };
    const onEnded = () => {
      setIsPlaying(false);
      setAudioPlayerState({ isPlaying: false });
    };
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);
    };
  }, [setAudioPlayerState, podcastMode.enabled, audioPlayer.currentAudio, saveAudioTime]);

  // Controls
  const play = useCallback(() => {
    setIsPlaying(true);
    setAudioPlayerState({ isPlaying: true });
  }, [setAudioPlayerState]);
  const pause = useCallback(() => {
    setIsPlaying(false);
    setAudioPlayerState({ isPlaying: false });
  }, [setAudioPlayerState]);
  const seek = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
      setAudioPlayerState({ currentTime: time });
    }
  }, [setAudioPlayerState]);
  const setVolume = useCallback((v: number) => {
    if (audioRef.current) audioRef.current.volume = v;
    setVolumeState(v);
    setAudioPlayerState({ volume: v });
  }, [setAudioPlayerState]);
  const setMuted = useCallback((m: boolean) => {
    if (audioRef.current) audioRef.current.muted = m;
    setMutedState(m);
    setAudioPlayerState({ isMuted: m });
  }, [setAudioPlayerState]);

  return (
    <AudioContext.Provider value={{ audioRef, isPlaying, currentTime, duration, volume, isMuted, play, pause, seek, setVolume, setMuted, analyzerNode: analyzerRef.current, getFrequencyData }}>
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