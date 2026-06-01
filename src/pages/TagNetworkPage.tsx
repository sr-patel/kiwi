import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { useAppStore } from '@/store';
import { getAccentHex } from '@/utils/accentColors';
import {
  useTagCoOccurrences,
  DETAIL_THRESHOLDS,
} from '@/hooks/useTagCoOccurrences';
import { TagForceGraph } from '@/pages/network/ForceGraph';
import { TagPhotoPanel } from '@/pages/network/TagPhotoPanel';

export const TagNetworkPage: React.FC = () => {
  const navigate = useNavigate();
  const { theme, accentColor, tagNetworkSettings, setTagNetworkSettings } = useAppStore();
  const accentHex = getAccentHex(accentColor);
  const isDark = theme === 'dark';

  const { detailLevel, showInterLinks, zoomLevel } = tagNetworkSettings ?? {
    detailLevel: 0,
    showInterLinks: false,
    zoomLevel: 1,
  };

  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const { graphData, stats, minTagCount, isLoading, isError, error, refetch } =
    useTagCoOccurrences(detailLevel);

  const selectedTagCount = useMemo(() => {
    if (!selectedTag || !graphData) return 0;
    return graphData.nodes.find((node) => node.id === selectedTag)?.count ?? 0;
  }, [selectedTag, graphData]);

  const statsLabel = stats
    ? `${stats.communities} clusters · ${stats.tags} tags · ${stats.links} intra`
    : 'Loading…';

  return (
    <div className="relative h-[calc(100dvh-4rem)] overflow-hidden bg-zinc-950 text-zinc-100">
      <div className="absolute inset-0">
        {isLoading && (
          <div className="flex h-full items-center justify-center bg-zinc-950">
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
          <div className="flex h-full items-center justify-center bg-zinc-950 p-6">
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
          <div className="flex h-full items-center justify-center bg-zinc-950">
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
            showInterLinks={showInterLinks}
            zoomLevel={zoomLevel}
            onZoomChange={(zoom) => setTagNetworkSettings({ zoomLevel: zoom })}
            accentHex={accentHex}
            isDark={isDark}
          />
        )}
      </div>

      <div className="pointer-events-none absolute left-3 top-3 z-10 flex max-w-[calc(100%-1.5rem)] flex-wrap items-start gap-2 sm:left-4 sm:top-4">
        <div className="pointer-events-auto flex flex-wrap items-center gap-2 rounded-xl border border-zinc-800/80 bg-zinc-950/90 px-2 py-2 shadow-lg backdrop-blur-sm sm:gap-3 sm:px-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-zinc-200"
            title="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>

          <div className="hidden h-6 w-px bg-zinc-800 sm:block" />

          <div className="flex w-36 flex-col gap-0.5 sm:w-44">
            <div className="flex items-center justify-between text-[10px] text-zinc-500">
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
                setTagNetworkSettings({ detailLevel: parseInt(e.target.value, 10) });
                setSelectedTag(null);
              }}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-zinc-800 accent-current"
              style={{ accentColor: accentHex }}
              aria-label="Graph detail level"
            />
            <span className="text-center text-[10px] text-zinc-600">min {minTagCount}+ items</span>
          </div>

          <div className="hidden h-6 w-px bg-zinc-800 md:block" />

          <div className="hidden w-28 flex-col gap-0.5 md:flex">
            <div className="flex items-center justify-between text-[10px] text-zinc-500">
              <span>−</span>
              <span className="font-medium text-zinc-300">Zoom</span>
              <span>+</span>
            </div>
            <input
              type="range"
              min={0.3}
              max={4}
              step={0.1}
              value={zoomLevel}
              onChange={(e) =>
                setTagNetworkSettings({ zoomLevel: parseFloat(e.target.value) })
              }
              className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-zinc-800 accent-current"
              style={{ accentColor: accentHex }}
              aria-label="Graph zoom level"
            />
            <span className="text-center text-[10px] text-zinc-600">{zoomLevel.toFixed(1)}×</span>
          </div>

          <label className="hidden items-center gap-1.5 text-[11px] text-zinc-400 lg:flex">
            <input
              type="checkbox"
              checked={showInterLinks}
              onChange={(e) => setTagNetworkSettings({ showInterLinks: e.target.checked })}
              className="rounded border-zinc-700 bg-zinc-900"
              style={{ accentColor: accentHex }}
            />
            Cross-cluster
          </label>

          <button
            type="button"
            onClick={() => refetch()}
            className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-zinc-200"
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </button>

          <div className="hidden rounded-lg bg-zinc-900/80 px-2.5 py-1.5 text-[11px] text-zinc-400 xl:block">
            {statsLabel}
          </div>
        </div>
      </div>

      <TagPhotoPanel
        tag={selectedTag}
        tagCount={selectedTagCount}
        accentHex={accentHex}
        onClose={() => setSelectedTag(null)}
      />
    </div>
  );
};

export default TagNetworkPage;
