import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Network } from 'lucide-react';
import { useAppStore } from '@/store';
import { getAccentHex } from '@/utils/accentColors';
import { useTagCoOccurrences } from '@/hooks/useTagCoOccurrences';
import { TagForceGraph } from '@/pages/network/ForceGraph';
import { TagPhotoPanel } from '@/pages/network/TagPhotoPanel';

export const TagNetworkPage: React.FC = () => {
  const navigate = useNavigate();
  const { theme, accentColor } = useAppStore();
  const accentHex = getAccentHex(accentColor);
  const isDark = theme === 'dark';

  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const { graphData, isLoading, isError, error, refetch } = useTagCoOccurrences(isDark);

  const selectedTagCount = useMemo(() => {
    if (!selectedTag || !graphData) return 0;
    return graphData.nodes.find((node) => node.id === selectedTag)?.count ?? 0;
  }, [selectedTag, graphData]);

  const stats = useMemo(() => {
    if (!graphData) return null;
    const isolated = graphData.nodes.filter((node) => node.isIsolated).length;
    return {
      tags: graphData.nodes.length,
      links: graphData.links.length,
      isolated,
      communities: new Set(graphData.nodes.map((node) => node.community)).size,
    };
  }, [graphData]);

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
              Explore how tags cluster and co-occur across your library
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {stats && (
            <div className="hidden items-center gap-3 text-xs text-zinc-500 md:flex">
              <span>{stats.tags} tags</span>
              <span>{stats.links} links</span>
              <span>{stats.communities} clusters</span>
              {stats.isolated > 0 && <span>{stats.isolated} isolated</span>}
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
              <p className="text-sm text-zinc-500">No tagged items yet — add tags in Eagle to see the network.</p>
            </div>
          )}

          {!isLoading && !isError && graphData && graphData.nodes.length > 0 && (
            <TagForceGraph
              graphData={graphData.forceGraph}
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
