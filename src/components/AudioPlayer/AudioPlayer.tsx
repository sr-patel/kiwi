import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useAppStore } from '@/store';
import { libraryService } from '@/services/libraryService';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Shuffle,
  Repeat,
  X,
  Music,
  Clock,
  List,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import {
  getAccentColor,
  getAccentText,
  getAccentHover,
  getAccentSelected,
  getAccentHex,
} from '@/utils/accentColors';
import { useShallow } from 'zustand/react/shallow';
import './AudioPlayer.css';
import { useAudio } from './AudioProvider';

/** Two-digit hex alpha suffix for a 0..1 opacity value. */
const alphaSuffix = (opacity: number): string =>
  Math.round(Math.max(0, Math.min(1, opacity)) * 255)
    .toString(16)
    .padStart(2, '0');

interface AudioPlayerProps {
  isOpen: boolean;
  onClose: () => void;
  currentAudio?: any;
  playlist?: any[];
  onNext?: () => void;
  onPrevious?: () => void;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  isOpen,
  onClose,
  currentAudio,
  playlist = [],
  onNext,
  onPrevious,
}) => {
  const {
    accentColor,
    setMiniPlayer,
    isMiniPlayer,
    visualizerSettings,
    setVisualizerSettings,
    isShuffled,
    isLooped,
    setAudioPlayerState,
  } = useAppStore(
    useShallow((state) => ({
      accentColor: state.accentColor,
      setMiniPlayer: state.setMiniPlayer,
      isMiniPlayer: state.isMiniPlayer,
      visualizerSettings: state.visualizerSettings,
      setVisualizerSettings: state.setVisualizerSettings,
      isShuffled: state.audioPlayer.isShuffled,
      isLooped: state.audioPlayer.isLooped,
      setAudioPlayerState: state.setAudioPlayerState,
    })),
  );

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const smoothedDataRef = useRef<number[]>([]);

  const {
    isPlaying,
    currentTime,
    duration,
    play,
    pause,
    seek,
    setVolume,
    setMuted,
    volume,
    isMuted,
    getFrequencyData,
  } = useAudio();

  // The provider owns the media element; a track reports no duration until it loads.
  const isLoading = Boolean(currentAudio) && duration === 0;

  const [showPlaylist, setShowPlaylist] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showVisSettings, setShowVisSettings] = useState(false);

  // Draw visualizer with improved design
  const drawVisualizer = useCallback(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const dataArray = getFrequencyData?.() || new Uint8Array(visualizerSettings.visBarCount);

    if (smoothedDataRef.current.length !== visualizerSettings.visBarCount) {
      smoothedDataRef.current = new Array(visualizerSettings.visBarCount).fill(0);
    }
    const smoothedData = smoothedDataRef.current;
    for (let i = 0; i < dataArray.length; i++) {
      const raw = dataArray[i] || 0;
      smoothedData[i % visualizerSettings.visBarCount] =
        smoothedData[i % visualizerSettings.visBarCount] * visualizerSettings.visSmoothing +
        raw * (1 - visualizerSettings.visSmoothing);
    }

    // Draw styled bars using settings
    if (visualizerSettings.visType === 'Bars') {
      const barCount = visualizerSettings.visBarCount;
      const barWidth = canvas.width / barCount;
      let x = 0;
      const accent = getAccentHex(accentColor);
      // One gradient and one shadow state per frame. This used to create a
      // gradient and set `shadowBlur` per bar, wrapped in save/restore, up to
      // 96 times per frame at 60fps.
      const barGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      barGradient.addColorStop(0, accent + alphaSuffix(visualizerSettings.visOpacity));
      barGradient.addColorStop(0.7, accent + alphaSuffix(visualizerSettings.visOpacity * 0.53));
      barGradient.addColorStop(1, accent + '00');
      ctx.save();
      ctx.fillStyle = barGradient;
      if (visualizerSettings.visGlow > 0) {
        ctx.shadowColor = accent + alphaSuffix(visualizerSettings.visOpacity * 0.53);
        ctx.shadowBlur = visualizerSettings.visGlow;
      }
      for (let i = 0; i < barCount; i++) {
        const value = smoothedData[i] || 0;
        const height = (value / 255) * canvas.height * 0.8;
        // Rounded corners
        const barX = x + barWidth * 0.1;
        const barW = barWidth * 0.8;
        const radius = barW * visualizerSettings.visBarRound;
        ctx.beginPath();
        ctx.moveTo(barX + radius, canvas.height - height);
        ctx.lineTo(barX + barW - radius, canvas.height - height);
        ctx.quadraticCurveTo(
          barX + barW,
          canvas.height - height,
          barX + barW,
          canvas.height - height + radius,
        );
        ctx.lineTo(barX + barW, canvas.height);
        ctx.lineTo(barX, canvas.height);
        ctx.lineTo(barX, canvas.height - height + radius);
        ctx.quadraticCurveTo(barX, canvas.height - height, barX + radius, canvas.height - height);
        ctx.closePath();
        ctx.fill();
        x += barWidth;
      }
      ctx.restore();
    } else if (visualizerSettings.visType === 'Waveform') {
      // Draw a smooth waveform line
      const barCount = visualizerSettings.visBarCount;
      const barWidth = canvas.width / (barCount - 1);
      const accent = getAccentHex(accentColor);
      ctx.save();
      ctx.strokeStyle =
        accent +
        Math.floor(visualizerSettings.visOpacity * 255)
          .toString(16)
          .padStart(2, '0');
      ctx.lineWidth = 4;
      ctx.shadowColor =
        accent +
        Math.floor(visualizerSettings.visOpacity * 0.53 * 255)
          .toString(16)
          .padStart(2, '0');
      ctx.shadowBlur = visualizerSettings.visGlow;
      ctx.beginPath();
      for (let i = 0; i < barCount; i++) {
        const value = smoothedData[i] || 0;
        const height = (value / 255) * canvas.height * 0.7;
        const x = i * barWidth;
        const y = canvas.height - height - 20;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();
    } else if (visualizerSettings.visType === 'Mirror Bars') {
      // Draw bars from both top and bottom
      const barCount = visualizerSettings.visBarCount;
      const barWidth = canvas.width / barCount;
      let x = 0;
      const accent = getAccentHex(accentColor);
      const barGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      barGradient.addColorStop(0, accent + alphaSuffix(visualizerSettings.visOpacity));
      barGradient.addColorStop(1, accent + '00');
      ctx.save();
      ctx.fillStyle = barGradient;
      if (visualizerSettings.visGlow > 0) {
        ctx.shadowColor = accent + alphaSuffix(visualizerSettings.visOpacity * 0.53);
        ctx.shadowBlur = visualizerSettings.visGlow;
      }
      for (let i = 0; i < barCount; i++) {
        const value = smoothedData[i] || 0;
        const height = (value / 255) * canvas.height * 0.4;
        const barX = x + barWidth * 0.1;
        const barW = barWidth * 0.8;
        const radius = barW * visualizerSettings.visBarRound;
        // Top bars
        ctx.beginPath();
        ctx.moveTo(barX + radius, height);
        ctx.lineTo(barX + barW - radius, height);
        ctx.quadraticCurveTo(barX + barW, height, barX + barW, height - radius);
        ctx.lineTo(barX + barW, 0);
        ctx.lineTo(barX, 0);
        ctx.lineTo(barX, height - radius);
        ctx.quadraticCurveTo(barX, height, barX + radius, height);
        ctx.closePath();
        ctx.fill();
        // Bottom bars
        ctx.beginPath();
        ctx.moveTo(barX + radius, canvas.height - height);
        ctx.lineTo(barX + barW - radius, canvas.height - height);
        ctx.quadraticCurveTo(
          barX + barW,
          canvas.height - height,
          barX + barW,
          canvas.height - height + radius,
        );
        ctx.lineTo(barX + barW, canvas.height);
        ctx.lineTo(barX, canvas.height);
        ctx.lineTo(barX, canvas.height - height + radius);
        ctx.quadraticCurveTo(barX, canvas.height - height, barX + radius, canvas.height - height);
        ctx.closePath();
        ctx.fill();
        x += barWidth;
      }
      ctx.restore();
    }

    animationRef.current = requestAnimationFrame(drawVisualizer);
  }, [accentColor, visualizerSettings, smoothedDataRef]);

  // Playback is owned by `AudioProvider`, which renders and controls the single
  // <audio> element. This component used to register a second set of listeners
  // on an `audioRef` that was never attached to any element, and also created a
  // detached `new Audio()` per track that was never played and never released.

  // Start/stop the visualizer with the player and tab visibility. The loop
  // used to keep redrawing a full-screen canvas while the tab was hidden.
  useEffect(() => {
    const stop = () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };

    const start = () => {
      if (animationRef.current === null && canvasRef.current) drawVisualizer();
    };

    if (isOpen && !document.hidden) start();
    else stop();

    const onVisibilityChange = () => {
      if (document.hidden) stop();
      else if (isOpen) start();
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      stop();
    };
  }, [isOpen, drawVisualizer]);

  // Format time
  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // For seek bar, implement onClick handler:
  const handleSeekBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * duration;
    seek(newTime);
  };

  if (!isOpen || isMiniPlayer) return null;

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div
        className={`bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-3xl shadow-2xl relative overflow-hidden transition-all duration-300 ${
          isFullscreen ? 'w-full h-full max-w-none' : 'w-full max-w-screen-2xl'
        }`}
      >
        {/* Background visualizer */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full opacity-70 pointer-events-none z-10"
          width={1200}
          height={800}
        />

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-gray-900/60 via-transparent to-gray-900/20 pointer-events-none z-[15]" />

        {/* Header */}
        <div className="relative z-20 flex items-center justify-between p-12 border-b border-gray-700/50">
          <div className="flex items-center gap-4">
            <div
              className={`p-3 bg-gradient-to-br rounded-xl`}
              style={{
                background: `linear-gradient(135deg, ${getAccentHex(accentColor)}, ${getAccentHex(accentColor)}CC)`,
              }}
            >
              <Music className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Audio Player</h2>
              <p className="text-sm text-gray-400">
                {playlist.length} track{playlist.length !== 1 ? 's' : ''} in playlist
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowPlaylist(!showPlaylist)}
              className={`p-3 rounded-xl transition-all duration-200 ${
                showPlaylist
                  ? 'text-white'
                  : 'bg-gray-700/50 text-gray-400 hover:bg-gray-700 hover:text-white'
              }`}
              style={{
                backgroundColor: showPlaylist ? `${getAccentHex(accentColor)}20` : undefined,
              }}
            >
              <List className="w-6 h-6" />
            </button>

            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-3 rounded-xl bg-gray-700/50 text-gray-400 hover:bg-gray-700 hover:text-white transition-all duration-200"
            >
              {isFullscreen ? <Minimize2 className="w-6 h-6" /> : <Maximize2 className="w-6 h-6" />}
            </button>

            <button
              onClick={() => setShowVisSettings((v) => !v)}
              className="p-3 rounded-xl bg-gray-700/50 text-gray-400 hover:bg-gray-700 hover:text-white transition-all duration-200"
              title="Visualizer Settings"
            >
              <svg
                width="24"
                height="24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-6 h-6"
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 8 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 5 15.4a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 8a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 8 5.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09c0 .66.42 1.24 1 1.51a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 8c.13.21.22.45.22.7V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09c-.25 0-.49.09-.7.22z" />
              </svg>
            </button>

            <button
              onClick={() => setMiniPlayer(true)}
              className="p-3 rounded-xl bg-gray-700/50 text-gray-400 hover:bg-blue-500 hover:text-white transition-all duration-200"
              title="Pop Out Mini Player"
            >
              <svg
                width="24"
                height="24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-6 h-6"
              >
                <path d="M15 3h6v6" />
                <path d="M10 14L21 3" />
                <rect x="3" y="9" width="13" height="13" rx="2" />
              </svg>
            </button>

            <button
              onClick={onClose}
              className="p-3 rounded-xl bg-gray-700/50 text-gray-400 hover:bg-red-500 hover:text-white transition-all duration-200"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="relative z-20 p-12">
          {/* Track info */}
          <div className="text-center mb-10">
            {isLoading ? (
              <div className="flex items-center justify-center gap-4 text-gray-400">
                <div
                  className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
                  style={{ borderColor: `${getAccentHex(accentColor)} transparent transparent` }}
                />
                <span className="text-lg">Loading audio...</span>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Album art placeholder */}
                <div
                  className="mx-auto w-32 h-32 bg-gradient-to-br rounded-2xl flex items-center justify-center border border-gray-700/50"
                  style={{
                    background: `linear-gradient(135deg, ${getAccentHex(accentColor)}20, ${getAccentHex(accentColor)}10)`,
                  }}
                >
                  <Music className="w-12 h-12" style={{ color: getAccentHex(accentColor) }} />
                </div>

                <div className="max-w-4xl mx-auto">
                  <h3 className="text-2xl font-bold text-white mb-3 line-clamp-2">
                    {currentAudio?.name || 'Unknown Track'}
                  </h3>
                  <div className="flex items-center justify-center gap-6 text-sm text-gray-400">
                    <span className="flex items-center gap-2">
                      <Clock className="w-5 h-5" />
                      {duration > 0 ? formatTime(duration) : '--:--'}
                    </span>
                    <span className="flex items-center gap-2">
                      <Music className="w-5 h-5" />
                      {currentAudio?.ext?.toUpperCase() || 'AUDIO'}
                    </span>
                    {currentAudio?.size && <span>{libraryService.formatFileSize(currentAudio.size)}</span>}
                  </div>
                  {duration === 0 && !isLoading && (
                    <p className="text-sm text-yellow-400 mt-3">
                      Duration unavailable - audio can still be played
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Progress bar */}
          <div className="mb-10 max-w-4xl mx-auto">
            <div
              className="w-full h-4 bg-gray-700/50 rounded-full cursor-pointer relative group"
              onClick={handleSeekBarClick}
            >
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  background: `linear-gradient(to right, ${getAccentHex(accentColor)}20, ${getAccentHex(accentColor)}10)`,
                }}
              />
              <div
                className="h-full rounded-full transition-all duration-100 relative overflow-hidden"
                style={{
                  width: `${duration && duration > 0 ? (currentTime / duration) * 100 : 0}%`,
                }}
              >
                <div
                  className="absolute inset-0"
                  style={{
                    background: `linear-gradient(to right, ${getAccentHex(accentColor)}, ${getAccentHex(accentColor)}CC)`,
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
              </div>

              {/* Progress thumb */}
              <div
                className="absolute top-1/2 -translate-y-1/2 w-5 h-5 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                style={{
                  left: `${duration && duration > 0 ? (currentTime / duration) * 100 : 0}%`,
                  transform: 'translate(-50%, -50%)',
                }}
              />
            </div>

            <div className="flex justify-between text-sm text-gray-400 mt-4">
              <span>{formatTime(currentTime)}</span>
              <span>{duration > 0 ? formatTime(duration) : '--:--'}</span>
            </div>
          </div>

          {/* Controls */}
          <div className="space-y-8">
            {/* Main controls */}
            <div className="flex items-center justify-center gap-8">
              <button
                onClick={() => {
                  setAudioPlayerState({ isShuffled: !isShuffled });
                }}
                className={`p-4 rounded-xl transition-all duration-200 ${
                  isShuffled
                    ? 'text-white'
                    : 'bg-gray-700/50 text-gray-400 hover:bg-gray-700 hover:text-white'
                }`}
                style={{
                  backgroundColor: isShuffled ? `${getAccentHex(accentColor)}20` : undefined,
                }}
              >
                <Shuffle className="w-7 h-7" />
              </button>

              <button
                onClick={onPrevious}
                className="p-5 rounded-xl bg-gray-700/50 hover:bg-gray-700 transition-all duration-200 group"
              >
                <SkipBack className="w-8 h-8 text-white group-hover:scale-110 transition-transform duration-200" />
              </button>

              <button
                onClick={isPlaying ? pause : play}
                disabled={isLoading}
                className={`p-8 rounded-3xl transition-all duration-300 transform hover:scale-105 ${
                  isLoading
                    ? 'bg-gray-600 cursor-not-allowed opacity-50'
                    : isPlaying
                      ? 'shadow-lg shadow-red-500/25'
                      : 'shadow-lg'
                }`}
                style={{
                  background: isLoading
                    ? undefined
                    : isPlaying
                      ? 'linear-gradient(135deg, #ef4444, #dc2626)'
                      : `linear-gradient(135deg, ${getAccentHex(accentColor)}, ${getAccentHex(accentColor)}CC)`,
                }}
              >
                {isLoading ? (
                  <div className="w-12 h-12 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : isPlaying ? (
                  <Pause className="w-12 h-12 text-white" />
                ) : (
                  <Play className="w-12 h-12 text-white ml-1" />
                )}
              </button>

              <button
                onClick={onNext}
                className="p-5 rounded-xl bg-gray-700/50 hover:bg-gray-700 transition-all duration-200 group"
              >
                <SkipForward className="w-8 h-8 text-white group-hover:scale-110 transition-transform duration-200" />
              </button>

              <button
                onClick={() => {
                  setAudioPlayerState({ isLooped: !isLooped });
                }}
                className={`p-4 rounded-xl transition-all duration-200 ${
                  isLooped ? 'text-white' : 'bg-gray-700/50 text-gray-400 hover:bg-gray-700 hover:text-white'
                }`}
                style={{
                  backgroundColor: isLooped ? `${getAccentHex(accentColor)}20` : undefined,
                }}
              >
                <Repeat className="w-7 h-7" />
              </button>
            </div>

            {/* Volume control */}
            <div className="flex items-center gap-6 max-w-md mx-auto">
              <button
                onClick={() => {
                  setMuted(!isMuted);
                }}
                className="p-3 rounded-xl bg-gray-700/50 text-gray-400 hover:bg-gray-700 hover:text-white transition-all duration-200"
              >
                {isMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
              </button>

              <div className="flex-1 relative">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={volume}
                  onChange={(e) => {
                    setVolume(Number(e.target.value));
                  }}
                  className="w-full h-3 bg-gray-700/50 rounded-lg appearance-none cursor-pointer volume-slider"
                />
              </div>

              <span className="text-sm text-gray-400 min-w-[4rem] text-right">
                {Math.round(volume * 100)}%
              </span>
            </div>
          </div>
        </div>

        {/* Playlist */}
        {showPlaylist && (
          <div className="relative z-20 border-t border-gray-700/50 p-12 max-h-80 overflow-y-auto">
            <h3 className="text-xl font-semibold text-white mb-6">Playlist</h3>
            <div className="space-y-3">
              {playlist.map((track, index) => (
                <div
                  key={track.id}
                  className={`flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-all duration-200 ${
                    currentAudio?.id === track.id ? 'border' : 'bg-gray-700/30 hover:bg-gray-700/50'
                  }`}
                  style={{
                    backgroundColor:
                      currentAudio?.id === track.id ? `${getAccentHex(accentColor)}20` : undefined,
                    borderColor: currentAudio?.id === track.id ? `${getAccentHex(accentColor)}30` : undefined,
                  }}
                  onClick={() => {
                    setAudioPlayerState({ currentAudio: track, currentIndex: index });
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setAudioPlayerState({ currentAudio: track, currentIndex: index });
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={`Play ${track.name}`}
                >
                  <div className="w-10 h-10 bg-gray-600 rounded-lg flex items-center justify-center">
                    <span className="text-sm text-white font-medium">{index + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-base font-medium truncate ${
                        currentAudio?.id === track.id ? 'text-white' : 'text-white'
                      }`}
                      style={{
                        color: currentAudio?.id === track.id ? getAccentHex(accentColor) : undefined,
                      }}
                    >
                      {track.name}
                    </p>
                    <p className="text-sm text-gray-400">{track.ext?.toUpperCase()}</p>
                  </div>
                  <div className="text-sm text-gray-500">
                    {track.duration ? formatTime(track.duration) : '--:--'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Visualizer Settings Panel */}
        {showVisSettings && (
          <div className="absolute right-8 top-24 z-30 bg-gray-900/95 border border-gray-700 rounded-2xl shadow-xl p-6 w-80">
            <h3 className="text-lg font-bold mb-4 text-white">Visualizer Settings</h3>
            <div className="mb-4">
              <label className="block text-sm text-gray-300 mb-1">
                Number of Bars: {visualizerSettings.visBarCount}
              </label>
              <input
                type="range"
                min="16"
                max="96"
                value={visualizerSettings.visBarCount}
                onChange={(e) =>
                  setVisualizerSettings({ ...visualizerSettings, visBarCount: Number(e.target.value) })
                }
                className="w-full"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm text-gray-300 mb-1">
                Bar Roundness: {visualizerSettings.visBarRound}
              </label>
              <input
                type="range"
                min="0"
                max="0.5"
                step="0.01"
                value={visualizerSettings.visBarRound}
                onChange={(e) =>
                  setVisualizerSettings({ ...visualizerSettings, visBarRound: Number(e.target.value) })
                }
                className="w-full"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm text-gray-300 mb-1">
                Glow Strength: {visualizerSettings.visGlow}
              </label>
              <input
                type="range"
                min="0"
                max="24"
                value={visualizerSettings.visGlow}
                onChange={(e) =>
                  setVisualizerSettings({ ...visualizerSettings, visGlow: Number(e.target.value) })
                }
                className="w-full"
              />
            </div>
            <div className="mb-2">
              <label className="block text-sm text-gray-300 mb-1">
                Bar Opacity: {visualizerSettings.visOpacity}
              </label>
              <input
                type="range"
                min="0.2"
                max="1"
                step="0.01"
                value={visualizerSettings.visOpacity}
                onChange={(e) =>
                  setVisualizerSettings({ ...visualizerSettings, visOpacity: Number(e.target.value) })
                }
                className="w-full"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm text-gray-300 mb-1">
                Smoothing: {visualizerSettings.visSmoothing}
              </label>
              <input
                type="range"
                min="0"
                max="0.95"
                step="0.01"
                value={visualizerSettings.visSmoothing}
                onChange={(e) =>
                  setVisualizerSettings({ ...visualizerSettings, visSmoothing: Number(e.target.value) })
                }
                className="w-full"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm text-gray-300 mb-1">Visualizer Type:</label>
              <select
                value={visualizerSettings.visType}
                onChange={(e) => setVisualizerSettings({ ...visualizerSettings, visType: e.target.value })}
                className="w-full rounded-lg bg-gray-800 text-white p-2"
              >
                <option value="Bars">Bars</option>
                <option value="Waveform">Waveform</option>
                <option value="Mirror Bars">Mirror Bars</option>
              </select>
            </div>
            <button
              onClick={() => setShowVisSettings(false)}
              className="mt-4 w-full py-2 rounded-lg bg-gray-700 text-white hover:bg-gray-600 transition"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
