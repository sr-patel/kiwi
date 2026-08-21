import { formatBytes } from '@/utils/formatBytes';
import type { DashboardStats } from './types';

export const EXTENSION_GROUPS: Record<string, string> = {
  jpg: 'Image',
  jpeg: 'Image',
  png: 'Image',
  gif: 'Image',
  webp: 'Image',
  bmp: 'Image',
  tiff: 'Image',
  tif: 'Image',
  avif: 'Image',
  svg: 'Image',
  heic: 'Image',
  heif: 'Image',
  jxl: 'Image',
  ico: 'Image',
  psd: 'Image',
  raw: 'Image',
  cr2: 'Image',
  cr3: 'Image',
  nef: 'Image',
  arw: 'Image',
  dng: 'Image',
  orf: 'Image',
  rw2: 'Image',
  pef: 'Image',
  raf: 'Image',
  srw: 'Image',
  nrw: 'Image',
  sr2: 'Image',
  '3fr': 'Image',
  mrw: 'Image',
  mp4: 'Video',
  avi: 'Video',
  mov: 'Video',
  mkv: 'Video',
  webm: 'Video',
  m4v: 'Video',
  flv: 'Video',
  wmv: 'Video',
  mpg: 'Video',
  mpeg: 'Video',
  '3gp': 'Video',
  ts: 'Video',
  m2ts: 'Video',
  vob: 'Video',
  ogv: 'Video',
  mp3: 'Audio',
  wav: 'Audio',
  flac: 'Audio',
  aac: 'Audio',
  ogg: 'Audio',
  opus: 'Audio',
  m4a: 'Audio',
  wma: 'Audio',
  aiff: 'Audio',
  alac: 'Audio',
  pdf: 'Ebook',
  epub: 'Ebook',
  mobi: 'Ebook',
  azw: 'Ebook',
  azw3: 'Ebook',
  cbz: 'Ebook',
  cbr: 'Ebook',
  fb2: 'Ebook',
  txt: 'Document',
  rtf: 'Document',
  doc: 'Document',
  docx: 'Document',
  xls: 'Document',
  xlsx: 'Document',
  ppt: 'Document',
  pptx: 'Document',
  odt: 'Document',
  ods: 'Document',
  odp: 'Document',
  md: 'Document',
};

export const GROUP_COLORS: Record<string, string> = {
  Image: '#3b82f6',
  Video: '#ef4444',
  Audio: '#10b981',
  Ebook: '#f97316',
  Document: '#f59e0b',
  Other: '#6b7280',
};

export const ORIENTATION_COLORS = ['#3b82f6', '#8b5cf6', '#06b6d4'];

export function getGroup(ext: string) {
  return EXTENSION_GROUPS[ext.toLowerCase()] || 'Other';
}

export function formatMonthLabel(month: string) {
  const [year, mon] = month.split('-');
  const date = new Date(Number(year), Number(mon) - 1, 1);
  return date.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
}

export function buildChartColors(accentHex: string) {
  return [
    accentHex,
    '#3b82f6',
    '#ef4444',
    '#10b981',
    '#f59e0b',
    '#8b5cf6',
    '#ec4899',
    '#06b6d4',
    '#6366f1',
    '#84cc16',
  ];
}

export function getTooltipStyle(theme: string) {
  return {
    backgroundColor: theme === 'dark' ? '#18181b' : '#fff',
    borderColor: theme === 'dark' ? '#3f3f46' : '#e5e7eb',
    color: theme === 'dark' ? '#f4f4f5' : '#18181b',
    borderRadius: '0.5rem',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
  };
}

export function getAxisColor(theme: string) {
  return theme === 'dark' ? '#a1a1aa' : '#52525b';
}

export function getGridColor(theme: string) {
  return theme === 'dark' ? '#3f3f46' : '#e4e4e7';
}

export function buildExtensionPieData(stats: DashboardStats) {
  let extensionsData: { name: string; value: number }[] = [];
  if (stats.extensionStats) {
    extensionsData = stats.extensionStats
      .map((item) => ({ name: (item.ext || 'unknown').toUpperCase(), value: item.count }))
      .sort((a, b) => b.value - a.value);
  } else if (stats.fileTypes) {
    extensionsData = Object.entries(stats.fileTypes)
      .map(([name, value]) => ({ name: name.toUpperCase(), value }))
      .sort((a, b) => b.value - a.value);
  }

  const topExtensions = extensionsData.slice(0, 8);
  const otherCount = extensionsData.slice(8).reduce((acc, curr) => acc + curr.value, 0);
  if (otherCount > 0) {
    topExtensions.push({ name: 'OTHER', value: otherCount });
  }
  return topExtensions;
}

export function buildAvgSizeData(stats: DashboardStats) {
  if (!stats.extensionStats?.length) return [];
  return stats.extensionStats
    .map((item) => ({
      name: (item.ext || 'unknown').toUpperCase(),
      size: Number(item.avgSize) || 0,
      count: Number(item.count) || 0,
    }))
    .filter((item) => item.size > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 12)
    .map((item) => ({
      ...item,
      prettySize: formatBytes(item.size),
    }));
}

export function buildOrientationData(analytics: DashboardStats['analytics']) {
  if (!analytics?.orientationStats) return [];
  const { landscape, portrait, square } = analytics.orientationStats;
  return [
    { name: 'Landscape', value: landscape },
    { name: 'Portrait', value: portrait },
    { name: 'Square', value: square },
  ].filter((item) => item.value > 0);
}

export function buildTimelineData(analytics: DashboardStats['analytics']) {
  if (!analytics?.timelineByMonth?.length) return [];
  return analytics.timelineByMonth.map((row) => ({
    month: row.month,
    label: formatMonthLabel(row.month),
    count: row.count,
  }));
}

export function buildStorageByGroupData(analytics: DashboardStats['analytics']) {
  if (!analytics?.storageByGroup?.length) return [];
  return analytics.storageByGroup.map((row) => ({
    name: row.group,
    totalSize: row.totalSize,
    count: row.count,
    prettySize: formatBytes(row.totalSize),
  }));
}

export function buildCountByGroupData(analytics: DashboardStats['analytics']) {
  if (!analytics?.storageByGroup?.length) return [];
  return analytics.storageByGroup.map((row) => ({
    name: row.group,
    count: row.count,
  }));
}

export function buildStorageByExtensionData(stats: DashboardStats) {
  if (!stats.extensionStats) return [];
  return [...stats.extensionStats]
    .sort((a, b) => b.totalSize - a.totalSize)
    .slice(0, 10)
    .map((item) => ({
      name: (item.ext || 'unknown').toUpperCase(),
      totalSize: item.totalSize,
      count: item.count,
      prettySize: formatBytes(item.totalSize),
    }));
}

export function buildResolutionData(analytics: DashboardStats['analytics']) {
  if (!analytics?.resolutionBuckets?.length) return [];
  return analytics.resolutionBuckets.map((row) => ({
    name: row.bucket,
    count: row.count,
  }));
}

export function buildCumulativeTimelineData(analytics: DashboardStats['analytics']) {
  if (!analytics?.timelineByMonth?.length) return [];
  let cumulative = 0;
  return analytics.timelineByMonth.map((row) => {
    cumulative += row.count;
    return {
      month: row.month,
      label: formatMonthLabel(row.month),
      count: row.count,
      cumulative,
    };
  });
}

export function getTotalFromPieData(data: { value: number }[]) {
  return data.reduce((sum, item) => sum + item.value, 0);
}
