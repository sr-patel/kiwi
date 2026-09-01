const COMMUNITY_COLORS = [
  '#8b5cf6', '#10b981', '#3b82f6', '#f97316', '#ec4899', '#06b6d4',
  '#eab308', '#6366f1', '#ef4444', '#14b8a6', '#84cc16', '#f43f5e',
];

const GRAPH_VERSION = 2;
const SNAPSHOT_TTL_MS = 10 * 60_000;
const GRAPH_TTL_MS = 30 * 60_000;
const MAX_GRAPH_CACHE_ENTRIES = 12;
const MAX_SNAPSHOT_CACHE_ENTRIES = 4;
const MAX_CANDIDATE_EDGES = 50_000;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

let cacheGeneration = 0;
let databaseCaches = new WeakMap();

function compareText(a, b) {
  return a.localeCompare(b, undefined, { sensitivity: 'base' });
}

function getCommunityColor(community) {
  return COMMUNITY_COLORS[community % COMMUNITY_COLORS.length];
}

function getDatabaseCache(db) {
  let cache = databaseCaches.get(db);
  if (!cache) {
    cache = { snapshots: new Map(), graphs: new Map() };
    databaseCaches.set(db, cache);
  }
  return cache;
}

function pruneMegaTags(tagCounts, totalPhotos, megaTagPct) {
  const pruned = new Set();
  for (const [tag, count] of Object.entries(tagCounts)) {
    if (totalPhotos > 0 && count / totalPhotos > megaTagPct) pruned.add(tag);
  }
  return pruned;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

/** Discount low-support coincidences instead of clustering by raw PMI alone. */
function scoreEdges(rawEdges, tagCounts, totalPhotos, { pmiThreshold, minScore }) {
  if (totalPhotos <= 0) return [];
  const edges = [];

  for (const rawEdge of rawEdges) {
    const source = String(rawEdge.source);
    const target = String(rawEdge.target);
    const weight = Number(rawEdge.weight);
    const countA = tagCounts[source] ?? 0;
    const countB = tagCounts[target] ?? 0;
    if (!Number.isFinite(weight) || weight <= 0 || countA <= 0 || countB <= 0) continue;

    const pa = countA / totalPhotos;
    const pb = countB / totalPhotos;
    const pab = weight / totalPhotos;
    const pmi = Math.log2(pab / (pa * pb));
    if (!Number.isFinite(pmi) || pmi < pmiThreshold) continue;

    const information = -Math.log2(pab);
    const npmi = information > 0 ? clamp(pmi / information, -1, 1) : 1;
    const cosine = clamp(weight / Math.sqrt(countA * countB), 0, 1);
    const overlap = clamp(weight / Math.min(countA, countB), 0, 1);
    const supportReliability = 1 - Math.exp(-weight / 3);
    const score = supportReliability * (0.5 * Math.max(npmi, 0) + 0.3 * cosine + 0.2 * overlap);
    if (score >= minScore) edges.push({ source, target, weight, pmi, npmi, overlap, score });
  }

  return edges.sort((a, b) =>
    b.score - a.score || b.weight - a.weight || compareText(a.source, b.source) || compareText(a.target, b.target));
}

function edgeKey(edge) {
  return edge.source < edge.target ? `${edge.source}\0${edge.target}` : `${edge.target}\0${edge.source}`;
}

function topKSparsify(edges, maxDegree) {
  const byNode = new Map();
  for (const edge of edges) {
    for (const node of [edge.source, edge.target]) {
      if (!byNode.has(node)) byNode.set(node, []);
      byNode.get(node).push(edge);
    }
  }

  const kept = new Set();
  for (const nodeEdges of byNode.values()) {
    nodeEdges.sort((a, b) =>
      b.score - a.score || b.weight - a.weight || compareText(edgeKey(a), edgeKey(b)));
    for (const edge of nodeEdges.slice(0, maxDegree)) kept.add(edgeKey(edge));
  }
  return edges.filter((edge) => kept.has(edgeKey(edge)));
}

function buildAdjacency(nodeIds, edges) {
  const adjacency = new Map(nodeIds.map((id) => [id, new Map()]));
  for (const edge of edges) {
    if (!adjacency.has(edge.source) || !adjacency.has(edge.target)) continue;
    adjacency.get(edge.source).set(edge.target, edge.score);
    adjacency.get(edge.target).set(edge.source, edge.score);
  }
  return adjacency;
}

/** Stable traversal and tie-breaking make communities repeatable across restarts. */
function detectCommunities(nodeIds, edges) {
  if (nodeIds.length === 0) return new Map();
  const adjacency = buildAdjacency(nodeIds, edges);
  const strength = new Map();
  let totalStrength = 0;
  for (const id of nodeIds) {
    const value = [...adjacency.get(id).values()].reduce((sum, weight) => sum + weight, 0);
    strength.set(id, value);
    totalStrength += value;
  }

  const orderedNodes = [...nodeIds].sort((a, b) =>
    (strength.get(b) ?? 0) - (strength.get(a) ?? 0) || compareText(a, b));
  const community = new Map(nodeIds.map((id, index) => [id, index]));
  const communityStrength = new Map(nodeIds.map((id, index) => [index, strength.get(id) ?? 0]));
  const resolution = 1.08;

  if (totalStrength > 0) {
    for (let pass = 0; pass < 16; pass += 1) {
      let moved = false;
      for (const node of orderedNodes) {
        const nodeStrength = strength.get(node) ?? 0;
        if (nodeStrength === 0) continue;
        const current = community.get(node);
        communityStrength.set(current, (communityStrength.get(current) ?? 0) - nodeStrength);
        const weightsByCommunity = new Map([[current, 0]]);
        for (const [neighbor, weight] of adjacency.get(node)) {
          const candidate = community.get(neighbor);
          weightsByCommunity.set(candidate, (weightsByCommunity.get(candidate) ?? 0) + weight);
        }

        let best = current;
        let bestGain = -Infinity;
        for (const candidate of [...weightsByCommunity.keys()].sort((a, b) => a - b)) {
          const insideWeight = weightsByCommunity.get(candidate) ?? 0;
          const gain = insideWeight -
            (resolution * nodeStrength * (communityStrength.get(candidate) ?? 0)) / totalStrength;
          if (gain > bestGain + 1e-12 || (Math.abs(gain - bestGain) <= 1e-12 && candidate < best)) {
            best = candidate;
            bestGain = gain;
          }
        }
        community.set(node, best);
        communityStrength.set(best, (communityStrength.get(best) ?? 0) + nodeStrength);
        if (best !== current) moved = true;
      }
      if (!moved) break;
    }
  }

  const isolated = [];
  const groups = new Map();
  for (const id of nodeIds) {
    const key = community.get(id);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(id);
  }
  for (const members of groups.values()) {
    if (members.length >= 3) continue;
    const neighbourWeights = new Map();
    for (const member of members) {
      for (const [neighbor, weight] of adjacency.get(member)) {
        const candidate = community.get(neighbor);
        if (candidate !== community.get(member)) {
          neighbourWeights.set(candidate, (neighbourWeights.get(candidate) ?? 0) + weight);
        }
      }
    }
    const bestNeighbour = [...neighbourWeights.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0];
    if (bestNeighbour === undefined) isolated.push(...members);
    else for (const member of members) community.set(member, bestNeighbour);
  }
  if (isolated.length > 0) {
    const isolatedCommunity = Math.max(-1, ...community.values()) + 1;
    for (const id of isolated) community.set(id, isolatedCommunity);
  }
  return community;
}

function remapCommunities(community, nodeIds, tagCounts) {
  const groups = new Map();
  for (const id of nodeIds) {
    const key = community.get(id);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(id);
  }
  const ordered = [...groups.entries()].sort((a, b) => {
    const totalA = a[1].reduce((sum, id) => sum + (tagCounts[id] ?? 0), 0);
    const totalB = b[1].reduce((sum, id) => sum + (tagCounts[id] ?? 0), 0);
    return totalB - totalA || compareText([...a[1]].sort(compareText)[0], [...b[1]].sort(compareText)[0]);
  });
  const remap = new Map(ordered.map(([oldId], index) => [oldId, index]));
  return new Map(nodeIds.map((id) => [id, remap.get(community.get(id)) ?? 0]));
}

function splitLinksByCommunity(links, communities) {
  const linksInCommunity = [];
  const linksBetweenCommunities = [];
  for (const link of links) {
    if (communities.get(link.source) === communities.get(link.target)) linksInCommunity.push(link);
    else linksBetweenCommunities.push(link);
  }
  return { linksInCommunity, linksBetweenCommunities };
}

function nodeRadius(node) {
  return 6 + Math.sqrt(Math.max(node.val, 1)) * 2;
}

function createCircleHull(cx, cy, radius, pointCount = 28) {
  return Array.from({ length: pointCount }, (_, index) => {
    const angle = (index / pointCount) * Math.PI * 2;
    return { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius };
  });
}

function layoutCommunityMembers(members) {
  const ordered = [...members].sort((a, b) =>
    b.strength - a.strength || b.count - a.count || compareText(a.id, b.id));
  let radius = 72;
  ordered.forEach((node, index) => {
    if (index === 0) {
      node.x = 0;
      node.y = 0;
    } else {
      const angle = index * GOLDEN_ANGLE;
      const distance = 38 + Math.sqrt(index) * 42;
      node.x = Math.cos(angle) * distance;
      node.y = Math.sin(angle) * distance;
    }
    radius = Math.max(radius, Math.hypot(node.x, node.y) + nodeRadius(node) + 46);
  });
  return radius;
}

function placeClusters(clusterEntries) {
  const placed = [];
  for (let index = 0; index < clusterEntries.length; index += 1) {
    const entry = clusterEntries[index];
    let cx = 0;
    let cy = 0;
    if (index > 0) {
      for (let attempt = 1; attempt <= 2_000; attempt += 1) {
        const angle = attempt * GOLDEN_ANGLE;
        const distance = 72 * Math.sqrt(attempt) + entry.radius;
        const candidateX = Math.cos(angle) * distance;
        const candidateY = Math.sin(angle) * distance;
        const overlaps = placed.some((item) =>
          Math.hypot(item.cx - candidateX, item.cy - candidateY) < item.radius + entry.radius + 96);
        if (!overlaps) {
          cx = candidateX;
          cy = candidateY;
          break;
        }
      }
    }
    entry.cx = cx;
    entry.cy = cy;
    placed.push(entry);
  }
}

function layoutGraph(nodes) {
  const byCommunity = new Map();
  for (const node of nodes) {
    if (!byCommunity.has(node.community)) byCommunity.set(node.community, []);
    byCommunity.get(node.community).push(node);
  }
  const entries = [...byCommunity.entries()].map(([id, members]) => {
    const radius = layoutCommunityMembers(members);
    const totalItems = members.reduce((sum, node) => sum + node.count, 0);
    const topTag = [...members].sort((a, b) =>
      b.count - a.count || b.strength - a.strength || compareText(a.id, b.id))[0];
    return { id, members, radius, totalItems, topTag, cx: 0, cy: 0 };
  });
  entries.sort((a, b) => b.totalItems - a.totalItems || compareText(a.topTag.id, b.topTag.id));
  placeClusters(entries);

  return entries.map((entry) => {
    for (const node of entry.members) {
      node.x += entry.cx;
      node.y += entry.cy;
      node.fx = node.x;
      node.fy = node.y;
    }
    return {
      id: entry.id,
      color: getCommunityColor(entry.id),
      hull: createCircleHull(entry.cx, entry.cy, entry.radius),
      nodeCount: entry.members.length,
      label: entry.topTag.id,
      labelCount: entry.topTag.count,
      totalItems: entry.totalItems,
      radius: entry.radius,
      cx: entry.cx,
      cy: entry.cy,
    };
  });
}

async function loadSnapshot(db, minWeight) {
  const cache = getDatabaseCache(db);
  const now = Date.now();
  const existing = cache.snapshots.get(minWeight);
  if (existing?.data && existing.expiresAt > now) {
    existing.lastAccess = now;
    return existing.data;
  }
  if (existing?.promise) return existing.promise;

  const requestedGeneration = cacheGeneration;
  const promise = Promise.all([
    db.getTagCounts(),
    db.getPhotoCount(),
    db.getTagCoOccurrences({ minWeight, minTagCount: 0, limit: MAX_CANDIDATE_EDGES }),
  ]).then(([tagCounts, totalPhotos, rawEdges]) => {
    const data = { tagCounts, totalPhotos, rawEdges };
    if (requestedGeneration === cacheGeneration) {
      cache.snapshots.set(minWeight, {
        data,
        expiresAt: Date.now() + SNAPSHOT_TTL_MS,
        lastAccess: Date.now(),
      });
      trimCache(cache.snapshots, MAX_SNAPSHOT_CACHE_ENTRIES);
    }
    return data;
  });
  cache.snapshots.set(minWeight, { promise, expiresAt: now + SNAPSHOT_TTL_MS, lastAccess: now });
  trimCache(cache.snapshots, MAX_SNAPSHOT_CACHE_ENTRIES);
  try {
    return await promise;
  } catch (error) {
    cache.snapshots.delete(minWeight);
    throw error;
  }
}

function emptyGraph(prunedMegaTags, buildMs) {
  return {
    version: GRAPH_VERSION,
    generatedAt: new Date().toISOString(),
    nodes: [], links: [], interLinks: [], clusters: [],
    stats: { tags: 0, links: 0, interLinks: 0, communities: 0, prunedMegaTags,
      candidateLinks: 0, buildMs },
  };
}

async function buildTagNetworkGraph(snapshot, options = {}) {
  const startedAt = Date.now();
  const { minTagCount = 10, maxNodes = 100, megaTagPct = 0.35,
    pmiThreshold = 0.5, minScore = 0.12, maxDegree = 6 } = options;
  const { tagCounts, totalPhotos, rawEdges } = snapshot;
  const megaTags = pruneMegaTags(tagCounts, totalPhotos, megaTagPct);
  const qualifyingTags = Object.entries(tagCounts)
    .filter(([tag, count]) => count >= minTagCount && !megaTags.has(tag))
    .sort((a, b) => b[1] - a[1] || compareText(a[0], b[0]))
    .slice(0, maxNodes);
  if (qualifyingTags.length === 0) return emptyGraph(megaTags.size, Date.now() - startedAt);

  const cappedTags = new Set(qualifyingTags.map(([tag]) => tag));
  const candidateEdges = rawEdges.filter((edge) => cappedTags.has(edge.source) && cappedTags.has(edge.target));
  const scoredEdges = scoreEdges(candidateEdges, tagCounts, totalPhotos, { pmiThreshold, minScore });
  const sparseEdges = topKSparsify(scoredEdges, maxDegree);
  const nodeIds = qualifyingTags.map(([tag]) => tag);
  const communities = remapCommunities(detectCommunities(nodeIds, sparseEdges), nodeIds, tagCounts);
  const adjacency = buildAdjacency(nodeIds, sparseEdges);
  const maxCount = Math.max(1, ...qualifyingTags.map(([, count]) => count));

  const nodes = nodeIds.map((id, rank) => {
    const weights = [...adjacency.get(id).values()];
    const strength = weights.reduce((sum, value) => sum + value, 0);
    const community = communities.get(id) ?? 0;
    return { id, count: tagCounts[id] ?? 0, community, color: getCommunityColor(community),
      val: 4 + Math.pow((tagCounts[id] ?? 0) / maxCount, 0.55) * 24,
      degree: weights.length, strength, rank: rank + 1, x: 0, y: 0, fx: 0, fy: 0 };
  });
  const { linksInCommunity, linksBetweenCommunities } = splitLinksByCommunity(sparseEdges, communities);
  const clusters = layoutGraph(nodes);
  return {
    version: GRAPH_VERSION,
    generatedAt: new Date().toISOString(),
    nodes, links: linksInCommunity, interLinks: linksBetweenCommunities, clusters,
    stats: { tags: nodes.length, links: linksInCommunity.length,
      interLinks: linksBetweenCommunities.length, communities: clusters.length,
      prunedMegaTags: megaTags.size, candidateLinks: candidateEdges.length,
      buildMs: Date.now() - startedAt },
  };
}

function graphCacheKey(options) {
  return [GRAPH_VERSION, options.minTagCount ?? 10, options.minWeight ?? 2,
    options.maxNodes ?? 100, options.megaTagPct ?? 0.35, options.pmiThreshold ?? 0.5,
    options.minScore ?? 0.12, options.maxDegree ?? 6].join(':');
}

function trimCache(cache, maximumEntries) {
  while (cache.size > maximumEntries) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].lastAccess - b[1].lastAccess)[0];
    if (!oldest) break;
    cache.delete(oldest[0]);
  }
}

async function getTagNetworkGraph(db, options = {}) {
  const cache = getDatabaseCache(db);
  const key = graphCacheKey(options);
  const now = Date.now();
  const existing = cache.graphs.get(key);
  if (existing?.data && existing.expiresAt > now) {
    existing.lastAccess = now;
    return existing.data;
  }
  if (existing?.promise) return existing.promise;

  const requestedGeneration = cacheGeneration;
  const promise = loadSnapshot(db, options.minWeight ?? 2)
    .then((snapshot) => buildTagNetworkGraph(snapshot, options));
  cache.graphs.set(key, { promise, expiresAt: now + GRAPH_TTL_MS, lastAccess: now });
  trimCache(cache.graphs, MAX_GRAPH_CACHE_ENTRIES);
  try {
    const data = await promise;
    if (requestedGeneration === cacheGeneration) {
      cache.graphs.set(key, { data, expiresAt: Date.now() + GRAPH_TTL_MS, lastAccess: Date.now() });
      trimCache(cache.graphs, MAX_GRAPH_CACHE_ENTRIES);
    }
    return data;
  } catch (error) {
    cache.graphs.delete(key);
    throw error;
  }
}

function invalidateTagNetworkCache() {
  cacheGeneration += 1;
  databaseCaches = new WeakMap();
}

module.exports = {
  getTagNetworkGraph,
  invalidateTagNetworkCache,
  __test: { buildTagNetworkGraph, detectCommunities, pruneMegaTags, scoreEdges, topKSparsify },
};
