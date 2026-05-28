import { useMemo } from 'react';

const DEFAULT_LIMIT = 50;

export function filterTags(
  allTags: string[],
  searchTerm: string,
  options: { exclude?: string[]; limit?: number } = {},
): string[] {
  const { exclude = [], limit = DEFAULT_LIMIT } = options;
  const term = searchTerm.trim().toLowerCase();

  return allTags
    .filter((tag) => !exclude.includes(tag))
    .filter((tag) => !term || tag.toLowerCase().includes(term))
    .slice(0, limit);
}
