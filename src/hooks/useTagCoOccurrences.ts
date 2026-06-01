import { useQuery } from '@tanstack/react-query';
import { fetchWithRetry } from '@/utils/fetchWithTimeout';
import type { ForceGraphData, TagNetworkGraph } from '@/pages/network/types';

/** Default detail level index — overview (50+ items) */
export const DEFAULT_DETAIL_LEVEL = 0;

/** Detail slider steps: higher index = more tags shown (lower min count) */
export const DETAIL_THRESHOLDS = [50, 35, 25, 18, 12, 8, 5, 3, 2, 1] as const;

/** Cap nodes returned per detail level (sparse PMI edges keep rendering fast) */
export const MAX_NODES_BY_DETAIL = [100, 150, 200, 280, 360, 450, 550, 650, 750, 800] as const;

export function minTagCountForDetailLevel(level: number): number {
  const index = Math.min(Math.max(Math.round(level), 0), DETAIL_THRESHOLDS.length - 1);
  return DETAIL_THRESHOLDS[index];
}

export function maxNodesForDetailLevel(level: number): number {
  const index = Math.min(Math.max(Math.round(level), 0), MAX_NODES_BY_DETAIL.length - 1);
  return MAX_NODES_BY_DETAIL[index];
}

async function fetchTagNetwork(minTagCount: number, maxNodes: number): Promise<TagNetworkGraph> {
  const params = new URLSearchParams({
    minTagCount: String(minTagCount),
    minWeight: '2',
    maxNodes: String(maxNodes),
    megaTagPct: '0.35',
    pmiThreshold: '1.0',
    maxDegree: '6',
  });
  const res = await fetchWithRetry(`/api/tags/network?${params}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch tag network: ${res.statusText}`);
  }
  return res.json();
}

export function useTagCoOccurrences(detailLevel: number) {
  const minTagCount = minTagCountForDetailLevel(detailLevel);
  const maxNodes = maxNodesForDetailLevel(detailLevel);

  const query = useQuery({
    queryKey: ['tagNetwork', minTagCount, maxNodes],
    queryFn: () => fetchTagNetwork(minTagCount, maxNodes),
    staleTime: 120_000,
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
    isError: query.isError,
    error: query.error,
    refetch: () => {
      void query.refetch();
    },
  };
}
