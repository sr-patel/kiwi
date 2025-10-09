import React from 'react';
import { useAppStore } from '@/store';
import { useAudio } from './AudioProvider';
import { Play, Pause, SkipBack, SkipForward, X } from 'lucide-react';

interface MiniAudioPlayerProps {
  className?: string;
}

export const MiniAudioPlayer: React.FC<MiniAudioPlayerProps> = ({ className = '' }) => {
  const {
    audioPlayer,
    playNextAudio,
    playPreviousAudio,
    setMiniPlayer,
    closeAudioPlayer,
  } = useAppStore();
  const { isPlaying, currentTime, duration, play, pause, seek } = useAudio();

  if (!audioPlayer.currentAudio) return null;

  const { currentAudio } = audioPlayer;

  const handlePlayPause = () => (isPlaying ? pause() : play());
  const handleClose = () => {
    setMiniPlayer(false);
    closeAudioPlayer();
  };
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    seek(Number(e.target.value));
  };

  // Format time helper
  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`bg-gray-900 text-white flex items-center px-4 py-2 rounded-lg shadow gap-4 w-full ${className}`} style={{ minHeight: 40, maxWidth: '100%' }}>
      <div className="flex flex-1 min-w-0 items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="truncate font-semibold text-base max-w-full" title={currentAudio.name}>{currentAudio.name}</div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-gray-400 min-w-[2rem]">{formatTime(currentTime)}</span>
            <input
              type="range"
              min={0}
              max={duration}
              value={currentTime}
              onChange={handleSeek}
              className="flex-1 accent-green-400"
            />
            <span className="text-xs text-gray-400 min-w-[2rem]">{duration > 0 ? formatTime(duration) : '--:--'}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button onClick={() => {
          const newTime = Math.max(0, currentTime - 30);
          console.log('Skip back 30s:', { currentTime, newTime, duration });
          seek(newTime);
        }} className="p-2 hover:text-accent min-w-[36px]">
          <SkipBack className="w-5 h-5" />
        </button>
        <button onClick={handlePlayPause} className="p-2 hover:text-accent min-w-[36px]">
          {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
        </button>
        <button onClick={() => {
          const newTime = Math.min(duration, currentTime + 30);
          console.log('Skip forward 30s:', { currentTime, newTime, duration });
          seek(newTime);
        }} className="p-2 hover:text-accent min-w-[36px]">
          <SkipForward className="w-5 h-5" />
        </button>
        <button onClick={handleClose} className="p-2 hover:text-red-400 min-w-[36px]">
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}; 