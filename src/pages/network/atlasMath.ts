import type { TagNetworkGraph, TagNetworkNode } from '@/pages/network/types';

export interface AtlasTransform {
  x: number;
  y: number;
  scale: number;
}

export interface AtlasPoint {
  x: number;
  y: number;
}

export interface AtlasBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export const MIN_ATLAS_SCALE = 0.08;
export const MAX_ATLAS_SCALE = 5;

export function clampAtlasScale(scale: number): number {
  return Math.min(MAX_ATLAS_SCALE, Math.max(MIN_ATLAS_SCALE, scale));
}

export function atlasBounds(graph: Pick<TagNetworkGraph, 'nodes' | 'clusters'>): AtlasBounds {
  const points = graph.clusters.flatMap((cluster) => cluster.hull);
  if (points.length === 0) points.push(...graph.nodes.map((node) => ({ x: node.x, y: node.y })));
  if (points.length === 0) return { minX: -1, minY: -1, maxX: 1, maxY: 1 };
  return points.reduce<AtlasBounds>(
    (bounds, point) => ({
      minX: Math.min(bounds.minX, point.x),
      minY: Math.min(bounds.minY, point.y),
      maxX: Math.max(bounds.maxX, point.x),
      maxY: Math.max(bounds.maxY, point.y),
    }),
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
  );
}

export function fitAtlasTransform(
  bounds: AtlasBounds,
  width: number,
  height: number,
  padding = 72,
): AtlasTransform {
  const contentWidth = Math.max(1, bounds.maxX - bounds.minX);
  const contentHeight = Math.max(1, bounds.maxY - bounds.minY);
  const availableWidth = Math.max(1, width - padding * 2);
  const availableHeight = Math.max(1, height - padding * 2);
  const scale = clampAtlasScale(Math.min(availableWidth / contentWidth, availableHeight / contentHeight));
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  return { x: width / 2 - centerX * scale, y: height / 2 - centerY * scale, scale };
}

export function screenToWorld(point: AtlasPoint, transform: AtlasTransform): AtlasPoint {
  return {
    x: (point.x - transform.x) / transform.scale,
    y: (point.y - transform.y) / transform.scale,
  };
}

export function zoomAtlasAt(transform: AtlasTransform, point: AtlasPoint, nextScale: number): AtlasTransform {
  const world = screenToWorld(point, transform);
  const scale = clampAtlasScale(nextScale);
  return { x: point.x - world.x * scale, y: point.y - world.y * scale, scale };
}

export function atlasNodeRadius(node: TagNetworkNode): number {
  return 5 + Math.sqrt(Math.max(node.val, 1)) * 2.1;
}

export function distanceToSegment(point: AtlasPoint, start: AtlasPoint, end: AtlasPoint): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  const t = Math.max(
    0,
    Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)),
  );
  return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
}
