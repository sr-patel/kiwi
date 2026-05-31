import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchWithRetry } from '@/utils/fetchWithTimeout';
import { detectCommunities, getCommunityColor } from '@/pages/network/communityDetection';
import type {
  ForceGraphData,
  ForceGraphLink,
  ForceGraphNode,
  TagCoOccurrenceEdge,
  TagGraphData,
} from '@/pages/network/types';

/** Default minimum items per tag (index into DETAIL_THRESHOLDS) */
export const DEFAULT_DETAIL_LEVEL = 4;

/** Detail slider steps: higher index = more tags shown (lower min count) */
export const DETAIL_THRESHOLDS = [50, 30, 20, 15, 10, 7, 5, 3, 2, 1] as const;

export function minTagCountForDetailLevel(level: number): number {
  const index = Math.min(Math.max(Math.round(level), 0), DETAIL_THRESHOLDS.length - 1);
  return DETAIL_THRESHOLDS[index];
}

async function fetchCoOccurrences(): Promise<TagCoOccurrenceEdge[]> {
  const params = new URLSearchParams({
    minWeight: '2',
    minTagCount: '0',
    limit: '5000',
  });
  const res = await fetchWithRetry(`/api/tags/co-occurrences?${params}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch tag co-occurrences: ${res.statusText}`);
  }
  return res.json();
}

async function fetchTagCounts(): Promise<Record<string, number>> {
  const res = await fetchWithRetry('/api/tags/counts');
  if (!res.ok) {
    throw new Error(`Failed to fetch tag counts: ${res.statusText}`);
  }
  return res.json();
}

function buildGraphData(
  edges: TagCoOccurrenceEdge[],
  tagCounts: Record<string, number>,
  isDark: boolean,
  minTagCount: number,
): TagGraphData & { forceGraph: ForceGraphData } {
  const majorTags = new Set(
    Object.entries(tagCounts)
      .filter(([, count]) => count > minTagCount)
      .map(([tag]) => tag),
  );

  const filteredEdges = edges.filter(
    (edge) => majorTags.has(edge.source) && majorTags.has(edge.target),
  );

  const degree = new Map<string, number>();
  const nodeIds = new Set<string>();

  for (const edge of filteredEdges) {
    nodeIds.add(edge.source);
    nodeIds.add(edge.target);
    degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1);
    degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1);
  }

  const sortedIds = [...nodeIds].sort(
    (a, b) => (tagCounts[b] ?? 0) - (tagCounts[a] ?? 0),
  );

  const communities = detectCommunities(sortedIds, filteredEdges);

  const nodes = sortedIds.map((id) => {
    const count = tagCounts[id] ?? 0;
    const community = communities.get(id) ?? 0;
    const nodeDegree = degree.get(id) ?? 0;
    return {
      id,
      count,
      community,
      degree: nodeDegree,
      isIsolated: nodeDegree === 0,
    };
  });

  const links = filteredEdges.map((edge) => ({
    source: edge.source,
    target: edge.target,
    weight: edge.weight,
  }));

  const maxCount = Math.max(1, ...nodes.map((node) => node.count));
  const forceNodes: ForceGraphNode[] = nodes.map((node) => ({
    ...node,
    val: 4 + (node.count / maxCount) * 18,
    color: getCommunityColor(node.community, isDark),
  }));

  const forceLinks: ForceGraphLink[] = links.map((link) => ({ ...link }));

  return {
    nodes,
    links,
    forceGraph: {
      nodes: forceNodes,
      links: forceLinks,
    },
  };
}

export function useTagCoOccurrences(isDark: boolean, detailLevel: number) {
  const edgesQuery = useQuery({
    queryKey: ['tagCoOccurrences'],
    queryFn: fetchCoOccurrences,
    staleTime: 60_000,
  });

  const countsQuery = useQuery({
    queryKey: ['tagCounts'],
    queryFn: fetchTagCounts,
    staleTime: 30_000,
  });

  const minTagCount = minTagCountForDetailLevel(detailLevel);

  const graphData = useMemo(() => {
    if (!edgesQuery.data || !countsQuery.data) return null;
    return buildGraphData(edgesQuery.data, countsQuery.data, isDark, minTagCount);
  }, [edgesQuery.data, countsQuery.data, isDark, minTagCount]);

  return {
    graphData,
    minTagCount,
    isLoading: edgesQuery.isLoading || countsQuery.isLoading,
    isError: edgesQuery.isError || countsQuery.isError,
    error: edgesQuery.error ?? countsQuery.error,
    refetch: () => {
      void edgesQuery.refetch();
      void countsQuery.refetch();
    },
  };
}
