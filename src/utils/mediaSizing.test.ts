import { describe, expect, it } from 'vitest';
import { calculateContainedMediaSize } from './mediaSizing';

describe('calculateContainedMediaSize', () => {
  it('maximizes a landscape image without cropping it', () => {
    expect(calculateContainedMediaSize({ width: 4000, height: 2000 }, { width: 1920, height: 1080 })).toEqual(
      {
        width: 1920,
        height: 960,
      },
    );
  });

  it('maximizes a portrait image without cropping it', () => {
    expect(calculateContainedMediaSize({ width: 2000, height: 4000 }, { width: 1920, height: 1080 })).toEqual(
      {
        width: 540,
        height: 1080,
      },
    );
  });

  it('supports upscaling and rejects incomplete dimensions', () => {
    expect(calculateContainedMediaSize({ width: 100, height: 50 }, { width: 1000, height: 800 })).toEqual({
      width: 1000,
      height: 500,
    });
    expect(calculateContainedMediaSize({ width: 0, height: 50 }, { width: 1000, height: 800 })).toBeNull();
  });
});
