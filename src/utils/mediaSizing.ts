export interface MediaDimensions {
  width: number;
  height: number;
}

export function calculateContainedMediaSize(
  media: MediaDimensions,
  viewport: MediaDimensions,
): MediaDimensions | null {
  if (media.width <= 0 || media.height <= 0 || viewport.width <= 0 || viewport.height <= 0) {
    return null;
  }

  const scale = Math.min(viewport.width / media.width, viewport.height / media.height);
  return {
    width: media.width * scale,
    height: media.height * scale,
  };
}
