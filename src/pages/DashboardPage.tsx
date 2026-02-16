import React, { useEffect, useState } from 'react';
import { useAppStore } from '@/store';
import { getAccentHex } from '@/utils/accentColors';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  Legend
} from 'recharts';
import { HardDrive, Image, Folder, Tag, Database, FileDigit, Clock } from 'lucide-react';
import { formatBytes } from '@/utils/formatBytes';

interface DatabaseStats {
  totalPhotos: number;
  totalFolders: number;
  totalTags: number;
  totalSize: number;
  dbSize: number;
  lastRefresh: string | null;
  fileTypes: { [key: string]: number };
  typeStats?: { type: string; count: number }[]; // structure from server/database.js
}

export const DashboardPage: React.FC = () => {
  const { accentColor, theme } = useAppStore();
  const [stats, setStats] = useState<DatabaseStats | null>(null);
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

  // Prepare chart data
  let fileTypeData = stats.fileTypes
    ? Object.entries(stats.fileTypes)
        .map(([name, value]) => ({ name: name.toUpperCase(), value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 8) // Top 8 types
    : [];

  // Also try to use typeStats if fileTypes is empty (depending on API response structure variation)
  if (fileTypeData.length === 0 && stats.typeStats) {
     stats.typeStats.forEach(item => {
       fileTypeData.push({ name: item.type.toUpperCase(), value: item.count });
     });
     // Reassign after sorting and slicing, as slice returns a new array
     fileTypeData = fileTypeData.sort((a, b) => b.value - a.value).slice(0, 8);
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

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-fade-in">
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

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* File Type Distribution */}
        <div className="bg-white dark:bg-gray-900 p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm min-h-[400px] flex flex-col">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-6">File Type Distribution</h3>
          {fileTypeData.length > 0 ? (
            <div className="flex-1 w-full min-h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={fileTypeData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    fill="#8884d8"
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {fileTypeData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: theme === 'dark' ? '#1f2937' : '#fff',
                      borderColor: theme === 'dark' ? '#374151' : '#e5e7eb',
                      color: theme === 'dark' ? '#f3f4f6' : '#111827',
                      borderRadius: '0.5rem'
                    }}
                    itemStyle={{ color: theme === 'dark' ? '#f3f4f6' : '#111827' }}
                  />
                  <Legend
                    layout="vertical"
                    verticalAlign="middle"
                    align="right"
                    wrapperStyle={{ color: theme === 'dark' ? '#9ca3af' : '#4b5563' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex items-center justify-center flex-1 text-gray-400">
              No file type data available
            </div>
          )}
        </div>

        {/* Future Chart Placeholder */}
        <div className="bg-white dark:bg-gray-900 p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm min-h-[400px] flex flex-col items-center justify-center text-center">
            <div className="p-4 rounded-full bg-gray-100 dark:bg-gray-800 mb-4">
              <FileDigit className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">More Insights Coming Soon</h3>
            <p className="text-gray-500 dark:text-gray-400 max-w-xs text-sm">
              Future updates will include timelines of photo additions and more detailed folder analytics.
            </p>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
