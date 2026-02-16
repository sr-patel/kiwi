import React, { useEffect, useState, useMemo } from 'react';
import { useAppStore } from '@/store';
import { getAccentHex } from '@/utils/accentColors';
import {
  PieChart, Pie,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import { HardDrive, Image, Folder, Tag, Database, Clock } from 'lucide-react';
import { formatBytes } from '@/utils/formatBytes';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"

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

export const DashboardPage: React.FC = () => {
  const { accentColor } = useAppStore();
  const [stats, setStats] = useState<DatabaseStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const accentHex = getAccentHex(accentColor);

  // Chart colors palette
  const CHART_COLORS = [
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

  // Prepare Chart Data
  const { extensionChartData, extensionChartConfig, groupChartData, groupChartConfig, avgSizeData, avgSizeConfig } = useMemo(() => {
    if (!stats) return {
      extensionChartData: [], extensionChartConfig: {},
      groupChartData: [], groupChartConfig: {},
      avgSizeData: [], avgSizeConfig: {}
    };

    // 1. Extension Distribution
    let extensionsData: { name: string; value: number }[] = [];
    if (stats.extensionStats) {
      extensionsData = stats.extensionStats
        .map(item => ({ name: (item.ext || 'unknown').toLowerCase(), value: item.count }))
        .sort((a, b) => b.value - a.value);
    } else if (stats.fileTypes) {
      extensionsData = Object.entries(stats.fileTypes)
        .map(([name, value]) => ({ name: name.toLowerCase(), value }))
        .sort((a, b) => b.value - a.value);
    }

    // Top 8 + Other
    const topExtensions = extensionsData.slice(0, 8);
    const otherExtensionsCount = extensionsData.slice(8).reduce((acc, curr) => acc + curr.value, 0);
    if (otherExtensionsCount > 0) {
      topExtensions.push({ name: 'other', value: otherExtensionsCount });
    }

    const extensionConfig: ChartConfig = {
      value: { label: "Count" },
    };

    const extensionDataWithFill = topExtensions.map((item, index) => {
      const color = CHART_COLORS[index % CHART_COLORS.length];
      extensionConfig[item.name] = {
        label: item.name.toUpperCase(),
        color: color,
      };
      return {
        ...item,
        fill: `var(--color-${item.name})`,
      };
    });

    // 2. Group Distribution
    const groupCounts: Record<string, number> = {};
    if (stats.extensionStats) {
      stats.extensionStats.forEach(item => {
        const group = getGroup(item.ext || 'unknown');
        groupCounts[group] = (groupCounts[group] || 0) + item.count;
      });
    } else {
      extensionsData.forEach(item => {
        const group = getGroup(item.name);
        groupCounts[group] = (groupCounts[group] || 0) + item.value;
      });
    }

    const groupDataRaw = Object.entries(groupCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const groupConfig: ChartConfig = {
      value: { label: "Count" },
    };

    const groupDataWithFill = groupDataRaw.map((item, index) => {
      const color = CHART_COLORS[index % CHART_COLORS.length];
      // Keys in config must be safe, simplify group name for key
      const key = item.name.toLowerCase().replace(/\s+/g, '_');
      groupConfig[key] = {
        label: item.name,
        color: color,
      };
      return {
        ...item,
        key, // Store safe key for mapping
        fill: `var(--color-${key})`,
      };
    });

    // 3. Avg Size
    let avgData: { name: string; size: number; prettySize: string }[] = [];
    if (stats.extensionStats) {
      const topByCount = [...stats.extensionStats].sort((a, b) => b.count - a.count).slice(0, 12);
      avgData = topByCount.map(item => ({
        name: (item.ext || 'unknown').toUpperCase(),
        size: item.avgSize,
        prettySize: formatBytes(item.avgSize)
      }));
    }

    const avgConfig: ChartConfig = {
      size: {
        label: "Size",
        color: accentHex,
      },
    };

    return {
      extensionChartData: extensionDataWithFill,
      extensionChartConfig: extensionConfig,
      groupChartData: groupDataWithFill,
      groupChartConfig: groupConfig,
      avgSizeData: avgData,
      avgSizeConfig: avgConfig
    };
  }, [stats, accentHex]);

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

  const StatCard = ({ icon: Icon, label, value, subtext }: { icon: any, label: string, value: string | number, subtext?: string }) => (
    <Card className="hover:scale-[1.02] transition-transform">
      <CardContent className="p-6 flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-1">{label}</p>
          <h3 className="text-2xl font-bold">{value}</h3>
          {subtext && <p className="text-xs text-muted-foreground mt-1">{subtext}</p>}
        </div>
        <div className={`p-3 rounded-lg bg-opacity-10`} style={{ backgroundColor: `${accentHex}20` }}>
          <Icon className="w-6 h-6" style={{ color: accentHex }} />
        </div>
      </CardContent>
    </Card>
  );

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

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* Chart 1: File Extensions (Pie) */}
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>File Extension Distribution</CardTitle>
            <CardDescription>Breakdown by file extension</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 pb-0">
            {extensionChartData.length > 0 ? (
              <ChartContainer config={extensionChartConfig} className="mx-auto aspect-square max-h-[300px]">
                <PieChart>
                  <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                  <Pie
                    data={extensionChartData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={60}
                    strokeWidth={5}
                  />
                  <ChartLegend content={<ChartLegendContent nameKey="name" />} className="-translate-y-2 flex-wrap gap-2 [&>*]:basis-1/4 [&>*]:justify-center" />
                </PieChart>
              </ChartContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">No data available</div>
            )}
          </CardContent>
        </Card>

        {/* Chart 2: File Groups (Pie) */}
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>File Group Distribution</CardTitle>
            <CardDescription>Breakdown by file category</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 pb-0">
            {groupChartData.length > 0 ? (
              <ChartContainer config={groupChartConfig} className="mx-auto aspect-square max-h-[300px]">
                <PieChart>
                  <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                  <Pie
                    data={groupChartData}
                    dataKey="value"
                    nameKey="key"
                    innerRadius={60}
                    strokeWidth={5}
                  />
                  <ChartLegend content={<ChartLegendContent nameKey="key" />} className="-translate-y-2 flex-wrap gap-2 [&>*]:basis-1/4 [&>*]:justify-center" />
                </PieChart>
              </ChartContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">No data available</div>
            )}
          </CardContent>
        </Card>

        {/* Chart 3: Average File Size (Bar) - Full Width on lg */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Average File Size by Type</CardTitle>
            <CardDescription>Top file types by size</CardDescription>
          </CardHeader>
          <CardContent>
            {avgSizeData.length > 0 ? (
              <ChartContainer config={avgSizeConfig} className="aspect-auto h-[300px] w-full">
                <BarChart
                  accessibilityLayer
                  data={avgSizeData}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="name"
                    tickLine={false}
                    tickMargin={10}
                    axisLine={false}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => formatBytes(value)}
                  />
                  <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent hideLabel />}
                  />
                  <Bar dataKey="size" fill="var(--color-size)" radius={4}>
                  </Bar>
                </BarChart>
              </ChartContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">No data available</div>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
};

export default DashboardPage;
