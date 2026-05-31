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

async function fetchCoOccurrences(): Promise<TagCoOccurrenceEdge[]> {
  const res = await fetchWithRetry('/api/tags/co-occurrences?minWeight=2&limit=5000');
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
): TagGraphData & { forceGraph: ForceGraphData } {
  const degree = new Map<string, number>();
  const nodeIds = new Set<string>(Object.keys(tagCounts));

  for (const edge of edges) {
    nodeIds.add(edge.source);
    nodeIds.add(edge.target);
    degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1);
    degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1);
  }

  const sortedIds = [...nodeIds].sort(
    (a, b) => (tagCounts[b] ?? 0) - (tagCounts[a] ?? 0),
  );

  const communities = detectCommunities(sortedIds, edges);

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

  const links = edges.map((edge) => ({
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

export function useTagCoOccurrences(isDark: boolean) {
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

  const graphData = useMemo(() => {
    if (!edgesQuery.data || !countsQuery.data) return null;
    return buildGraphData(edgesQuery.data, countsQuery.data, isDark);
  }, [edgesQuery.data, countsQuery.data, isDark]);

  return {
    graphData,
    isLoading: edgesQuery.isLoading || countsQuery.isLoading,
    isError: edgesQuery.isError || countsQuery.isError,
    error: edgesQuery.error ?? countsQuery.error,
    refetch: () => {
      void edgesQuery.refetch();
      void countsQuery.refetch();
    },
  };
}
