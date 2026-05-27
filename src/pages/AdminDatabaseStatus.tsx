import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Database, HardDrive, FileText, Image, Video, Music, RefreshCw, CheckCircle, Clock, Eye } from 'lucide-react';

interface DatabaseStats {
  totalPhotos: number;
  dbSize: number;
  totalSize: number;
  lastRefresh: string;
  fileTypes?: { [type: string]: number };
}

interface SyncStatus {
  running: boolean;
  libraryPath: string | null;
  lastEvent: string | null;
  lastEventTime: string | null;
  lastError: string | null;
  pendingCount: number;
  processedCount: number;
  lastReconcileTime: string | null;
}

export const AdminDatabaseStatus: React.FC = () => {
  const [stats, setStats] = useState<DatabaseStats | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [isRebuilding, setIsRebuilding] = useState(false);
  const [rebuildError, setRebuildError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const [statsRes, syncRes] = await Promise.all([
          axios.get('/api/database/stats'),
          axios.get('/api/sync/status'),
        ]);
        setStats(statsRes.data);
        setSyncStatus(syncRes.data);
      } catch (error) {
        console.error('Failed to fetch admin data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(async () => {
      try {
        const syncRes = await axios.get('/api/sync/status');
        setSyncStatus(syncRes.data);
      } catch {
        // ignore polling errors
      }
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const handleFullRebuild = async () => {
    setIsRebuilding(true);
    setRebuildError(null);
    try {
      await axios.post('/api/database/refresh', { source: 'library' });
      const [statsRes, syncRes] = await Promise.all([
        axios.get('/api/database/stats'),
        axios.get('/api/sync/status'),
      ]);
      setStats(statsRes.data);
      setSyncStatus(syncRes.data);
    } catch (err: unknown) {
      const message = axios.isAxiosError(err)
        ? err.response?.data?.error || err.message
        : 'Failed to rebuild database';
      setRebuildError(message);
    } finally {
      setIsRebuilding(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const getFileTypeIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'image': return <Image className="w-4 h-4" />;
      case 'video': return <Video className="w-4 h-4" />;
      case 'audio': return <Music className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

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
              <div className="w-6 h-6 border-2 border-blue-200 dark:border-blue-700 border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin" />
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

        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
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

            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-4">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400 truncate">Watcher</p>
                  <div className="flex items-center gap-2 mt-1">
                    <CheckCircle className={`w-4 h-4 flex-shrink-0 ${syncStatus?.running ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`} />
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                      {syncStatus?.running ? 'Active' : 'Stopped'}
                    </p>
                  </div>
                </div>
                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg flex-shrink-0 ml-3">
                  <Eye className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </div>

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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">File Watcher</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Changes to Eagle metadata files are synced to SQLite automatically in real time.
            </p>
            {syncStatus && (
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-500 dark:text-gray-400">Status</dt>
                  <dd className="text-gray-900 dark:text-gray-100">{syncStatus.running ? 'Running' : 'Stopped'}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-500 dark:text-gray-400">Pending</dt>
                  <dd className="text-gray-900 dark:text-gray-100">{syncStatus.pendingCount}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-500 dark:text-gray-400">Processed</dt>
                  <dd className="text-gray-900 dark:text-gray-100">{syncStatus.processedCount.toLocaleString()}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-500 dark:text-gray-400">Last event</dt>
                  <dd className="text-gray-900 dark:text-gray-100 text-right">{syncStatus.lastEvent || '—'}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-500 dark:text-gray-400">Last reconcile</dt>
                  <dd className="text-gray-900 dark:text-gray-100 text-right">
                    {syncStatus.lastReconcileTime
                      ? new Date(syncStatus.lastReconcileTime).toLocaleString()
                      : '—'}
                  </dd>
                </div>
                {syncStatus.lastError && (
                  <div className="pt-2 text-red-600 dark:text-red-400">{syncStatus.lastError}</div>
                )}
              </dl>
            )}
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Full Rebuild</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Wipe and rebuild the database from all library metadata. Use only when the index is corrupt.
            </p>
            {rebuildError && (
              <p className="text-sm text-red-600 dark:text-red-400 mb-4">{rebuildError}</p>
            )}
            <button
              onClick={handleFullRebuild}
              disabled={isRebuilding}
              className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-4 h-4 ${isRebuilding ? 'animate-spin' : ''}`} />
              {isRebuilding ? 'Rebuilding...' : 'Run Full Rebuild'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
