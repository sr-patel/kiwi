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

/** Tags appearing on more than this fraction of tagged photos are treated as stop-words */
const DEFAULT_MAX_TAG_COVERAGE = 0.1;

/** Drop the top N% most frequent tags (they connect everything) */
const DEFAULT_TOP_TAG_PERCENTILE = 0.05;

/** Max edges kept per node after PMI ranking */
const MAX_EDGES_PER_NODE = 6;

/** Minimum PMI score for an edge to be kept */
const MIN_PMI = 1.5;

function getCommunityColor(community) {
  return COMMUNITY_COLORS[community % COMMUNITY_COLORS.length];
}

/**
 * Remove ultra-common tags that appear on a large % of the library.
 */
function filterStopTags(tagCounts, taggedPhotoCount, topPercentile = DEFAULT_TOP_TAG_PERCENTILE, maxCoverage = DEFAULT_MAX_TAG_COVERAGE) {
  const entries = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0 || taggedPhotoCount === 0) {
    return { allowed: new Set(), excluded: 0 };
  }

  const topCutIndex = Math.max(1, Math.ceil(entries.length * topPercentile));
  const topCutThreshold = entries[topCutIndex - 1][1];

  const allowed = new Set();
  let excluded = 0;

  for (const [tag, count] of entries) {
    const coverage = count / taggedPhotoCount;
    if (coverage > maxCoverage) {
      excluded += 1;
      continue;
    }
    if (count >= topCutThreshold) {
      excluded += 1;
      continue;
    }
    allowed.add(tag);
  }

  return { allowed, excluded };
}

/**
 * PMI highlights pairs that co-occur more than chance — not just frequent tags together.
 */
function computePmiEdges(rawEdges, tagCounts, taggedPhotoCount, allowedTags) {
  if (taggedPhotoCount === 0) return [];

  const scored = [];
  for (const { source, target, weight } of rawEdges) {
    if (!allowedTags.has(source) || !allowedTags.has(target)) continue;

    const countA = tagCounts[source] ?? 0;
    const countB = tagCounts[target] ?? 0;
    if (countA === 0 || countB === 0 || weight < 2) continue;

    const pmi = Math.log2((weight * taggedPhotoCount) / (countA * countB));
    if (pmi < MIN_PMI) continue;

    scored.push({ source, target, weight, pmi });
  }

  return scored.sort((a, b) => b.pmi - a.pmi);
}

/**
 * Keep only the strongest PMI edges per node to avoid hairballs.
 */
function sparsifyEdges(edges, maxPerNode = MAX_EDGES_PER_NODE) {
  const byNode = new Map();

  for (const edge of edges) {
    for (const nodeId of [edge.source, edge.target]) {
      if (!byNode.has(nodeId)) byNode.set(nodeId, []);
      byNode.get(nodeId).push(edge);
    }
  }

  const kept = new Set();
  for (const nodeEdges of byNode.values()) {
    nodeEdges.sort((a, b) => b.pmi - a.pmi);
    for (const edge of nodeEdges.slice(0, maxPerNode)) {
      kept.add(`${edge.source}\0${edge.target}`);
    }
  }

  return edges.filter((e) => kept.has(`${e.source}\0${e.target}`));
}

/**
 * Connected components — each component becomes one visual cluster.
 */
function findConnectedComponents(nodeIds, edges) {
  const parent = new Map();
  for (const id of nodeIds) parent.set(id, id);

  function find(x) {
    let root = x;
    while (parent.get(root) !== root) root = parent.get(root);
    let current = x;
    while (parent.get(current) !== root) {
      const next = parent.get(current);
      parent.set(current, root);
      current = next;
    }
    return root;
  }

  function union(a, b) {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  }

  for (const { source, target } of edges) {
    union(source, target);
  }

  const components = new Map();
  for (const id of nodeIds) {
    const root = find(id);
    if (!components.has(root)) components.set(root, []);
    components.get(root).push(id);
  }

  const sorted = [...components.values()].sort((a, b) => b.length - a.length);
  const communityMap = new Map();
  sorted.forEach((members, communityId) => {
    for (const id of members) communityMap.set(id, communityId);
  });

  return communityMap;
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

/**
 * Pack clusters on a grid with generous spacing — no mega-circle hairball.
 */
function layoutGridClusters(nodes) {
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

  const cols = Math.ceil(Math.sqrt(clusterCount));
  const cellSize = 220;
  const gap = 80;

  clusterEntries.forEach(([, members], index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const cx = col * (cellSize + gap) - ((cols - 1) * (cellSize + gap)) / 2;
    const cy = row * (cellSize + gap) - ((Math.ceil(clusterCount / cols) - 1) * (cellSize + gap)) / 2;

    const localRadius = 20 + Math.sqrt(members.length) * 16;

    members.forEach((node, memberIndex) => {
      const localAngle = (2 * Math.PI * memberIndex) / members.length - Math.PI / 2;
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
    const hull = expandHull(convexHull(points), 32);
    return {
      id: communityId,
      color: getCommunityColor(communityId),
      hull,
      nodeCount: members.length,
    };
  });
}

async function buildTagNetworkGraph(db, tagCounts, options = {}) {
  const {
    minTagCount = 10,
    minWeight = 2,
    maxNodes = 100,
    maxTagCoverage = DEFAULT_MAX_TAG_COVERAGE,
    topTagPercentile = DEFAULT_TOP_TAG_PERCENTILE,
  } = options;

  const taggedPhotoCount = db.getTaggedPhotoCount();
  const { allowed: allowedTags, excluded: excludedStopTags } = filterStopTags(
    tagCounts,
    taggedPhotoCount,
    topTagPercentile,
    maxTagCoverage,
  );

  const qualifyingTags = [...allowedTags]
    .filter((tag) => (tagCounts[tag] ?? 0) > minTagCount)
    .sort((a, b) => (tagCounts[b] ?? 0) - (tagCounts[a] ?? 0))
    .slice(0, maxNodes);

  const cappedTags = new Set(qualifyingTags);

  if (cappedTags.size === 0) {
    return {
      nodes: [],
      links: [],
      clusters: [],
      stats: { tags: 0, links: 0, communities: 0, excludedStopTags },
    };
  }

  const allEdges = await db.getTagCoOccurrences({ minWeight, minTagCount: 0, limit: 12000 });
  const pmiEdges = computePmiEdges(allEdges, tagCounts, taggedPhotoCount, cappedTags);
  const sparseEdges = sparsifyEdges(pmiEdges);

  const nodeIds = new Set();
  for (const link of sparseEdges) {
    nodeIds.add(link.source);
    nodeIds.add(link.target);
  }

  const sortedIds = [...nodeIds].sort(
    (a, b) => (tagCounts[b] ?? 0) - (tagCounts[a] ?? 0),
  );

  const communities = findConnectedComponents(sortedIds, sparseEdges);

  // Only draw edges within the same cluster — eliminates cross-cluster hairball
  const links = sparseEdges.filter(
    (edge) => communities.get(edge.source) === communities.get(edge.target),
  );

  const maxCount = Math.max(1, ...sortedIds.map((id) => tagCounts[id] ?? 0));

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

  const clusters = layoutGridClusters(nodes);

  return {
    nodes,
    links,
    clusters,
    stats: {
      tags: nodes.length,
      links: links.length,
      communities: clusters.length,
      excludedStopTags,
    },
  };
}

async function getTagNetworkGraph(db, options = {}) {
  const minTagCount = options.minTagCount ?? 10;
  const minWeight = options.minWeight ?? 2;
  const maxNodes = options.maxNodes ?? 100;
  const maxTagCoverage = options.maxTagCoverage ?? DEFAULT_MAX_TAG_COVERAGE;
  const topTagPercentile = options.topTagPercentile ?? DEFAULT_TOP_TAG_PERCENTILE;
  const cacheKey = `${minTagCount}:${minWeight}:${maxNodes}:${maxTagCoverage}:${topTagPercentile}`;

  const cached = networkCache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.data;
  }

  const tagCounts = await db.getTagCounts();
  const data = await buildTagNetworkGraph(db, tagCounts, {
    minTagCount,
    minWeight,
    maxNodes,
    maxTagCoverage,
    topTagPercentile,
  });
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
