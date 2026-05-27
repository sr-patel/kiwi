import React, { useEffect, useState } from 'react';
import { useAppStore } from '@/store';
import { getAccentHex } from '@/utils/accentColors';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import { HardDrive, Image, Folder, Tag, Database, Clock, Eye, RefreshCw, AlertCircle, FileImage, FolderPlus } from 'lucide-react';
import { formatBytes } from '@/utils/formatBytes';

interface WatcherActivityEntry {
  id: number;
  timestamp: string;
  type: string;
  message: string;
  photoId?: string;
  photoName?: string;
  details?: Record<string, unknown>;
}

interface WatcherStatus {
  running: boolean;
  libraryPath: string | null;
  lastEvent: string | null;
  lastEventTime: string | null;
  lastError: string | null;
  pendingCount: number;
  processedCount: number;
  lastReconcileTime: string | null;
  activityLog: WatcherActivityEntry[];
}

interface DatabaseStats {
  totalPhotos: number;
  totalFolders: number;
  totalTags: number;
  totalSize: number;
  dbSize: number;
  lastRefresh: string | null;
  fileTypes: { [key: string]: number };
  typeStats?: { type: string; count: number }[];
  extensionStats?: {
    ext: string;
    count: number;
    avgSize: number;
    totalSize: number;
  }[];
}

const EXTENSION_GROUPS: Record<string, string> = {
  // Images
  'jpg': 'Image', 'jpeg': 'Image', 'png': 'Image', 'gif': 'Image',
  'webp': 'Image', 'bmp': 'Image', 'tiff': 'Image', 'avif': 'Image',
  'svg': 'Image', 'heic': 'Image', 'heif': 'Image', 'raw': 'Image',
  'cr2': 'Image', 'nef': 'Image', 'arw': 'Image', 'dng': 'Image',
  // Videos
  'mp4': 'Video', 'avi': 'Video', 'mov': 'Video', 'mkv': 'Video',
  'webm': 'Video', 'm4v': 'Video', 'flv': 'Video', 'wmv': 'Video',
  'mpg': 'Video', 'mpeg': 'Video', '3gp': 'Video', 'ts': 'Video',
  // Audio
  'mp3': 'Audio', 'wav': 'Audio', 'flac': 'Audio', 'aac': 'Audio',
  'ogg': 'Audio', 'opus': 'Audio', 'm4a': 'Audio', 'wma': 'Audio',
  'aiff': 'Audio', 'alac': 'Audio',
  // Documents
  'pdf': 'Document', 'epub': 'Document', 'mobi': 'Document',
  'txt': 'Document', 'doc': 'Document', 'docx': 'Document',
};

const getGroup = (ext: string) => EXTENSION_GROUPS[ext.toLowerCase()] || 'Other';

const ACTIVITY_ICONS: Record<string, typeof Image> = {
  photo_added: FileImage,
  photo_updated: Image,
  photo_removed: Image,
  folder_detected: FolderPlus,
  library_updated: Folder,
  reconcile: RefreshCw,
  watcher_started: Eye,
  watcher_stopped: Eye,
  error: AlertCircle,
};

function formatActivityTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function getActivityStyle(type: string) {
  switch (type) {
    case 'photo_added':
      return 'text-green-600 dark:text-green-400';
    case 'photo_removed':
      return 'text-red-600 dark:text-red-400';
    case 'error':
      return 'text-red-600 dark:text-red-400';
    case 'library_updated':
    case 'folder_detected':
      return 'text-blue-600 dark:text-blue-400';
    default:
      return 'text-gray-600 dark:text-gray-300';
  }
}

export const DashboardPage: React.FC = () => {
  const { accentColor, theme } = useAppStore();
  const [stats, setStats] = useState<DatabaseStats | null>(null);
  const [watcherStatus, setWatcherStatus] = useState<WatcherStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const accentHex = getAccentHex(accentColor);

  // Chart colors
  const COLORS = [
    accentHex,
    '#3b82f6', // blue
    '#ef4444', // red
    '#10b981', // green
    '#f59e0b', // amber
    '#8b5cf6', // violet
    '#ec4899', // pink
    '#06b6d4', // cyan
    '#6366f1', // indigo
    '#84cc16', // lime
  ];

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/database/stats');
        if (!res.ok) throw new Error('Failed to fetch statistics');
        const data = await res.json();
        setStats(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  useEffect(() => {
    const fetchWatcherStatus = async () => {
      try {
        const res = await fetch('/api/sync/status');
        if (res.ok) {
          setWatcherStatus(await res.json());
        }
      } catch {
        // Watcher status is non-critical for dashboard stats
      }
    };

    fetchWatcherStatus();
    const interval = setInterval(fetchWatcherStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[50vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: accentHex }}></div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[50vh] text-gray-500">
        <Database className="w-12 h-12 mb-4 opacity-50" />
        <p>Failed to load dashboard statistics.</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 rounded bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  // --- Process Data ---

  // 1. Extension Distribution (Count)
  let extensionsData: { name: string; value: number }[] = [];
  if (stats.extensionStats) {
    extensionsData = stats.extensionStats
      .map(item => ({ name: (item.ext || 'unknown').toUpperCase(), value: item.count }))
      .sort((a, b) => b.value - a.value);
  } else if (stats.fileTypes) {
    // Fallback for old API response
    extensionsData = Object.entries(stats.fileTypes)
      .map(([name, value]) => ({ name: name.toUpperCase(), value }))
      .sort((a, b) => b.value - a.value);
  }

  // Limit for Pie Chart 1
  const topExtensions = extensionsData.slice(0, 8);
  const otherExtensionsCount = extensionsData.slice(8).reduce((acc, curr) => acc + curr.value, 0);
  if (otherExtensionsCount > 0) {
    topExtensions.push({ name: 'OTHER', value: otherExtensionsCount });
  }

  // 2. Group Distribution (Count)
  const groupCounts: Record<string, number> = {};
  if (stats.extensionStats) {
    stats.extensionStats.forEach(item => {
      const group = getGroup(item.ext || 'unknown');
      groupCounts[group] = (groupCounts[group] || 0) + item.count;
    });
  } else {
    // Fallback
    extensionsData.forEach(item => {
      const group = getGroup(item.name.toLowerCase());
      groupCounts[group] = (groupCounts[group] || 0) + item.value;
    });
  }

  const groupData = Object.entries(groupCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // 3. Average Size (Bar Chart)
  // We want to show average size for the most common file types to keep it relevant
  // Let's take the top 12 extensions by count, and show their avg sizes.
  let avgSizeData: { name: string; size: number; prettySize: string }[] = [];

  if (stats.extensionStats) {
    // Filter out extensions with very few files (optional, but keeps chart clean)
    // Here we just take top 12 by count
    const topByCount = [...stats.extensionStats].sort((a, b) => b.count - a.count).slice(0, 12);

    avgSizeData = topByCount.map(item => ({
      name: (item.ext || 'unknown').toUpperCase(),
      size: item.avgSize,
      prettySize: formatBytes(item.avgSize)
    }));
  }

  const StatCard = ({ icon: Icon, label, value, subtext }: { icon: any, label: string, value: string | number, subtext?: string }) => (
    <div className="bg-white dark:bg-gray-900 p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-start justify-between transition-transform hover:scale-[1.02]">
      <div>
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{label}</p>
        <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</h3>
        {subtext && <p className="text-xs text-gray-400 mt-1">{subtext}</p>}
      </div>
      <div className={`p-3 rounded-lg bg-opacity-10`} style={{ backgroundColor: `${accentHex}20` }}>
        <Icon className="w-6 h-6" style={{ color: accentHex }} />
      </div>
    </div>
  );

  const ChartCard = ({ title, children }: { title: string, children: React.ReactNode }) => (
    <div className="bg-white dark:bg-gray-900 p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm min-h-[400px] flex flex-col">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-6">{title}</h3>
      <div className="flex-1 w-full min-h-[300px]">
        {children}
      </div>
    </div>
  );

  const tooltipStyle = {
    backgroundColor: theme === 'dark' ? '#1f2937' : '#fff',
    borderColor: theme === 'dark' ? '#374151' : '#e5e7eb',
    color: theme === 'dark' ? '#f3f4f6' : '#111827',
    borderRadius: '0.5rem',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-fade-in pb-20">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Dashboard</h1>
        <p className="text-gray-500 dark:text-gray-400">Library statistics and overview</p>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <StatCard
          icon={Image}
          label="Total Photos"
          value={stats.totalPhotos.toLocaleString()}
        />
        <StatCard
          icon={HardDrive}
          label="Library Size"
          value={formatBytes(stats.totalSize)}
        />
        <StatCard
          icon={Folder}
          label="Folders"
          value={stats.totalFolders.toLocaleString()}
        />
        <StatCard
          icon={Tag}
          label="Tags"
          value={stats.totalTags.toLocaleString()}
        />
        <StatCard
          icon={Database}
          label="Database Size"
          value={formatBytes(stats.dbSize)}
        />
        <StatCard
          icon={Clock}
          label="Last Refresh"
          value={stats.lastRefresh ? new Date(stats.lastRefresh).toLocaleDateString() : 'Never'}
          subtext={stats.lastRefresh ? new Date(stats.lastRefresh).toLocaleTimeString() : undefined}
        />
      </div>

      {/* File Watcher Activity */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">File Watcher Activity</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">New files and folders detected in chronological order</p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span
              className={`inline-block w-2.5 h-2.5 rounded-full ${
                watcherStatus?.running ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
              }`}
            />
            <span className="text-gray-600 dark:text-gray-300">
              {watcherStatus?.running ? 'Watching' : 'Not running'}
            </span>
          </div>
        </div>

        <div className="max-h-[420px] overflow-y-auto">
          {!watcherStatus?.activityLog?.length ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <Eye className="w-10 h-10 mb-3 opacity-50" />
              <p>No watcher activity yet.</p>
              <p className="text-sm mt-1">Import or edit files in Eagle to see events here.</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {[...watcherStatus.activityLog].reverse().map((entry) => {
                const Icon = ACTIVITY_ICONS[entry.type] || RefreshCw;
                return (
                  <li key={entry.id} className="px-6 py-3 flex items-start gap-3 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${getActivityStyle(entry.type)}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${getActivityStyle(entry.type)}`}>{entry.message}</p>
                      {entry.photoName && entry.photoName !== entry.message && (
                        <p className="text-xs text-gray-400 truncate mt-0.5">{entry.photoName}</p>
                      )}
                    </div>
                    <time className="text-xs text-gray-400 whitespace-nowrap shrink-0 tabular-nums">
                      {formatActivityTime(entry.timestamp)}
                    </time>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {watcherStatus?.lastError && (
          <div className="px-6 py-3 border-t border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 text-sm text-red-700 dark:text-red-300">
            Last error: {watcherStatus.lastError}
          </div>
        )}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* Chart 1: File Extensions (Pie) */}
        <ChartCard title="File Extension Distribution">
          {topExtensions.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={topExtensions}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  fill="#8884d8"
                  paddingAngle={5}
                  dataKey="value"
                >
                  {topExtensions.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: theme === 'dark' ? '#f3f4f6' : '#111827' }} />
                <Legend layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ color: theme === 'dark' ? '#9ca3af' : '#4b5563' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400">No data available</div>
          )}
        </ChartCard>

        {/* Chart 2: File Groups (Pie) */}
        <ChartCard title="File Group Distribution">
          {groupData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={groupData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  fill="#8884d8"
                  paddingAngle={5}
                  dataKey="value"
                >
                  {groupData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: theme === 'dark' ? '#f3f4f6' : '#111827' }} />
                <Legend layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ color: theme === 'dark' ? '#9ca3af' : '#4b5563' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
             <div className="flex items-center justify-center h-full text-gray-400">No data available</div>
          )}
        </ChartCard>

        {/* Chart 3: Average File Size (Bar) - Full Width on lg */}
        <div className="lg:col-span-2">
          <ChartCard title="Average File Size by Type">
            {avgSizeData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={avgSizeData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#374151' : '#e5e7eb'} />
                  <XAxis
                    dataKey="name"
                    stroke={theme === 'dark' ? '#9ca3af' : '#4b5563'}
                    tick={{ fill: theme === 'dark' ? '#9ca3af' : '#4b5563' }}
                  />
                  <YAxis
                    stroke={theme === 'dark' ? '#9ca3af' : '#4b5563'}
                    tick={{ fill: theme === 'dark' ? '#9ca3af' : '#4b5563' }}
                    tickFormatter={(value) => formatBytes(value)}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    itemStyle={{ color: theme === 'dark' ? '#f3f4f6' : '#111827' }}
                    formatter={(value: number) => [formatBytes(value), 'Avg Size']}
                  />
                  <Bar dataKey="size" fill={accentHex} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">No data available</div>
            )}
          </ChartCard>
        </div>

      </div>
    </div>
  );
};

export default DashboardPage;
