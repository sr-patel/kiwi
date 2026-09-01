import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, LocateFixed, Network, RefreshCw, Search, Tags, X } from 'lucide-react';
import { useAppStore } from '@/store';
import { getAccentHex } from '@/utils/accentColors';
import {
  CONNECTION_PROFILES,
  DETAIL_PRESETS,
  useTagCoOccurrences,
  type ConnectionStrength,
} from '@/hooks/useTagCoOccurrences';
import { TagForceGraph } from '@/pages/network/ForceGraph';
import { TagPhotoPanel } from '@/pages/network/TagPhotoPanel';
import type { NetworkSelection } from '@/pages/network/types';

function isConnectionStrength(value: unknown): value is ConnectionStrength {
  return value === 'focused' || value === 'balanced' || value === 'broad';
}

export function TagNetworkPage() {
  const navigate = useNavigate();
  const { theme, accentColor, tagNetworkSettings, setTagNetworkSettings } = useAppStore();
  const accentHex = getAccentHex(accentColor);
  const isDark = theme === 'dark';
  const detailLevel = Math.min(
    DETAIL_PRESETS.length - 1,
    Math.max(0, Math.round(tagNetworkSettings?.detailLevel ?? 1)),
  );
  const showInterLinks = tagNetworkSettings?.showInterLinks ?? false;
  const showLabels = tagNetworkSettings?.showLabels ?? true;
  const connectionStrength = isConnectionStrength(tagNetworkSettings?.connectionStrength)
    ? tagNetworkSettings.connectionStrength
    : 'balanced';

  const [selection, setSelection] = useState<NetworkSelection>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [fitRequest, setFitRequest] = useState(0);
  const { graphData, stats, minTagCount, isLoading, isFetching, isPlaceholderData, isError, error, refetch } =
    useTagCoOccurrences(detailLevel, connectionStrength);

  const selectedTag = selection?.kind === 'tag' ? selection.tag : null;
  const selectedLink = selection?.kind === 'link' ? selection : null;
  const selectedTagCount = useMemo(() => {
    if (!selectedTag || !graphData) return 0;
    return graphData.nodes.find((node) => node.id === selectedTag)?.count ?? 0;
  }, [graphData, selectedTag]);
  const searchResults = useMemo(() => {
    const term = searchQuery.trim().toLocaleLowerCase();
    if (!term || !graphData) return [];
    return graphData.nodes
      .filter((node) => node.id.toLocaleLowerCase().includes(term))
      .sort((a, b) => {
        const aStarts = a.id.toLocaleLowerCase().startsWith(term) ? 0 : 1;
        const bStarts = b.id.toLocaleLowerCase().startsWith(term) ? 0 : 1;
        return aStarts - bStarts || b.count - a.count || a.id.localeCompare(b.id);
      })
      .slice(0, 8);
  }, [graphData, searchQuery]);
  const clusterLegend = useMemo(() => graphData?.clusters.slice(0, 6) ?? [], [graphData?.clusters]);

  const selectTag = useCallback((tag: string | null) => {
    setSelection(tag ? { kind: 'tag', tag } : null);
    if (tag) setSearchQuery('');
  }, []);

  const changeGraphSettings = (partial: Partial<typeof tagNetworkSettings>) => {
    setTagNetworkSettings(partial);
    setSelection(null);
  };

  const surface = isDark
    ? 'border-zinc-800/80 bg-zinc-950/88 text-zinc-100'
    : 'border-zinc-200/90 bg-white/90 text-zinc-900';
  const muted = isDark ? 'text-zinc-400' : 'text-zinc-600';
  const canvasBackground = isDark ? 'bg-zinc-950' : 'bg-zinc-50';

  return (
    <main className={`relative h-[calc(100dvh-4rem)] overflow-hidden ${canvasBackground}`}>
      <div className="absolute inset-0">
        {graphData && graphData.nodes.length > 0 && (
          <TagForceGraph
            graphData={graphData}
            selectedTag={selectedTag}
            selectedLink={selectedLink}
            onSelectTag={selectTag}
            onSelectLink={(source, target) => setSelection({ kind: 'link', source, target })}
            onClearSelection={() => setSelection(null)}
            showInterLinks={showInterLinks}
            showLabels={showLabels}
            fitRequest={fitRequest}
            accentHex={accentHex}
            isDark={isDark}
          />
        )}

        {isLoading && !graphData && (
          <div className={`flex h-full items-center justify-center ${canvasBackground}`}>
            <div className="max-w-sm px-6 text-center">
              <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl border border-zinc-800 bg-zinc-900">
                <Network className="h-6 w-6 animate-pulse" style={{ color: accentHex }} />
              </div>
              <p className={`text-sm font-medium ${isDark ? 'text-zinc-200' : 'text-zinc-800'}`}>
                Mapping tag relationships…
              </p>
              <p className={`mt-1 text-xs ${muted}`}>
                The first build analyses co-occurrences; later views reuse the cached model.
              </p>
            </div>
          </div>
        )}

        {isError && !graphData && (
          <div className={`flex h-full items-center justify-center p-6 ${canvasBackground}`}>
            <div className={`max-w-md rounded-2xl border p-6 text-center shadow-xl ${surface}`}>
              <p className="text-sm text-red-400">
                {error instanceof Error ? error.message : 'The tag atlas could not be loaded.'}
              </p>
              <button
                type="button"
                onClick={refetch}
                className="mt-4 rounded-lg px-4 py-2 text-sm font-medium text-white"
                style={{ backgroundColor: accentHex }}
              >
                Try again
              </button>
            </div>
          </div>
        )}

        {!isLoading && !isError && graphData?.nodes.length === 0 && (
          <div className={`flex h-full items-center justify-center p-6 ${canvasBackground}`}>
            <div className="max-w-md text-center">
              <Tags className={`mx-auto h-8 w-8 ${muted}`} />
              <p className={`mt-3 text-sm font-medium ${isDark ? 'text-zinc-200' : 'text-zinc-800'}`}>
                No repeatable tag relationships at this level
              </p>
              <button
                type="button"
                onClick={() => changeGraphSettings({ detailLevel: DETAIL_PRESETS.length - 1 })}
                className="mt-3 text-sm font-medium"
                style={{ color: accentHex }}
              >
                Include smaller tags
              </button>
            </div>
          </div>
        )}
      </div>

      <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col gap-2 p-3 sm:p-4">
        <div className="flex items-start justify-between gap-2">
          <div
            className={`pointer-events-auto flex min-w-0 items-center gap-2 rounded-2xl border p-2 shadow-lg backdrop-blur-xl ${surface}`}
          >
            <button
              type="button"
              onClick={() => navigate(-1)}
              className={`rounded-xl p-2 transition-colors hover:bg-zinc-500/10 ${muted}`}
              aria-label="Go back"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="hidden h-8 w-px bg-zinc-500/20 sm:block" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Network className="h-4 w-4" style={{ color: accentHex }} />
                <h1 className="truncate text-sm font-semibold">Tag Atlas</h1>
              </div>
              <p className={`mt-0.5 hidden truncate text-[10px] sm:block ${muted}`}>
                Stable communities from repeatable co-tags
              </p>
            </div>
          </div>

          <div
            className={`pointer-events-auto flex items-center gap-1 rounded-2xl border p-2 shadow-lg backdrop-blur-xl ${surface}`}
          >
            <button
              type="button"
              onClick={() => setFitRequest((value) => value + 1)}
              className={`rounded-xl p-2 transition-colors hover:bg-zinc-500/10 ${muted}`}
              title="Fit complete atlas (0)"
              aria-label="Fit complete atlas"
            >
              <LocateFixed className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={refetch}
              className={`rounded-xl p-2 transition-colors hover:bg-zinc-500/10 ${muted}`}
              title="Refresh tag atlas"
              aria-label="Refresh tag atlas"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <div className="flex items-start justify-between gap-2">
          <div
            className={`pointer-events-auto w-[min(28rem,calc(100vw-1.5rem))] rounded-2xl border p-2 shadow-lg backdrop-blur-xl ${surface}`}
          >
            <div className="relative">
              <Search className={`pointer-events-none absolute left-3 top-2.5 h-4 w-4 ${muted}`} />
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && searchResults[0]) selectTag(searchResults[0].id);
                  if (event.key === 'Escape') setSearchQuery('');
                }}
                placeholder="Find a tag in this atlas…"
                className={`h-9 w-full rounded-xl border border-zinc-500/20 bg-zinc-500/5 pl-9 pr-9 text-sm outline-none transition focus:border-zinc-500/50 ${isDark ? 'placeholder:text-zinc-600' : 'placeholder:text-zinc-400'}`}
                aria-label="Find a tag in the atlas"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className={`absolute right-2 top-1.5 rounded-lg p-1 ${muted}`}
                  aria-label="Clear tag search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              {searchQuery.trim() && (
                <div
                  className={`absolute left-0 right-0 top-11 overflow-hidden rounded-xl border shadow-2xl ${surface}`}
                >
                  {searchResults.length > 0 ? (
                    searchResults.map((node) => (
                      <button
                        type="button"
                        key={node.id}
                        onClick={() => selectTag(node.id)}
                        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-zinc-500/10"
                      >
                        <span className="min-w-0 truncate">#{node.id}</span>
                        <span className={`shrink-0 text-xs ${muted}`}>{node.count.toLocaleString()}</span>
                      </button>
                    ))
                  ) : (
                    <p className={`px-3 py-3 text-xs ${muted}`}>No visible tag matches this search.</p>
                  )}
                </div>
              )}
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-[1.15fr_1fr_auto_auto]">
              <label className="min-w-0">
                <span className={`mb-1 block text-[10px] font-medium uppercase tracking-wide ${muted}`}>
                  Detail
                </span>
                <select
                  value={detailLevel}
                  onChange={(event) => changeGraphSettings({ detailLevel: Number(event.target.value) })}
                  className="h-8 w-full rounded-lg border border-zinc-500/20 bg-transparent px-2 text-xs outline-none"
                >
                  {DETAIL_PRESETS.map((preset, index) => (
                    <option key={preset.label} value={index} className={isDark ? 'bg-zinc-950' : 'bg-white'}>
                      {preset.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="min-w-0">
                <span className={`mb-1 block text-[10px] font-medium uppercase tracking-wide ${muted}`}>
                  Connections
                </span>
                <select
                  value={connectionStrength}
                  onChange={(event) =>
                    changeGraphSettings({ connectionStrength: event.target.value as ConnectionStrength })
                  }
                  className="h-8 w-full rounded-lg border border-zinc-500/20 bg-transparent px-2 text-xs outline-none"
                >
                  {Object.entries(CONNECTION_PROFILES).map(([value, profile]) => (
                    <option key={value} value={value} className={isDark ? 'bg-zinc-950' : 'bg-white'}>
                      {profile.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className={`flex items-end gap-2 pb-1.5 text-xs ${muted}`}>
                <input
                  type="checkbox"
                  checked={showLabels}
                  onChange={(event) => setTagNetworkSettings({ showLabels: event.target.checked })}
                  style={{ accentColor: accentHex }}
                />
                Labels
              </label>
              <label className={`flex items-end gap-2 pb-1.5 text-xs ${muted}`}>
                <input
                  type="checkbox"
                  checked={showInterLinks}
                  onChange={(event) => setTagNetworkSettings({ showInterLinks: event.target.checked })}
                  style={{ accentColor: accentHex }}
                />
                Cross-links
              </label>
            </div>
            <p className={`mt-1.5 hidden truncate text-[10px] sm:block ${muted}`}>
              {DETAIL_PRESETS[detailLevel].description} · tags used by at least {minTagCount} items
            </p>
          </div>

          {clusterLegend.length > 0 && (
            <div
              className={`pointer-events-auto hidden max-w-56 rounded-2xl border p-3 shadow-lg backdrop-blur-xl lg:block ${surface}`}
            >
              <p className={`mb-2 text-[10px] font-medium uppercase tracking-wider ${muted}`}>
                Largest communities
              </p>
              <div className="space-y-1.5">
                {clusterLegend.map((cluster) => (
                  <div key={cluster.id} className="flex items-center gap-2 text-xs">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: cluster.color }}
                    />
                    <span className="min-w-0 flex-1 truncate">#{cluster.label}</span>
                    <span className={muted}>{cluster.nodeCount}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </header>

      {stats && (
        <div
          className={`pointer-events-none absolute bottom-3 right-3 z-10 hidden rounded-xl border px-3 py-2 text-[10px] shadow-lg backdrop-blur-xl sm:block ${surface}`}
        >
          <span className="font-medium">{stats.tags} tags</span>
          <span className={`mx-1.5 ${muted}`}>·</span>
          <span>{stats.communities} communities</span>
          <span className={`mx-1.5 ${muted}`}>·</span>
          <span>{stats.links + (showInterLinks ? stats.interLinks : 0)} links</span>
          {stats.buildMs != null && (
            <>
              <span className={`mx-1.5 ${muted}`}>·</span>
              <span>{stats.buildMs} ms model</span>
            </>
          )}
          {(isFetching || isPlaceholderData) && <span className={`ml-2 ${muted}`}>Updating…</span>}
        </div>
      )}

      <TagPhotoPanel
        selection={selection}
        tagCount={selectedTagCount}
        accentHex={accentHex}
        onClose={() => setSelection(null)}
      />
    </main>
  );
}

export default TagNetworkPage;
