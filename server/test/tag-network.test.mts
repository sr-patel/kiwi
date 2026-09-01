import { createRequire } from 'node:module';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
interface TestGraph {
  version: number;
  generatedAt: string;
  nodes: Array<{ x: number; y: number }>;
  clusters: Array<{ radius: number; hull: Array<{ x: number; y: number }> }>;
  stats: Record<string, number> & { buildMs: number };
  [key: string]: unknown;
}

const tagNetwork = require('../tagNetwork.cjs') as {
  getTagNetworkGraph(database: object, options?: Record<string, number>): Promise<TestGraph>;
  invalidateTagNetworkCache(): void;
  __test: {
    buildTagNetworkGraph(snapshot: object, options?: Record<string, number>): Promise<TestGraph>;
    scoreEdges(
      edges: Array<{ source: string; target: string; weight: number }>,
      counts: Record<string, number>,
      total: number,
      options: { pmiThreshold: number; minScore: number },
    ): Array<{ source: string; target: string; score: number }>;
  };
};

const snapshot = {
  totalPhotos: 100,
  tagCounts: { beach: 30, ocean: 28, sand: 24, city: 25, street: 23, building: 20, rare: 2 },
  rawEdges: [
    { source: 'beach', target: 'ocean', weight: 20 },
    { source: 'beach', target: 'sand', weight: 18 },
    { source: 'ocean', target: 'sand', weight: 16 },
    { source: 'building', target: 'city', weight: 17 },
    { source: 'building', target: 'street', weight: 14 },
    { source: 'city', target: 'street', weight: 18 },
    { source: 'beach', target: 'city', weight: 2 },
    { source: 'ocean', target: 'rare', weight: 1 },
  ],
};

function stableGraph(graph: TestGraph) {
  return { ...graph, generatedAt: '<time>', stats: { ...graph.stats, buildMs: 0 } };
}

describe('tag atlas graph model', () => {
  beforeEach(() => tagNetwork.invalidateTagNetworkCache());

  it('produces stable communities and coordinates for identical data', async () => {
    const options = { minTagCount: 3, maxNodes: 20, minScore: 0.04, pmiThreshold: -10 };
    const first = await tagNetwork.__test.buildTagNetworkGraph(snapshot, options);
    const second = await tagNetwork.__test.buildTagNetworkGraph(snapshot, options);

    expect(stableGraph(first)).toEqual(stableGraph(second));
    expect(first.version).toBe(2);
    expect(first.nodes).toHaveLength(6);
    expect(first.nodes.every((node) => Number.isFinite(node.x) && Number.isFinite(node.y))).toBe(true);
    expect(first.clusters.every((cluster) => cluster.radius > 0 && cluster.hull.length === 28)).toBe(true);
  });

  it('discounts one-off coincidences while retaining repeated associations', () => {
    const edges = tagNetwork.__test.scoreEdges(snapshot.rawEdges, snapshot.tagCounts, 100, {
      pmiThreshold: -10,
      minScore: 0,
    });
    const strong = edges.find((edge) => edge.source === 'beach' && edge.target === 'ocean');
    const rare = edges.find((edge) => edge.source === 'ocean' && edge.target === 'rare');

    expect(strong?.score).toBeGreaterThan(rare?.score ?? 1);
  });

  it('shares source-data work across graph presets and invalidates it explicitly', async () => {
    const database = {
      getTagCounts: vi.fn(async () => snapshot.tagCounts),
      getPhotoCount: vi.fn(async () => snapshot.totalPhotos),
      getTagCoOccurrences: vi.fn(async () => snapshot.rawEdges),
    };

    await Promise.all([
      tagNetwork.getTagNetworkGraph(database, { minTagCount: 3, minScore: 0.04 }),
      tagNetwork.getTagNetworkGraph(database, { minTagCount: 3, minScore: 0.04 }),
    ]);
    await tagNetwork.getTagNetworkGraph(database, { minTagCount: 10, minScore: 0.04 });

    expect(database.getTagCounts).toHaveBeenCalledTimes(1);
    expect(database.getTagCoOccurrences).toHaveBeenCalledTimes(1);

    tagNetwork.invalidateTagNetworkCache();
    await tagNetwork.getTagNetworkGraph(database, { minTagCount: 3, minScore: 0.04 });
    expect(database.getTagCounts).toHaveBeenCalledTimes(2);
  });
});
