import React, { useState } from 'react';
import { Calendar, HardDrive, Play, BookOpen, FileText, Music, Download, Headphones } from 'lucide-react';
import { PhotoMetadata } from '@/types';
import { libraryService } from '@/services/libraryService';
import { useAppStore } from '@/store';
import { getAccentColor, getAccentRing, getAccentHex } from '@/utils/accentColors';
import { getFileTypeInfo } from '@/utils/fileTypes';

interface FileCardProps {
  file: PhotoMetadata;
  size: 'small' | 'medium' | 'large';
  onDoubleClick: (file: PhotoMetadata) => void;
  isMobile?: boolean;
}

export const FileCard: React.FC<FileCardProps> = ({
  file,
  size,
  onDoubleClick,
  isMobile = false,
}) => {
  const { setDetailedPhoto, accentColor, podcastMode, getAudioTime } = useAppStore();
  const fileTypeInfo = getFileTypeInfo(file.ext);
  const [imageError, setImageError] = React.useState(false);
  const [videoError, setVideoError] = React.useState(false);

  // Check if this audio file has a saved position
  const hasSavedPosition = fileTypeInfo.category === 'audio' && podcastMode.enabled && getAudioTime(file.id) > 0;
  const isAudioFile = fileTypeInfo.category === 'audio';
  
  // Get saved time and calculate progress
  const savedTime = hasSavedPosition ? getAudioTime(file.id) : 0;
  const audioDuration = file.duration || 0;
  const progressPercentage = audioDuration > 0 ? (savedTime / audioDuration) * 100 : 0;
  
  // Format time for display (rounded to nearest minute)
  const formatResumeTime = (time: number) => {
    const minutes = Math.round(time / 60);
    if (minutes < 1) return 'Just started';
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    console.log('FileCard clicked:', { fileId: file.id, fileName: file.name });
    
    // For audio files, open the audio player
    if (fileTypeInfo.category === 'audio') {
      const { openAudioPlayer } = useAppStore.getState();
      console.log('Opening audio player for:', file.name);
      openAudioPlayer(file);
      return;
    }
    
    // For files that can be previewed, open in detailed view
    if (fileTypeInfo.canPreview) {
      const { saveScrollPosition } = useAppStore.getState();
      saveScrollPosition(window.scrollY);
      console.log('Setting detailed file:', file.id);
      setDetailedPhoto(file.id);
    } else {
      // For files that can't be previewed, download them
      const fileUrl = libraryService.getPhotoFileUrl(file.id, file.ext, file.name);
      const link = document.createElement('a');
      link.href = fileUrl;
      link.download = file.name;
      link.click();
    }
  };


  const handleVideoError = () => {
    console.log('Video failed to load, falling back to icon view');
    setVideoError(true);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // For audio files, open the audio player (same as single click)
    if (fileTypeInfo.category === 'audio') {
      const { openAudioPlayer } = useAppStore.getState();
      console.log('Opening audio player for (double-click):', file.name);
      openAudioPlayer(file);
      return;
    }
    
    // For other files, call the parent's onDoubleClick
    onDoubleClick(file);
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'small':
        return 'w-32 h-40';
      case 'large':
        return 'w-64 h-80';
      default:
        return 'w-48 h-60';
    }
  };

  const getCardClasses = () => {
    const baseClasses = `
      relative group cursor-pointer rounded-lg overflow-hidden transition-all duration-200
      bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900
      border border-gray-200 dark:border-gray-700
      w-full
      hover:shadow-md hover:scale-105
    `;
    
    if (isMobile) {
      return `${baseClasses} h-48`;
    }
    
    return `${baseClasses} ${getSizeClasses()}`;
  };

  const getIconSize = () => {
    switch (size) {
      case 'small':
        return 'text-2xl';
      case 'large':
        return 'text-4xl';
      default:
        return 'text-3xl';
    }
  };

  const getActionIcon = () => {
    if (fileTypeInfo.category === 'audio') {
      return <Play className="w-4 h-4" />;
    } else if (fileTypeInfo.category === 'ebook') {
      return <BookOpen className="w-4 h-4" />;
    } else if (fileTypeInfo.category === 'document') {
      return <FileText className="w-4 h-4" />;
    } else if (fileTypeInfo.category === 'video') {
      return <Play className="w-4 h-4" />;
    } else {
      return <Download className="w-4 h-4" />;
    }
  };

  const getActionText = () => {
    if (fileTypeInfo.category === 'audio') {
      return 'Play';
    } else if (fileTypeInfo.category === 'ebook') {
      return 'Read';
    } else if (fileTypeInfo.category === 'document') {
      return 'Open';
    } else if (fileTypeInfo.category === 'video') {
      return 'Play';
    } else {
      return 'Download';
    }
  };

  const renderFileContent = () => {
    if (fileTypeInfo.category === 'video' && !videoError) {
      return (
        <div className="relative w-full h-full">
          <video
            src={libraryService.getPhotoFileUrl(file.id, file.ext, file.name)}
            className="w-full h-full object-cover rounded-lg"
            preload="metadata"
            muted
            onError={handleVideoError}
          />
          {/* Play overlay */}
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <div className="bg-white/90 rounded-full p-3">
              <Play className="w-6 h-6 text-gray-800" />
            </div>
          </div>
        </div>
      );
    }

    // Default content for other file types or fallback for videos
    return (
      <>
        {/* File icon */}
        <div className={`${getIconSize()} mb-2 opacity-80`}>
          {fileTypeInfo.icon}
        </div>
        
        {/* File name */}
        <h3 className="font-medium text-sm text-center text-gray-800 dark:text-gray-200 mb-1 line-clamp-3 px-1">
          {file.name}
        </h3>
        
        {/* File type */}
        <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
          {fileTypeInfo.displayName}
        </p>
        
        {/* Action button */}
        <button className={`
          px-2 py-1 rounded-full text-xs font-medium transition-all duration-200
          ${getAccentColor(accentColor)} bg-opacity-90
          hover:bg-opacity-100 hover:scale-105
          flex items-center gap-1
        `}>
          {getActionIcon()}
          {getActionText()}
        </button>
      </>
    );
  };

  return (
    <div 
      className={getCardClasses()} 
      onClick={handleClick} 
      onDoubleClick={handleDoubleClick}
    >
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-900/20 dark:to-indigo-900/20" />
      
      {/* File icon */}
      <div className="relative z-10 flex flex-col items-center justify-center h-full p-4">
        {/* Podcast Mode Progress Bar - show on all audio files when podcast mode is enabled */}
        {isAudioFile && podcastMode.enabled && (
          <div className="absolute top-2 left-2 right-2 space-y-1">
            {/* Progress bar */}
            {audioDuration > 0 && (
              <div className="w-full bg-gray-600/30 dark:bg-gray-700/50 rounded-full h-1.5">
                <div 
                  className="h-1.5 rounded-full transition-all duration-300"
                  style={{ 
                    width: `${Math.min(progressPercentage, 100)}%`,
                    background: `linear-gradient(to right, ${getAccentHex(accentColor)}, ${getAccentHex(accentColor)}CC)`
                  }}
                />
              </div>
            )}
            
            {/* Resume info - only show if there's a saved position */}
            {hasSavedPosition && (
              <div className="flex items-center gap-1 justify-center">
                <Headphones className="w-3 h-3" style={{ color: getAccentHex(accentColor) }} />
                <span className="text-xs font-medium" style={{ color: getAccentHex(accentColor) }}>
                  {progressPercentage > 0 ? `Resume from ${formatResumeTime(savedTime)}` : 'Just started'}
                </span>
              </div>
            )}
          </div>
        )}
        
        {renderFileContent()}
      </div>
      
      
      {/* Info overlay on hover */}
      <div className={`
        absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent
        opacity-0 group-hover:opacity-100 transition-opacity duration-200
        ${isMobile ? 'opacity-100' : ''}
      `}>
        <div className="absolute bottom-0 left-0 right-0 p-3 text-white">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-xs text-gray-300 mb-1">
                <HardDrive className="w-3 h-3" />
                <span>{libraryService.formatFileSize(file.size)}</span>
                <span>•</span>
                <Calendar className="w-3 h-3" />
                <span>{libraryService.formatDate(file.mtime)}</span>
              </div>
            </div>
            
          </div>
          
          {/* Tags */}
          {file.tags && file.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {file.tags.slice(0, 3).map((tag, index) => (
                <span
                  key={index}
                  className={`px-2 py-1 text-xs ${getAccentColor(accentColor)} bg-opacity-80 rounded-full`}
                >
                  {tag}
                </span>
              ))}
              {file.tags.length > 3 && (
                <span className="px-2 py-1 text-xs bg-gray-500/80 text-white rounded-full">
                  +{file.tags.length - 3}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}; 