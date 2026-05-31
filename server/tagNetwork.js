const COMMUNITY_COLORS = [
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

const networkCache = new Map();
const CACHE_TTL_MS = 120_000;

function getCommunityColor(community) {
  return COMMUNITY_COLORS[community % COMMUNITY_COLORS.length];
}

function detectCommunities(nodeIds, edges) {
  if (nodeIds.length === 0) return new Map();

  const adjacency = new Map();
  for (const id of nodeIds) adjacency.set(id, new Map());

  let totalWeight = 0;
  for (const { source, target, weight } of edges) {
    if (!adjacency.has(source) || !adjacency.has(target)) continue;
    adjacency.get(source).set(target, weight);
    adjacency.get(target).set(source, weight);
    totalWeight += weight;
  }

  if (totalWeight === 0) {
    const isolated = new Map();
    nodeIds.forEach((id, index) => isolated.set(id, index));
    return isolated;
  }

  const nodeStrength = new Map();
  for (const id of nodeIds) {
    let sum = 0;
    for (const w of adjacency.get(id).values()) sum += w;
    nodeStrength.set(id, sum);
  }

  const community = new Map();
  nodeIds.forEach((id, index) => community.set(id, index));

  const communityStrength = new Map();
  nodeIds.forEach((id, index) => {
    communityStrength.set(index, nodeStrength.get(id) ?? 0);
  });

  const m2 = totalWeight;
  let improved = true;
  let passes = 0;

  while (improved && passes < 10) {
    improved = false;
    passes += 1;

    const shuffled = [...nodeIds].sort(() => Math.random() - 0.5);
    for (const node of shuffled) {
      const currentCommunity = community.get(node);
      const neighbors = adjacency.get(node);
      if (!neighbors || neighbors.size === 0) continue;

      const commWeights = new Map();
      for (const [neighbor, weight] of neighbors) {
        const comm = community.get(neighbor);
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

  const result = new Map();
  for (const [node, comm] of community) {
    result.set(node, remap.get(comm) ?? 0);
  }
  return result;
}

function cross(origin, a, b) {
  return (a.x - origin.x) * (b.y - origin.y) - (a.y - origin.y) * (b.x - origin.x);
}

function convexHull(points) {
  if (points.length <= 2) return points;

  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const lower = [];
  for (const point of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) {
      lower.pop();
    }
    lower.push(point);
  }

  const upper = [];
  for (let i = sorted.length - 1; i >= 0; i -= 1) {
    const point = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) {
      upper.pop();
    }
    upper.push(point);
  }

  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

function expandHull(hull, padding) {
  if (hull.length === 0) return hull;
  const cx = hull.reduce((sum, point) => sum + point.x, 0) / hull.length;
  const cy = hull.reduce((sum, point) => sum + point.y, 0) / hull.length;

  return hull.map((point) => {
    const dx = point.x - cx;
    const dy = point.y - cy;
    const len = Math.hypot(dx, dy) || 1;
    return {
      x: point.x + (dx / len) * padding,
      y: point.y + (dy / len) * padding,
    };
  });
}

function layoutClusteredGraph(nodes) {
  const clusters = new Map();
  for (const node of nodes) {
    if (!clusters.has(node.community)) clusters.set(node.community, []);
    clusters.get(node.community).push(node);
  }

  const clusterEntries = [...clusters.entries()].sort(
    (a, b) => b[1].length - a[1].length,
  );

  const clusterCount = clusterEntries.length;
  if (clusterCount === 0) return [];

  const spreadRadius = Math.max(420, clusterCount * 110);

  clusterEntries.forEach(([, members], index) => {
    const angle = (2 * Math.PI * index) / clusterCount - Math.PI / 2;
    const cx = spreadRadius * Math.cos(angle);
    const cy = spreadRadius * Math.sin(angle);
    const localRadius = 28 + Math.sqrt(members.length) * 14;

    members.forEach((node, memberIndex) => {
      const localAngle = (2 * Math.PI * memberIndex) / members.length;
      const x = cx + localRadius * Math.cos(localAngle);
      const y = cy + localRadius * Math.sin(localAngle);
      node.x = x;
      node.y = y;
      node.fx = x;
      node.fy = y;
    });
  });

  return clusterEntries.map(([communityId, members]) => {
    const points = members.map((node) => ({ x: node.x, y: node.y }));
    const hull = expandHull(convexHull(points), 36);
    return {
      id: communityId,
      color: getCommunityColor(communityId),
      hull,
      nodeCount: members.length,
    };
  });
}

async function buildTagNetworkGraph(db, tagCounts, { minTagCount = 10, minWeight = 2, maxNodes = 100 }) {
  const qualifyingTags = Object.entries(tagCounts)
    .filter(([, count]) => count > minTagCount)
    .sort((a, b) => b[1] - a[1]);

  const cappedTags = new Set(
    qualifyingTags.slice(0, maxNodes).map(([tag]) => tag),
  );

  if (cappedTags.size === 0) {
    return {
      nodes: [],
      links: [],
      clusters: [],
      stats: { tags: 0, links: 0, communities: 0 },
    };
  }

  const allEdges = await db.getTagCoOccurrences({ minWeight, minTagCount: 0, limit: 8000 });
  const links = allEdges.filter(
    (edge) => cappedTags.has(edge.source) && cappedTags.has(edge.target),
  );

  const nodeIds = new Set();
  for (const link of links) {
    nodeIds.add(link.source);
    nodeIds.add(link.target);
  }

  const sortedIds = [...nodeIds].sort(
    (a, b) => (tagCounts[b] ?? 0) - (tagCounts[a] ?? 0),
  );

  const communities = detectCommunities(sortedIds, links);
  const maxCount = Math.max(
    1,
    ...sortedIds.map((id) => tagCounts[id] ?? 0),
  );

  const nodes = sortedIds.map((id) => {
    const community = communities.get(id) ?? 0;
    const count = tagCounts[id] ?? 0;
    return {
      id,
      count,
      community,
      color: getCommunityColor(community),
      val: 5 + (count / maxCount) * 14,
    };
  });

  const clusters = layoutClusteredGraph(nodes);

  return {
    nodes,
    links,
    clusters,
    stats: {
      tags: nodes.length,
      links: links.length,
      communities: clusters.length,
    },
  };
}

async function getTagNetworkGraph(db, options = {}) {
  const minTagCount = options.minTagCount ?? 10;
  const minWeight = options.minWeight ?? 2;
  const maxNodes = options.maxNodes ?? 100;
  const cacheKey = `${minTagCount}:${minWeight}:${maxNodes}`;

  const cached = networkCache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.data;
  }

  const tagCounts = await db.getTagCounts();
  const data = await buildTagNetworkGraph(db, tagCounts, { minTagCount, minWeight, maxNodes });
  networkCache.set(cacheKey, { at: Date.now(), data });
  return data;
}

function invalidateTagNetworkCache() {
  networkCache.clear();
}

module.exports = {
  getTagNetworkGraph,
  invalidateTagNetworkCache,
};
