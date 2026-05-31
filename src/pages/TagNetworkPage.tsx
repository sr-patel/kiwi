import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Network } from 'lucide-react';
import { useAppStore } from '@/store';
import { getAccentHex } from '@/utils/accentColors';
import {
  useTagCoOccurrences,
  DEFAULT_DETAIL_LEVEL,
  DETAIL_THRESHOLDS,
} from '@/hooks/useTagCoOccurrences';
import { TagForceGraph } from '@/pages/network/ForceGraph';
import { TagPhotoPanel } from '@/pages/network/TagPhotoPanel';

export const TagNetworkPage: React.FC = () => {
  const navigate = useNavigate();
  const { theme, accentColor } = useAppStore();
  const accentHex = getAccentHex(accentColor);
  const isDark = theme === 'dark';

  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [detailLevel, setDetailLevel] = useState(DEFAULT_DETAIL_LEVEL);
  const { graphData, stats, minTagCount, maxNodes, isLoading, isError, error, refetch } =
    useTagCoOccurrences(detailLevel);

  const selectedTagCount = useMemo(() => {
    if (!selectedTag || !graphData) return 0;
    return graphData.nodes.find((node) => node.id === selectedTag)?.count ?? 0;
  }, [selectedTag, graphData]);

  return (
    <div className="flex h-[calc(100vh-8.5rem)] min-h-[520px] flex-col bg-zinc-950 text-zinc-100">
      <div className="flex shrink-0 items-center justify-between gap-4 border-b border-zinc-800 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-zinc-200"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Network className="h-5 w-5 shrink-0" style={{ color: accentHex }} />
              <h1 className="truncate text-lg font-semibold sm:text-xl">Tag Network</h1>
            </div>
            <p className="truncate text-sm text-zinc-500">
              Server-computed clusters · min {minTagCount}+ items · up to {maxNodes} tags
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 sm:gap-4">
          <div className="hidden w-44 flex-col gap-1 sm:flex md:w-52">
            <div className="flex items-center justify-between text-xs text-zinc-500">
              <span>Overview</span>
              <span className="font-medium text-zinc-300">Detail</span>
              <span>Fine</span>
            </div>
            <input
              type="range"
              min={0}
              max={DETAIL_THRESHOLDS.length - 1}
              step={1}
              value={detailLevel}
              onChange={(e) => {
                setDetailLevel(parseInt(e.target.value, 10));
                setSelectedTag(null);
              }}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-zinc-800 accent-current"
              style={{ accentColor: accentHex }}
              aria-label="Graph detail level"
            />
            <span className="text-center text-[10px] text-zinc-600">
              min {minTagCount}+ items
            </span>
          </div>

          {stats && (
            <div className="hidden items-center gap-3 text-xs text-zinc-500 md:flex">
              <span>{stats.tags} tags</span>
              <span>{stats.links} links</span>
              <span>{stats.communities} clusters</span>
            </div>
          )}
          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 px-3 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-900"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      <div className="flex shrink-0 flex-col gap-1 border-b border-zinc-800/60 px-4 py-2 sm:hidden">
        <div className="flex items-center justify-between text-xs text-zinc-500">
          <span>Overview</span>
          <span className="font-medium text-zinc-300">Detail</span>
          <span>Fine</span>
        </div>
        <input
          type="range"
          min={0}
          max={DETAIL_THRESHOLDS.length - 1}
          step={1}
          value={detailLevel}
          onChange={(e) => {
            setDetailLevel(parseInt(e.target.value, 10));
            setSelectedTag(null);
          }}
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-zinc-800"
          style={{ accentColor: accentHex }}
          aria-label="Graph detail level"
        />
        <span className="text-center text-[10px] text-zinc-600">min {minTagCount}+ items per tag</span>
      </div>

      <div className="relative flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1 p-3 sm:p-4">
          {isLoading && (
            <div className="flex h-full items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/40">
              <div className="text-center">
                <div
                  className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-zinc-700"
                  style={{ borderTopColor: accentHex }}
                />
                <p className="text-sm text-zinc-400">Building tag constellation…</p>
              </div>
            </div>
          )}

          {isError && (
            <div className="flex h-full items-center justify-center rounded-xl border border-red-900/40 bg-red-950/20 p-6">
              <div className="max-w-md text-center">
                <p className="text-sm text-red-300">
                  {error instanceof Error ? error.message : 'Failed to load tag network'}
                </p>
                <button
                  type="button"
                  onClick={() => refetch()}
                  className="mt-4 rounded-lg px-4 py-2 text-sm font-medium text-white"
                  style={{ backgroundColor: accentHex }}
                >
                  Try again
                </button>
              </div>
            </div>
          )}

          {!isLoading && !isError && graphData && graphData.nodes.length === 0 && (
            <div className="flex h-full items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/40">
              <p className="text-sm text-zinc-500">
                No tag clusters at this detail level — try sliding detail to the right.
              </p>
            </div>
          )}

          {!isLoading && !isError && graphData && graphData.nodes.length > 0 && (
            <TagForceGraph
              graphData={graphData}
              selectedTag={selectedTag}
              onSelectTag={setSelectedTag}
              accentHex={accentHex}
              isDark={isDark}
            />
          )}
        </div>

        <TagPhotoPanel
          tag={selectedTag}
          tagCount={selectedTagCount}
          accentHex={accentHex}
          onClose={() => setSelectedTag(null)}
        />
      </div>
    </div>
  );
};

export default TagNetworkPage;
