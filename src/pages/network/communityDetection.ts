import type { TagCoOccurrenceEdge } from './types';

/**
 * Lightweight greedy modularity community detection (Louvain-inspired phase 1).
 * Suitable for tag graphs with typically fewer than 500 nodes.
 */
export function detectCommunities(
  nodeIds: string[],
  edges: TagCoOccurrenceEdge[],
): Map<string, number> {
  if (nodeIds.length === 0) return new Map();

  const adjacency = new Map<string, Map<string, number>>();
  for (const id of nodeIds) {
    adjacency.set(id, new Map());
  }

  let totalWeight = 0;
  for (const { source, target, weight } of edges) {
    if (!adjacency.has(source) || !adjacency.has(target)) continue;
    adjacency.get(source)!.set(target, weight);
    adjacency.get(target)!.set(source, weight);
    totalWeight += weight;
  }

  if (totalWeight === 0) {
    const isolated = new Map<string, number>();
    nodeIds.forEach((id, index) => isolated.set(id, index));
    return isolated;
  }

  const nodeStrength = new Map<string, number>();
  for (const id of nodeIds) {
    let sum = 0;
    for (const weight of adjacency.get(id)!.values()) sum += weight;
    nodeStrength.set(id, sum);
  }

  const community = new Map<string, number>();
  nodeIds.forEach((id, index) => community.set(id, index));

  const communityStrength = new Map<number, number>();
  nodeIds.forEach((id, index) => {
    communityStrength.set(index, nodeStrength.get(id) ?? 0);
  });

  const m2 = totalWeight;
  let improved = true;
  let passes = 0;

  while (improved && passes < 12) {
    improved = false;
    passes += 1;

    const shuffled = [...nodeIds].sort(() => Math.random() - 0.5);
    for (const node of shuffled) {
      const currentCommunity = community.get(node)!;
      const neighbors = adjacency.get(node)!;
      if (neighbors.size === 0) continue;

      const commWeights = new Map<number, number>();
      for (const [neighbor, weight] of neighbors) {
        const comm = community.get(neighbor)!;
        commWeights.set(comm, (commWeights.get(comm) ?? 0) + weight);
      }

      const ki = nodeStrength.get(node) ?? 0;
      let bestCommunity = currentCommunity;
      let bestGain = 0;

      for (const [candidate, kiIn] of commWeights) {
        if (candidate === currentCommunity) continue;
        const sigmaTot = communityStrength.get(candidate) ?? 0;
        const gain = kiIn - (sigmaTot * ki) / m2;
        if (gain > bestGain) {
          bestGain = gain;
          bestCommunity = candidate;
        }
      }

      if (bestCommunity !== currentCommunity && bestGain > 0) {
        communityStrength.set(
          currentCommunity,
          (communityStrength.get(currentCommunity) ?? 0) - ki,
        );
        communityStrength.set(
          bestCommunity,
          (communityStrength.get(bestCommunity) ?? 0) + ki,
        );
        community.set(node, bestCommunity);
        improved = true;
      }
    }
  }

  const uniqueCommunities = [...new Set(community.values())];
  const remap = new Map(uniqueCommunities.map((value, index) => [value, index]));

  const result = new Map<string, number>();
  for (const [node, comm] of community) {
    result.set(node, remap.get(comm) ?? 0);
  }
  return result;
}

export const COMMUNITY_COLORS = [
  '#a855f7',
  '#22c55e',
  '#3b82f6',
  '#f97316',
  '#ec4899',
  '#14b8a6',
  '#eab308',
  '#6366f1',
  '#ef4444',
  '#06b6d4',
  '#84cc16',
  '#f43f5e',
];

export function getCommunityColor(community: number, isDark: boolean): string {
  const base = COMMUNITY_COLORS[community % COMMUNITY_COLORS.length];
  if (isDark) return base;
  return base;
}
