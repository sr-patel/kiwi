/**
 * Generate a URL for a tag
 */
export const generateTagUrl = (tag: string): string => {
  const encodedTag = encodeURIComponent(tag);
  return `/tag/${encodedTag}`;
};

/**
 * Parse tag from URL
 */
export const parseTagFromUrl = (tagPath: string): string | null => {
  if (!tagPath) return null;
  try {
    return decodeURIComponent(tagPath);
  } catch {
    // Malformed escape sequences (for example "%") must not crash the route.
    return null;
  }
};

/**
 * Get tag breadcrumb data
 */
export const getTagBreadcrumb = (tag: string): { name: string; url: string } => {
  return {
    name: `Tag: ${tag}`,
    url: generateTagUrl(tag),
  };
};
