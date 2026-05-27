import React from 'react';
import type { TooltipProps } from 'recharts';
import { formatBytes } from '@/utils/formatBytes';

export const CHART_ANIMATION = { duration: 600, easing: 'ease-out' as const };

export const CHART_MARGINS = {
  default: { top: 8, right: 12, left: 0, bottom: 0 },
  horizontal: { top: 4, right: 16, left: 4, bottom: 4 },
  vertical: { top: 8, right: 8, left: 0, bottom: 4 },
};

interface ChartTooltipProps extends TooltipProps<number, string> {
  theme: string;
  valueFormatter?: (value: number, name?: string) => string;
  labelFormatter?: (label: string) => string;
}

export function ChartTooltip({
  active,
  payload,
  label,
  theme,
  valueFormatter,
  labelFormatter,
}: ChartTooltipProps) {
  if (!active || !payload?.length) return null;

  const displayLabel = labelFormatter ? labelFormatter(String(label ?? '')) : label;

  return (
    <div
      className="rounded-lg border px-3 py-2 shadow-lg text-xs"
      style={{
        backgroundColor: theme === 'dark' ? '#18181b' : '#ffffff',
        borderColor: theme === 'dark' ? '#3f3f46' : '#e4e4e7',
        color: theme === 'dark' ? '#f4f4f5' : '#18181b',
      }}
    >
      {displayLabel && (
        <p className="font-medium mb-1.5 text-gray-900 dark:text-zinc-100">{displayLabel}</p>
      )}
      <ul className="space-y-1">
        {payload.map((entry, i) => {
          const raw = entry.value ?? 0;
          const formatted = valueFormatter
            ? valueFormatter(Number(raw), entry.name)
            : typeof raw === 'number'
              ? raw.toLocaleString()
              : String(raw);
          return (
            <li key={i} className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: entry.color || entry.payload?.fill }}
              />
              <span className="text-gray-500 dark:text-zinc-400">{entry.name || 'Value'}</span>
              <span className="ml-auto font-medium tabular-nums">{formatted}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function formatPercent(value: number, total: number) {
  if (total <= 0) return '0%';
  return `${((value / total) * 100).toFixed(1)}%`;
}

/** Disable the default column highlight; brighten the bar itself on hover instead. */
export const BAR_HOVER = {
  cursor: false as const,
  activeBar: { style: { filter: 'brightness(1.1)' } },
};

export function createPieLabelRenderer(theme: string) {
  const labelColor = theme === 'dark' ? '#fafafa' : '#18181b';
  return function pieLabelRenderer({
    cx, cy, midAngle, outerRadius, percent, name,
  }: {
    cx: number;
    cy: number;
    midAngle: number;
    outerRadius: number;
    percent: number;
    name: string;
  }) {
    if (percent < 0.04) return null;
    const RADIAN = Math.PI / 180;
    const radius = outerRadius + 14;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    const anchor = x > cx ? 'start' : 'end';
    return (
      <text
        x={x}
        y={y}
        fill={labelColor}
        textAnchor={anchor}
        dominantBaseline="central"
        fontSize={11}
        fontWeight={600}
      >
        {name}
      </text>
    );
  };
}

export function formatStorageTooltip(value: number) {
  return formatBytes(value);
}

/** @deprecated Use createPieLabelRenderer(theme) */
export function pieLabelRenderer(props: {
  cx: number;
  cy: number;
  midAngle: number;
  innerRadius: number;
  outerRadius: number;
  percent: number;
  name: string;
}) {
  return createPieLabelRenderer('dark')(props);
}
