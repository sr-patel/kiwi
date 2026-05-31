import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTagCounts } from '@/hooks/useTagCounts';
import { generateTagUrl } from '@/utils/tagUrls';

interface TagCloudProps {
  accentHex: string;
  theme: string;
  maxTags?: number;
}

function scaleFontSize(count: number, min: number, max: number): number {
  if (max <= min) return 16;
  const t = (Math.log(count) - Math.log(min)) / (Math.log(max) - Math.log(min));
  return Math.round(12 + t * 16); // 12px – 28px
}

const HUES = [210, 260, 290, 330, 170, 45, 15, 195];

export function TagCloud({ accentHex, theme, maxTags = 80 }: TagCloudProps) {
  const navigate = useNavigate();
  const { data: tagCounts, isLoading } = useTagCounts();

  const tags = useMemo(() => {
    if (!tagCounts) return [];
    return Object.entries(tagCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, maxTags);
  }, [tagCounts, maxTags]);

  const { minCount, maxCount } = useMemo(() => {
    if (tags.length === 0) return { minCount: 1, maxCount: 1 };
    const counts = tags.map(([, c]) => c);
    return { minCount: Math.min(...counts), maxCount: Math.max(...counts) };
  }, [tags]);

  if (isLoading) {
    return (
      <div className="flex h-full min-h-[200px] items-center justify-center text-sm text-gray-400 dark:text-zinc-500">
        Loading tags…
      </div>
    );
  }

  if (tags.length === 0) {
    return (
      <div className="flex h-full min-h-[200px] items-center justify-center text-sm text-gray-400 dark:text-zinc-500">
        No tags yet
      </div>
    );
  }

  const isDark = theme === 'dark';

  return (
    <div className="flex h-full min-h-[200px] flex-wrap content-center justify-center gap-x-3 gap-y-2 overflow-y-auto px-2 py-1">
      {tags.map(([tag, count], index) => {
        const fontSize = scaleFontSize(count, minCount, maxCount);
        const hue = HUES[index % HUES.length];
        const color = index === 0 ? accentHex : `hsl(${hue} ${isDark ? '55%' : '45%'} ${isDark ? '68%' : '42%'})`;

        return (
          <button
            key={tag}
            type="button"
            onClick={() => navigate(generateTagUrl(tag))}
            className="rounded-md px-1.5 py-0.5 transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
            style={{
              fontSize: `${fontSize}px`,
              color,
              fontWeight: index < 5 ? 600 : 400,
              lineHeight: 1.3,
            }}
            title={`${tag} — ${count.toLocaleString()} items`}
          >
            {tag}
          </button>
        );
      })}
    </div>
  );
}
