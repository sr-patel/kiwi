import { useQuery } from '@tanstack/react-query';
import type { ForceGraphData, TagNetworkGraph } from '@/pages/network/types';
import { kiwiApi } from '@/services/kiwiApi';
import { queryKeys } from './queryKeys';

export const DETAIL_PRESETS = [
  { label: 'Overview', description: 'The largest recurring themes', minTagCount: 50, maxNodes: 120 },
  { label: 'Balanced', description: 'A clear map with useful depth', minTagCount: 18, maxNodes: 280 },
  { label: 'Broad', description: 'More specialised tags and groups', minTagCount: 8, maxNodes: 450 },
  { label: 'Deep', description: 'Smaller themes across the library', minTagCount: 3, maxNodes: 650 },
  { label: 'Everything', description: 'Every qualifying tag, up to 800', minTagCount: 1, maxNodes: 800 },
] as const;

export type ConnectionStrength = 'focused' | 'balanced' | 'broad';

export const CONNECTION_PROFILES: Record<
  ConnectionStrength,
  { label: string; minScore: number; maxDegree: number }
> = {
  focused: { label: 'Strongest', minScore: 0.22, maxDegree: 4 },
  balanced: { label: 'Balanced', minScore: 0.12, maxDegree: 6 },
  broad: { label: 'More links', minScore: 0.07, maxDegree: 8 },
};

export const DEFAULT_DETAIL_LEVEL = 1;
export const DETAIL_THRESHOLDS = DETAIL_PRESETS.map((preset) => preset.minTagCount);
export const MAX_NODES_BY_DETAIL = DETAIL_PRESETS.map((preset) => preset.maxNodes);

function presetForDetailLevel(level: number) {
  const index = Math.min(Math.max(Math.round(level), 0), DETAIL_PRESETS.length - 1);
  return DETAIL_PRESETS[index];
}

export function minTagCountForDetailLevel(level: number): number {
  return presetForDetailLevel(level).minTagCount;
}

export function maxNodesForDetailLevel(level: number): number {
  return presetForDetailLevel(level).maxNodes;
}

async function fetchTagNetwork(
  minTagCount: number,
  maxNodes: number,
  connectionStrength: ConnectionStrength,
  signal?: AbortSignal,
): Promise<TagNetworkGraph> {
  const profile = CONNECTION_PROFILES[connectionStrength];
  const params = new URLSearchParams({
    minTagCount: String(minTagCount),
    minWeight: '2',
    maxNodes: String(maxNodes),
    megaTagPct: '0.35',
    pmiThreshold: '0.5',
    minScore: String(profile.minScore),
    maxDegree: String(profile.maxDegree),
  });
  return kiwiApi.tags.network(params, signal);
}

export function useTagCoOccurrences(
  detailLevel: number,
  connectionStrength: ConnectionStrength = 'balanced',
) {
  const minTagCount = minTagCountForDetailLevel(detailLevel);
  const maxNodes = maxNodesForDetailLevel(detailLevel);
  const query = useQuery({
    queryKey: queryKeys.tagNetwork(minTagCount, maxNodes, connectionStrength),
    queryFn: ({ signal }) => fetchTagNetwork(minTagCount, maxNodes, connectionStrength, signal),
    placeholderData: (previous) => previous,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchInterval: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  const graphData: ForceGraphData | null = query.data
    ? {
        nodes: query.data.nodes,
        links: query.data.links,
        interLinks: query.data.interLinks,
        clusters: query.data.clusters,
      }
    : null;

  return {
    graphData,
    stats: query.data?.stats ?? null,
    minTagCount,
    maxNodes,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isPlaceholderData: query.isPlaceholderData,
    isError: query.isError,
    error: query.error,
    refetch: () => void query.refetch(),
  };
}
