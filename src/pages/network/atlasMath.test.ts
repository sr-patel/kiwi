import { describe, expect, it } from 'vitest';
import { distanceToSegment, fitAtlasTransform, screenToWorld, zoomAtlasAt } from './atlasMath';

describe('tag atlas viewport math', () => {
  it('fits the complete graph bounds without cropping', () => {
    const transform = fitAtlasTransform({ minX: -100, minY: -50, maxX: 100, maxY: 50 }, 1000, 500, 50);
    const topLeft = { x: -100 * transform.scale + transform.x, y: -50 * transform.scale + transform.y };
    const bottomRight = { x: 100 * transform.scale + transform.x, y: 50 * transform.scale + transform.y };
    expect(topLeft.x).toBeGreaterThanOrEqual(50);
    expect(topLeft.y).toBeGreaterThanOrEqual(50);
    expect(bottomRight.x).toBeLessThanOrEqual(950);
    expect(bottomRight.y).toBeLessThanOrEqual(450);
  });

  it('zooms around the cursor without moving its world point', () => {
    const point = { x: 250, y: 180 };
    const before = { x: 10, y: 20, scale: 0.5 };
    const world = screenToWorld(point, before);
    const after = zoomAtlasAt(before, point, 1.25);
    expect(screenToWorld(point, after)).toEqual(world);
  });

  it('measures link hit targets', () => {
    expect(distanceToSegment({ x: 5, y: 4 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(4);
  });
});
