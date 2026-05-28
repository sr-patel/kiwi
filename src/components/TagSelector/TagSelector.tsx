import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, X, Tag } from 'lucide-react';
import { useTags } from '@/hooks/useTags';
import { useTagCounts } from '@/hooks/useTagCounts';
import { getAccentHex } from '@/utils/accentColors';
import { useAppStore } from '@/store';
import { filterTags } from '@/utils/tagSearch';

interface TagSelectorProps {
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
  placeholder?: string;
  className?: string;
}

export const TagSelector: React.FC<TagSelectorProps> = ({
  selectedTags,
  onTagsChange,
  placeholder = 'Search tags',
  className = '',
}) => {
  const { data: allTags = [], isLoading } = useTags();
  const { data: tagCounts } = useTagCounts();
  const { accentColor, enableColorIntegration } = useAppStore();
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredTags = useMemo(
    () => filterTags(allTags, searchTerm, { exclude: selectedTags }),
    [allTags, searchTerm, selectedTags],
  );

  const showResults = isOpen && searchTerm.trim().length > 0;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleTagSelect = (tag: string) => {
    if (!selectedTags.includes(tag)) {
      onTagsChange([...selectedTags, tag]);
    }
    setSearchTerm('');
    inputRef.current?.focus();
  };

  const handleTagRemove = (tagToRemove: string) => {
    onTagsChange(selectedTags.filter((tag) => tag !== tagToRemove));
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <div
        className="flex min-h-[42px] w-full min-w-[200px] max-w-[400px] cursor-text items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-900"
        onClick={() => inputRef.current?.focus()}
      >
        <Tag className="h-4 w-4 shrink-0 text-gray-400" />

        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
          {selectedTags.map((tag) => (
            <span
              key={tag}
              className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs whitespace-nowrap"
              style={
                enableColorIntegration
                  ? { backgroundColor: `${getAccentHex(accentColor)}20`, color: getAccentHex(accentColor) }
                  : undefined
              }
            >
              {tag}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleTagRemove(tag);
                }}
                className="hover:opacity-80"
                aria-label={`Remove ${tag}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}

          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            placeholder={selectedTags.length === 0 ? placeholder : 'Add tag…'}
            className="min-w-[80px] flex-1 border-0 bg-transparent py-0.5 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-0 dark:text-gray-100 dark:placeholder:text-gray-400"
          />
        </div>

        <ChevronDown
          className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </div>

      {showResults && (
        <div className="absolute top-full left-0 z-20 mt-1 max-h-60 w-full min-w-[200px] max-w-[400px] overflow-y-auto rounded-lg border border-gray-300 bg-white text-gray-900 shadow-lg dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100">
          <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2 dark:border-gray-700">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {selectedTags.length > 0
                ? `${selectedTags.length} tag${selectedTags.length === 1 ? '' : 's'} selected`
                : 'Filter by tags'}
            </span>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setSearchTerm('');
              }}
              className="text-xs"
              style={{ color: getAccentHex(accentColor) }}
            >
              Done
            </button>
          </div>

          {isLoading ? (
            <div className="p-3 text-sm text-gray-500 dark:text-gray-400">Loading tags…</div>
          ) : filteredTags.length === 0 ? (
            <div className="p-3 text-sm text-gray-500 dark:text-gray-400">No tags found</div>
          ) : (
            <div className="py-1">
              {filteredTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleTagSelect(tag)}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-gray-900 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-700"
                >
                  <span className="flex items-center gap-2">
                    <Tag className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                    {tag}
                  </span>
                  {tagCounts?.[tag] != null && (
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                      {tagCounts[tag]} photos
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {searchTerm.trim() && !allTags.includes(searchTerm.trim()) && (
            <div className="border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={() => handleTagSelect(searchTerm.trim())}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                style={{ color: getAccentHex(accentColor) }}
              >
                <Tag className="h-3 w-3" />
                Filter by &quot;{searchTerm.trim()}&quot;
              </button>
            </div>
          )}

          {selectedTags.length > 0 && (
            <div className="border-t border-gray-200 px-3 py-2 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Photos with ALL selected tags will be shown
              </p>
            </div>
          )}
        </div>
      )}

      {isOpen && !searchTerm.trim() && (
        <p className="absolute top-full left-0 mt-1 text-xs text-gray-500 dark:text-gray-400">
          Type to search tags
        </p>
      )}
    </div>
  );
};
