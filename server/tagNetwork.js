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

function pruneMegaTags(tagCounts, totalPhotos, megaTagPct) {
  const pruned = new Set();
  for (const [tag, count] of Object.entries(tagCounts)) {
    if (totalPhotos > 0 && count / totalPhotos > megaTagPct) {
      pruned.add(tag);
    }
  }
  return pruned;
}

function computePMIEdges(rawEdges, tagCounts, totalPhotos, pmiThreshold) {
  if (totalPhotos <= 0) return [];

  const edges = [];
  for (const { source, target, weight } of rawEdges) {
    const countA = tagCounts[source] ?? 0;
    const countB = tagCounts[target] ?? 0;
    if (countA === 0 || countB === 0) continue;

    const pa = countA / totalPhotos;
    const pb = countB / totalPhotos;
    const pab = weight / totalPhotos;
    const joint = pa * pb;
    if (joint <= 0 || pab <= 0) continue;

    const pmi = Math.log2(pab / joint);
    if (pmi >= pmiThreshold) {
      edges.push({ source, target, weight, pmi });
    }
  }
  return edges;
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
    nodeEdges.sort((a, b) => b.pmi - a.pmi);
    for (const edge of nodeEdges.slice(0, maxDegree)) {
      kept.add(`${edge.source}\0${edge.target}`);
    }
  }

  return edges.filter((edge) => kept.has(`${edge.source}\0${edge.target}`));
}

function detectCommunities(nodeIds, edges) {
  if (nodeIds.length === 0) return new Map();

  const adjacency = new Map();
  for (const id of nodeIds) adjacency.set(id, new Map());

  let totalWeight = 0;
  for (const edge of edges) {
    const weight = edge.pmi ?? edge.weight;
    if (!adjacency.has(edge.source) || !adjacency.has(edge.target)) continue;
    adjacency.get(edge.source).set(edge.target, weight);
    adjacency.get(edge.target).set(edge.source, weight);
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

function splitLinksByCommunity(links, communities) {
  const intraLinks = [];
  const interLinks = [];

  for (const link of links) {
    const sourceCommunity = communities.get(link.source);
    const targetCommunity = communities.get(link.target);
    if (sourceCommunity === targetCommunity) {
      intraLinks.push(link);
    } else {
      interLinks.push(link);
    }
  }

  return { intraLinks, interLinks };
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

function buildClusterAffinities(clusterIds, interLinks, communities) {
  const affinities = new Map();
  for (const link of interLinks) {
    const sourceCommunity = communities.get(link.source);
    const targetCommunity = communities.get(link.target);
    if (sourceCommunity === undefined || targetCommunity === undefined) continue;
    if (sourceCommunity === targetCommunity) continue;
    const key =
      sourceCommunity < targetCommunity
        ? `${sourceCommunity}:${targetCommunity}`
        : `${targetCommunity}:${sourceCommunity}`;
    affinities.set(key, (affinities.get(key) ?? 0) + (link.pmi ?? 1));
  }
  return affinities;
}

function layoutClusterCenters(clusterIds, affinities, clusterRadii) {
  const positions = new Map();
  const count = clusterIds.length;
  const spreadScale = Math.max(1.3, Math.sqrt(count) * 0.7);
  const baseRadius = 260 * spreadScale;

  clusterIds.forEach((id, index) => {
    const angle = (2 * Math.PI * index) / Math.max(count, 1) + (Math.random() - 0.5) * 0.35;
    const radius = baseRadius + Math.random() * baseRadius * 0.35;
    positions.set(id, {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      vx: 0,
      vy: 0,
    });
  });

  const minGap = 100;
  const repulsionStrength = 28000;

  for (let iteration = 0; iteration < 120; iteration += 1) {
    for (let i = 0; i < count; i += 1) {
      for (let j = i + 1; j < count; j += 1) {
        const a = positions.get(clusterIds[i]);
        const b = positions.get(clusterIds[j]);
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let dist = Math.hypot(dx, dy) || 0.01;

        const radiusA = clusterRadii.get(clusterIds[i]) ?? 70;
        const radiusB = clusterRadii.get(clusterIds[j]) ?? 70;
        const minDist = radiusA + radiusB + minGap;

        if (dist < minDist) {
          const overlap = (minDist - dist) / minDist;
          const push = overlap * 2.5 + repulsionStrength / (dist * dist);
          dx = (dx / dist) * push;
          dy = (dy / dist) * push;
        } else {
          const force = repulsionStrength / (dist * dist);
          dx = (dx / dist) * force;
          dy = (dy / dist) * force;
        }

        a.vx -= dx;
        a.vy -= dy;
        b.vx += dx;
        b.vy += dy;
      }
    }

    for (const [key, weight] of affinities) {
      const [sourceCommunity, targetCommunity] = key.split(':').map(Number);
      const a = positions.get(sourceCommunity);
      const b = positions.get(targetCommunity);
      if (!a || !b) continue;

      let dx = b.x - a.x;
      let dy = b.y - a.y;
      const dist = Math.hypot(dx, dy) || 0.01;

      const radiusA = clusterRadii.get(sourceCommunity) ?? 70;
      const radiusB = clusterRadii.get(targetCommunity) ?? 70;
      const minDist = radiusA + radiusB + minGap * 0.6;
      const target = Math.max(minDist, 600 / (1 + weight * 0.12));
      const force = (dist - target) * 0.012 * Math.min(weight, 16);
      dx = (dx / dist) * force;
      dy = (dy / dist) * force;
      a.vx += dx;
      a.vy += dy;
      b.vx -= dx;
      b.vy -= dy;
    }

    for (const id of clusterIds) {
      const point = positions.get(id);
      point.vx -= point.x * 0.0008;
      point.vy -= point.y * 0.0008;
      point.x += point.vx * 0.35;
      point.y += point.vy * 0.35;
      point.vx *= 0.82;
      point.vy *= 0.82;
    }
  }

  return positions;
}

function estimateClusterRadius(memberCount) {
  return 55 + Math.sqrt(memberCount) * 24;
}

function layoutCommunityNodes(members, intraLinks, centerX, centerY) {
  const positions = new Map();
  const memberIds = new Set(members.map((node) => node.id));

  members.forEach((node, index) => {
    const angle = (2 * Math.PI * index) / Math.max(members.length, 1);
    const radius = 28 + Math.sqrt(members.length) * 14;
    positions.set(node.id, {
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
      vx: 0,
      vy: 0,
    });
  });

  const localEdges = intraLinks.filter(
    (edge) => memberIds.has(edge.source) && memberIds.has(edge.target),
  );

  for (let iteration = 0; iteration < 50; iteration += 1) {
    for (let i = 0; i < members.length; i += 1) {
      for (let j = i + 1; j < members.length; j += 1) {
        const a = positions.get(members[i].id);
        const b = positions.get(members[j].id);
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        const dist = Math.hypot(dx, dy) || 0.01;
        const repulse = 1400 / (dist * dist);
        dx = (dx / dist) * repulse;
        dy = (dy / dist) * repulse;
        a.vx -= dx;
        a.vy -= dy;
        b.vx += dx;
        b.vy += dy;
      }
    }

    for (const edge of localEdges) {
      const a = positions.get(edge.source);
      const b = positions.get(edge.target);
      if (!a || !b) continue;

      let dx = b.x - a.x;
      let dy = b.y - a.y;
      const dist = Math.hypot(dx, dy) || 0.01;
      const target = 36 + (edge.pmi ?? 1) * 4;
      const force = (dist - target) * 0.04 * Math.max(edge.pmi ?? 1, 0.5);
      dx = (dx / dist) * force;
      dy = (dy / dist) * force;
      a.vx += dx;
      a.vy += dy;
      b.vx -= dx;
      b.vy -= dy;
    }

    for (const node of members) {
      const point = positions.get(node.id);
      point.vx += (centerX - point.x) * 0.015;
      point.vy += (centerY - point.y) * 0.015;
      point.x += point.vx * 0.25;
      point.y += point.vy * 0.25;
      point.vx *= 0.82;
      point.vy *= 0.82;
    }
  }

  for (const node of members) {
    const point = positions.get(node.id);
    node.x = point.x;
    node.y = point.y;
    node.fx = point.x;
    node.fy = point.y;
  }
}

function layoutClusteredGraph(nodes, intraLinks, interLinks, communities) {
  const clusters = new Map();
  for (const node of nodes) {
    if (!clusters.has(node.community)) clusters.set(node.community, []);
    clusters.get(node.community).push(node);
  }

  const clusterIds = [...clusters.keys()];
  if (clusterIds.length === 0) return [];

  const clusterRadii = new Map(
    [...clusters.entries()].map(([communityId, members]) => [
      communityId,
      estimateClusterRadius(members.length),
    ]),
  );

  const affinities = buildClusterAffinities(clusterIds, interLinks, communities);
  const centers = layoutClusterCenters(clusterIds, affinities, clusterRadii);

  for (const [communityId, members] of clusters.entries()) {
    const center = centers.get(communityId) ?? { x: 0, y: 0 };
    layoutCommunityNodes(members, intraLinks, center.x, center.y);
  }

  return [...clusters.entries()].map(([communityId, members]) => {
    const topTag = members.reduce(
      (best, node) => (node.count > best.count ? node : best),
      members[0],
    );
    const points = members.map((node) => ({ x: node.x, y: node.y }));
    const hull = expandHull(convexHull(points), 55);
    const cx = members.reduce((sum, node) => sum + node.x, 0) / members.length;
    const cy = members.reduce((sum, node) => sum + node.y, 0) / members.length;

    return {
      id: communityId,
      color: getCommunityColor(communityId),
      hull,
      nodeCount: members.length,
      label: topTag.id,
      labelCount: topTag.count,
      cx,
      cy,
    };
  });
}

async function buildTagNetworkGraph(db, tagCounts, totalPhotos, options = {}) {
  const {
    minTagCount = 10,
    minWeight = 2,
    maxNodes = 100,
    megaTagPct = 0.35,
    pmiThreshold = 1.0,
    maxDegree = 6,
  } = options;

  const megaTags = pruneMegaTags(tagCounts, totalPhotos, megaTagPct);

  const qualifyingTags = Object.entries(tagCounts)
    .filter(([tag, count]) => count > minTagCount && !megaTags.has(tag))
    .sort((a, b) => b[1] - a[1]);

  const cappedTags = new Set(
    qualifyingTags.slice(0, maxNodes).map(([tag]) => tag),
  );

  if (cappedTags.size === 0) {
    return {
      nodes: [],
      links: [],
      interLinks: [],
      clusters: [],
      stats: {
        tags: 0,
        links: 0,
        interLinks: 0,
        communities: 0,
        prunedMegaTags: megaTags.size,
      },
    };
  }

  const allEdges = await db.getTagCoOccurrences({ minWeight, minTagCount: 0, limit: 12000 });
  const filteredRaw = allEdges.filter(
    (edge) =>
      cappedTags.has(edge.source) &&
      cappedTags.has(edge.target) &&
      !megaTags.has(edge.source) &&
      !megaTags.has(edge.target),
  );

  const pmiEdges = computePMIEdges(filteredRaw, tagCounts, totalPhotos, pmiThreshold);
  const sparseEdges = topKSparsify(pmiEdges, maxDegree);

  const nodeIds = new Set();
  for (const link of sparseEdges) {
    nodeIds.add(link.source);
    nodeIds.add(link.target);
  }

  const sortedIds = [...nodeIds].sort(
    (a, b) => (tagCounts[b] ?? 0) - (tagCounts[a] ?? 0),
  );

  const communities = detectCommunities(sortedIds, sparseEdges);
  const { intraLinks, interLinks } = splitLinksByCommunity(sparseEdges, communities);

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

  const clusters = layoutClusteredGraph(nodes, intraLinks, interLinks, communities);

  return {
    nodes,
    links: intraLinks,
    interLinks,
    clusters,
    stats: {
      tags: nodes.length,
      links: intraLinks.length,
      interLinks: interLinks.length,
      communities: clusters.length,
      prunedMegaTags: megaTags.size,
    },
  };
}

async function getTagNetworkGraph(db, options = {}) {
  const minTagCount = options.minTagCount ?? 10;
  const minWeight = options.minWeight ?? 2;
  const maxNodes = options.maxNodes ?? 100;
  const megaTagPct = options.megaTagPct ?? 0.35;
  const pmiThreshold = options.pmiThreshold ?? 1.0;
  const maxDegree = options.maxDegree ?? 6;

  const cacheKey = `${minTagCount}:${minWeight}:${maxNodes}:${megaTagPct}:${pmiThreshold}:${maxDegree}`;

  const cached = networkCache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.data;
  }

  const tagCounts = await db.getTagCounts();
  const totalPhotos = await db.getPhotoCount();
  const data = await buildTagNetworkGraph(db, tagCounts, totalPhotos, {
    minTagCount,
    minWeight,
    maxNodes,
    megaTagPct,
    pmiThreshold,
    maxDegree,
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
