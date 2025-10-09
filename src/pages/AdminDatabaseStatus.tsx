import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Database, HardDrive, FileText, Image, Video, Music, RefreshCw, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { useAppStore } from '@/store';
import { getAccentHex } from '@/utils/accentColors';

interface DatabaseStats {
  totalPhotos: number;
  dbSize: number;
  totalSize: number;
  lastRefresh: string;
  fileTypes?: { [type: string]: number };
}

interface UpdateProgress {
  status: string;
  totalFiles: number;
  processedFiles: number;
  percent: number;
  eta: string | null;
  startTime: string | null;
  elapsed: number;
  logs: string[];
  error: string | null;
}

export const AdminDatabaseStatus: React.FC = () => {
  const { accentColor } = useAppStore();
  const [stats, setStats] = useState<DatabaseStats | null>(null);
  const [progress, setProgress] = useState<UpdateProgress | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const pollingRef = useRef<any>(null);
  const navigate = useNavigate();

  // Fetch stats
  useEffect(() => {
    const fetchStats = async () => {
      try {
        setIsLoading(true);
        const response = await axios.get('/api/database/stats');
        setStats(response.data);
      } catch (error) {
        console.error('Failed to fetch database stats:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchStats();
  }, []);

  // Poll update progress
  useEffect(() => {
    if (!isUpdating) return;
    const poll = () => {
      axios.get('/api/database/update-status').then(res => setProgress(res.data));
    };
    poll();
    pollingRef.current = setInterval(poll, 2000);
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [isUpdating]);

  // Trigger update
  const handleUpdate = async () => {
    setIsUpdating(true);
    setUpdateError(null);
    try {
      await axios.post('/api/database/incremental-update');
    } catch (err: any) {
      setUpdateError(err?.response?.data?.error || err?.response?.data?.message || 'Failed to start incremental update');
      setIsUpdating(false);
    }
  };

  // Stop polling when update is done
  useEffect(() => {
    if (progress && (progress.status === 'done' || progress.status === 'idle' || progress.status === 'error')) {
      setIsUpdating(false);
      if (pollingRef.current) clearInterval(pollingRef.current);
      // Refresh stats after update
      if (progress.status === 'done') {
        axios.get('/api/database/stats').then(res => setStats(res.data));
      }
    }
  }, [progress]);

  // Helper function to format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Helper function to get file type icon
  const getFileTypeIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'image': return <Image className="w-4 h-4" />;
      case 'video': return <Video className="w-4 h-4" />;
      case 'audio': return <Music className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  // Helper function to get file type color
  const getFileTypeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'image': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'video': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
      case 'audio': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-black">
        <div className="max-w-6xl mx-auto p-8">
          <div className="flex items-center justify-center h-64">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 border-2 border-blue-200 dark:border-blue-700 border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin"></div>
              <span className="text-gray-600 dark:text-gray-400">Loading database statistics...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black">
      <div className="w-full px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3">
              <Database className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Database Admin</h1>
            </div>
          </div>
        </div>

        {/* Main Statistics Grid */}
        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
            {/* Total Files */}
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-4">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400 truncate">Total Files</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.totalPhotos.toLocaleString()}</p>
                </div>
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex-shrink-0 ml-3">
                  <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </div>

            {/* Total Photo Size */}
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-4">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400 truncate">Total Photo Size</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{formatFileSize(stats.totalSize)}</p>
                </div>
                <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex-shrink-0 ml-3">
                  <HardDrive className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </div>

            {/* Last Updated */}
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-4">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400 truncate">Last Updated</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {stats.lastRefresh ? new Date(stats.lastRefresh).toLocaleDateString() : 'Never'}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {stats.lastRefresh ? new Date(stats.lastRefresh).toLocaleTimeString() : ''}
                  </p>
                </div>
                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg flex-shrink-0 ml-3">
                  <Clock className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </div>

            {/* Status */}
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-4">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400 truncate">Status</p>
                  <div className="flex items-center gap-2 mt-1">
                    <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">Healthy</p>
                  </div>
                </div>
                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg flex-shrink-0 ml-3">
                  <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </div>

            {/* Database File Size */}
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-4">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400 truncate">Database File</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{formatFileSize(stats.dbSize)}</p>
                </div>
                <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg flex-shrink-0 ml-3">
                  <Database className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* File Type Breakdown */}
        {stats?.fileTypes && Object.keys(stats.fileTypes).length > 0 && (
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">File Type Breakdown</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Object.entries(stats.fileTypes).map(([type, count]) => (
                <div key={type} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`p-2 rounded-lg ${getFileTypeColor(type)} flex-shrink-0`}>
                      {getFileTypeIcon(type)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900 dark:text-gray-100 capitalize truncate">{type}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{count.toLocaleString()} files</p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-3">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {((count / stats.totalPhotos) * 100).toFixed(1)}%
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Update Controls */}
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-6 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Database Updates</h2>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Run an incremental update to scan for new, modified, or deleted files in your photo library.
              </p>
            </div>
            <button
              onClick={handleUpdate}
              disabled={isUpdating}
              className="flex items-center gap-2 px-6 py-3 text-white font-semibold rounded-lg transition-colors disabled:cursor-not-allowed flex-shrink-0"
              style={{ backgroundColor: getAccentHex(accentColor), opacity: isUpdating ? 0.7 : 1 }}
            >
              {isUpdating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Running Update...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Run Incremental Update
                </>
              )}
            </button>
          </div>

          {updateError && (
            <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg mb-4">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
              <span className="text-red-700 dark:text-red-300">{updateError}</span>
            </div>
          )}

          {/* Progress Section */}
          {progress && progress.status !== 'idle' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Progress</span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {progress.processedFiles.toLocaleString()} / {progress.totalFiles.toLocaleString()} files
                </span>
              </div>
              
              <div className="w-full rounded-full h-3 overflow-hidden" style={{ backgroundColor: `${getAccentHex(accentColor)}30` }}>
                <div
                  className="h-3 rounded-full transition-all duration-300 ease-out"
                  style={{ 
                    width: `${Math.max(0, Math.min(100, progress.percent))}%`,
                    background: `linear-gradient(to right, ${getAccentHex(accentColor)}, ${getAccentHex(accentColor)}CC)`
                  }}
                />
              </div>
              
              <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
                <span>{progress.percent.toFixed(1)}% complete</span>
                <span>ETA: {progress.eta || 'Calculating...'}</span>
              </div>

              {/* Logs */}
              {progress.logs.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Recent Logs</h3>
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 h-48 overflow-y-auto">
                    <div className="space-y-1 text-xs font-mono text-gray-700 dark:text-gray-300">
                      {progress.logs.slice(-50).map((line, i) => (
                        <div key={i} className="whitespace-pre-wrap">{line}</div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}; 