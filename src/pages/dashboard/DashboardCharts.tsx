import React from 'react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  AreaChart, Area, Line, ComposedChart,
} from 'recharts';
import { formatBytes } from '@/utils/formatBytes';
import type { DashboardStats } from './types';
import {
  buildAvgSizeData,
  buildChartColors,
  buildCountByGroupData,
  buildCumulativeTimelineData,
  buildExtensionPieData,
  buildOrientationData,
  buildResolutionData,
  buildStorageByExtensionData,
  buildStorageByGroupData,
  buildTaggedData,
  buildTimelineData,
  buildTopFoldersData,
  buildTopTagsData,
  getAxisColor,
  getGridColor,
  getTotalFromPieData,
  getTooltipStyle,
  GROUP_COLORS,
  ORIENTATION_COLORS,
} from './chartUtils';
import { CHART_ANIMATION, CHART_MARGINS, ChartTooltip, BAR_HOVER, createPieLabelRenderer, formatPercent } from './ChartTooltip';

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  tall?: boolean;
}

function ChartCard({ title, subtitle, children, className = '', tall = false }: ChartCardProps) {
  const chartHeight = tall ? 280 : 240;
  return (
    <div
      className={`bg-white dark:bg-zinc-900 p-5 rounded-xl border border-gray-200 dark:border-zinc-800 shadow-sm flex flex-col ${className}`}
    >
      <div className="mb-3 shrink-0">
        <h3 className="text-base font-semibold text-gray-900 dark:text-zinc-100">{title}</h3>
        {subtitle && <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">{subtitle}</p>}
      </div>
      <div className="w-full" style={{ height: chartHeight }}>{children}</div>
    </div>
  );
}

function EmptyChart({ message = 'No data yet' }: { message?: string }) {
  return (
    <div className="flex items-center justify-center h-full min-h-[200px] text-sm text-gray-400 dark:text-zinc-500">
      {message}
    </div>
  );
}

interface DashboardChartsProps {
  stats: DashboardStats;
  theme: string;
  accentHex: string;
}

export function DashboardCharts({ stats, theme, accentHex }: DashboardChartsProps) {
  const colors = buildChartColors(accentHex);
  const tooltipStyle = getTooltipStyle(theme);
  const axisColor = getAxisColor(theme);
  const gridColor = getGridColor(theme);

  const timelineData = buildTimelineData(stats.analytics);
  const cumulativeData = buildCumulativeTimelineData(stats.analytics);
  const storageData = buildStorageByGroupData(stats.analytics);
  const countByGroup = buildCountByGroupData(stats.analytics);
  const topFolders = buildTopFoldersData(stats.analytics);
  const topTags = buildTopTagsData(stats.analytics);
  const extensionPie = buildExtensionPieData(stats);
  const orientationData = buildOrientationData(stats.analytics);
  const taggedData = buildTaggedData(stats.analytics);
  const storageByExt = buildStorageByExtensionData(stats);
  const resolutionData = buildResolutionData(stats.analytics);
  const avgSizeData = buildAvgSizeData(stats);

  const pieTotal = getTotalFromPieData(extensionPie);
  const taggedTotal = getTotalFromPieData(taggedData);
  const pieLabel = createPieLabelRenderer(theme);

  const legendStyle = { color: axisColor, fontSize: 11, paddingTop: 8 };

  return (
    <div className="space-y-5">
      {/* Row 1: Growth charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ChartCard title="Library Growth" subtitle="New items per month" tall>
          {timelineData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timelineData} margin={CHART_MARGINS.default}>
                <defs>
                  <linearGradient id="timelineGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={accentHex} stopOpacity={0.4} />
                    <stop offset="100%" stopColor={accentHex} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis dataKey="label" stroke="transparent" tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis stroke="transparent" tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} width={32} />
                <Tooltip
                  content={({ active, payload, label }) => (
                    <ChartTooltip
                      active={active}
                      payload={payload}
                      label={label}
                      theme={theme}
                      labelFormatter={(l) => String(l)}
                      valueFormatter={(v) => `${v.toLocaleString()} items`}
                    />
                  )}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  name="New items"
                  stroke={accentHex}
                  fill="url(#timelineGradient)"
                  strokeWidth={2}
                  animationDuration={CHART_ANIMATION.duration}
                  dot={{ r: 3, fill: accentHex, strokeWidth: 0 }}
                  activeDot={{ r: 5, strokeWidth: 2, stroke: theme === 'dark' ? '#18181b' : '#fff' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </ChartCard>

        <ChartCard title="Cumulative Library Size" subtitle="Total items over time" tall>
          {cumulativeData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={cumulativeData} margin={CHART_MARGINS.default}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis dataKey="label" stroke="transparent" tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis stroke="transparent" tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} width={40} />
                <Tooltip
                  content={({ active, payload, label }) => (
                    <ChartTooltip
                      active={active}
                      payload={payload}
                      label={label}
                      theme={theme}
                      valueFormatter={(v, name) => `${v.toLocaleString()} ${name === 'cumulative' ? 'total' : 'new'}`}
                    />
                  )}
                />
                <Bar dataKey="count" name="New" fill={`${accentHex}40`} radius={[3, 3, 0, 0]} maxBarSize={28} animationDuration={CHART_ANIMATION.duration} {...BAR_HOVER} />
                <Line
                  type="monotone"
                  dataKey="cumulative"
                  name="Total"
                  stroke={accentHex}
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: accentHex, strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                  animationDuration={CHART_ANIMATION.duration}
                />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </ChartCard>
      </div>

      {/* Row 2: Storage & counts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ChartCard title="Storage by Media Type" subtitle="Disk usage per category">
          {storageData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={storageData} layout="vertical" margin={CHART_MARGINS.horizontal}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
                <XAxis type="number" stroke="transparent" tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatBytes(v)} />
                <YAxis type="category" dataKey="name" stroke="transparent" tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} width={68} />
                <Tooltip
                  content={({ active, payload, label }) => (
                    <ChartTooltip
                      active={active}
                      payload={payload}
                      label={label}
                      theme={theme}
                      valueFormatter={(v, name) => {
                        const row = payload?.[0]?.payload as { prettySize?: string; count?: number };
                        if (name === 'totalSize') return `${row?.prettySize || formatBytes(v)} (${row?.count?.toLocaleString()} files)`;
                        return formatBytes(v);
                      }}
                    />
                  )}
                />
                <Bar dataKey="totalSize" name="Storage" radius={[0, 4, 4, 0]} maxBarSize={22} animationDuration={CHART_ANIMATION.duration} {...BAR_HOVER}>
                  {storageData.map((entry) => (
                    <Cell key={entry.name} fill={GROUP_COLORS[entry.name] || accentHex} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </ChartCard>

        <ChartCard title="Files by Media Type" subtitle="Item count per category">
          {countByGroup.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={countByGroup} margin={CHART_MARGINS.vertical}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis dataKey="name" stroke="transparent" tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis stroke="transparent" tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} width={32} />
                <Tooltip
                  content={({ active, payload, label }) => (
                    <ChartTooltip active={active} payload={payload} label={label} theme={theme} valueFormatter={(v) => `${v.toLocaleString()} files`} />
                  )}
                />
                <Bar dataKey="count" name="Files" radius={[4, 4, 0, 0]} maxBarSize={48} animationDuration={CHART_ANIMATION.duration} {...BAR_HOVER}>
                  {countByGroup.map((entry) => (
                    <Cell key={entry.name} fill={GROUP_COLORS[entry.name] || accentHex} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </ChartCard>
      </div>

      {/* Row 3: Folders & tags */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ChartCard title="Top Folders" subtitle="Most items per folder">
          {topFolders.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topFolders} layout="vertical" margin={CHART_MARGINS.horizontal}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
                <XAxis type="number" stroke="transparent" tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" stroke="transparent" tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} width={88} />
                <Tooltip
                  content={({ active, payload }) => {
                    const row = payload?.[0]?.payload as { fullName?: string };
                    return (
                      <ChartTooltip
                        active={active}
                        payload={payload}
                        label={row?.fullName}
                        theme={theme}
                        valueFormatter={(v) => `${v.toLocaleString()} items`}
                      />
                    );
                  }}
                />
                <Bar dataKey="count" name="Items" fill={accentHex} radius={[0, 4, 4, 0]} maxBarSize={18} animationDuration={CHART_ANIMATION.duration} {...BAR_HOVER} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </ChartCard>

        <ChartCard title="Top Tags" subtitle="Most used tags">
          {topTags.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topTags} layout="vertical" margin={CHART_MARGINS.horizontal}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
                <XAxis type="number" stroke="transparent" tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" stroke="transparent" tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} width={88} />
                <Tooltip
                  content={({ active, payload }) => {
                    const row = payload?.[0]?.payload as { fullName?: string };
                    return (
                      <ChartTooltip
                        active={active}
                        payload={payload}
                        label={row?.fullName}
                        theme={theme}
                        valueFormatter={(v) => `${v.toLocaleString()} items`}
                      />
                    );
                  }}
                />
                <Bar dataKey="count" name="Items" fill="#8b5cf6" radius={[0, 4, 4, 0]} maxBarSize={18} animationDuration={CHART_ANIMATION.duration} {...BAR_HOVER} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </ChartCard>
      </div>

      {/* Row 4: Distribution donuts */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        <ChartCard title="File Extensions" subtitle="Count by format">
          {extensionPie.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={extensionPie}
                  cx="50%"
                  cy="42%"
                  innerRadius="38%"
                  outerRadius="58%"
                  paddingAngle={3}
                  dataKey="value"
                  animationDuration={CHART_ANIMATION.duration}
                  label={pieLabel}
                  labelLine={{ stroke: theme === 'dark' ? '#52525b' : '#a1a1aa', strokeWidth: 1 }}
                >
                  {extensionPie.map((_, index) => (
                    <Cell key={`ext-${index}`} fill={colors[index % colors.length]} stroke="transparent" />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => (
                    <ChartTooltip
                      active={active}
                      payload={payload}
                      theme={theme}
                      valueFormatter={(v) => `${v.toLocaleString()} (${formatPercent(v, pieTotal)})`}
                    />
                  )}
                />
                <Legend verticalAlign="bottom" wrapperStyle={legendStyle} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </ChartCard>

        <ChartCard title="Image Orientation" subtitle="Landscape, portrait, square">
          {orientationData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={orientationData}
                  cx="50%"
                  cy="42%"
                  innerRadius="38%"
                  outerRadius="58%"
                  paddingAngle={3}
                  dataKey="value"
                  animationDuration={CHART_ANIMATION.duration}
                  label={pieLabel}
                  labelLine={{ stroke: theme === 'dark' ? '#52525b' : '#a1a1aa', strokeWidth: 1 }}
                >
                  {orientationData.map((_, index) => (
                    <Cell key={`orient-${index}`} fill={ORIENTATION_COLORS[index % ORIENTATION_COLORS.length]} stroke="transparent" />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => (
                    <ChartTooltip
                      active={active}
                      payload={payload}
                      theme={theme}
                      valueFormatter={(v) => {
                        const total = orientationData.reduce((s, d) => s + d.value, 0);
                        return `${v.toLocaleString()} (${formatPercent(v, total)})`;
                      }}
                    />
                  )}
                />
                <Legend verticalAlign="bottom" wrapperStyle={legendStyle} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart message="No dimension data" />
          )}
        </ChartCard>

        <ChartCard title="Tag Coverage" subtitle="Tagged vs untagged items">
          {taggedData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={taggedData}
                  cx="50%"
                  cy="42%"
                  innerRadius="38%"
                  outerRadius="58%"
                  paddingAngle={3}
                  dataKey="value"
                  animationDuration={CHART_ANIMATION.duration}
                  label={pieLabel}
                  labelLine={{ stroke: theme === 'dark' ? '#52525b' : '#a1a1aa', strokeWidth: 1 }}
                >
                  <Cell fill="#10b981" stroke="transparent" />
                  <Cell fill="#71717a" stroke="transparent" />
                </Pie>
                <Tooltip
                  content={({ active, payload }) => (
                    <ChartTooltip
                      active={active}
                      payload={payload}
                      theme={theme}
                      valueFormatter={(v) => `${v.toLocaleString()} (${formatPercent(v, taggedTotal)})`}
                    />
                  )}
                />
                <Legend verticalAlign="bottom" wrapperStyle={legendStyle} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </ChartCard>
      </div>

      {/* Row 5: Resolution & storage by ext */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ChartCard title="Image Resolution" subtitle="Megapixel distribution">
          {resolutionData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={resolutionData} margin={CHART_MARGINS.vertical}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis dataKey="name" stroke="transparent" tick={{ fill: axisColor, fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis stroke="transparent" tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} width={32} />
                <Tooltip
                  content={({ active, payload, label }) => (
                    <ChartTooltip active={active} payload={payload} label={label} theme={theme} valueFormatter={(v) => `${v.toLocaleString()} images`} />
                  )}
                />
                <Bar dataKey="count" name="Images" fill="#06b6d4" radius={[4, 4, 0, 0]} maxBarSize={40} animationDuration={CHART_ANIMATION.duration} {...BAR_HOVER} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart message="No resolution data" />
          )}
        </ChartCard>

        <ChartCard title="Storage by Extension" subtitle="Top formats by disk usage">
          {storageByExt.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={storageByExt} layout="vertical" margin={CHART_MARGINS.horizontal}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
                <XAxis type="number" stroke="transparent" tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatBytes(v)} />
                <YAxis type="category" dataKey="name" stroke="transparent" tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} width={44} />
                <Tooltip
                  content={({ active, payload, label }) => (
                    <ChartTooltip
                      active={active}
                      payload={payload}
                      label={label}
                      theme={theme}
                      valueFormatter={(v) => {
                        const row = payload?.[0]?.payload as { prettySize?: string; count?: number };
                        return `${row?.prettySize || formatBytes(v)} (${row?.count?.toLocaleString()} files)`;
                      }}
                    />
                  )}
                />
                <Bar dataKey="totalSize" name="Storage" fill={accentHex} radius={[0, 4, 4, 0]} maxBarSize={16} animationDuration={CHART_ANIMATION.duration} {...BAR_HOVER} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </ChartCard>
      </div>

      {/* Row 6: Avg size */}
      <ChartCard title="Average File Size by Extension" subtitle="Top 12 formats by count" tall>
        {avgSizeData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={avgSizeData} margin={CHART_MARGINS.vertical}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
              <XAxis dataKey="name" stroke="transparent" tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis
                stroke="transparent"
                tick={{ fill: axisColor, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => formatBytes(v)}
                width={56}
                domain={[0, 'auto']}
              />
              <Tooltip
                content={({ active, payload, label }) => (
                  <ChartTooltip
                    active={active}
                    payload={payload}
                    label={label}
                    theme={theme}
                    valueFormatter={(v) => formatBytes(v)}
                  />
                )}
              />
              <Bar dataKey="size" name="Avg size" fill={accentHex} radius={[4, 4, 0, 0]} maxBarSize={36} animationDuration={CHART_ANIMATION.duration} {...BAR_HOVER} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChart />
        )}
      </ChartCard>
    </div>
  );
}
