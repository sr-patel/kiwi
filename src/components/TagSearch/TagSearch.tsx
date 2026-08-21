import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Tag, X } from 'lucide-react';
import { useTags } from '@/hooks/useTags';
import { useTagCounts } from '@/hooks/useTagCounts';
import { useAppStore } from '@/store';
import { getAccentSelected, getAccentBorder, getAccentText } from '@/utils/accentColors';
import { generateTagUrl } from '@/utils/tagUrls';
import { filterTags } from '@/utils/tagSearch';

interface TagSearchProps {
  currentTag: string | null;
  onTagSelect: (tag: string | null) => void;
}

export const TagSearch: React.FC<TagSearchProps> = ({ currentTag, onTagSelect }) => {
  const navigate = useNavigate();
  const { accentColor, setCurrentFolder } = useAppStore();
  const { data: allTags = [], isLoading } = useTags();
  const { data: tagCounts } = useTagCounts();
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredTags = useMemo(() => filterTags(allTags, searchTerm, { limit: 100 }), [allTags, searchTerm]);

  const showResults = isOpen && searchTerm.trim().length > 0;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (tag: string) => {
    setCurrentFolder(null);
    navigate(generateTagUrl(tag));
    onTagSelect(tag);
    setSearchTerm('');
    setIsOpen(false);
  };

  const handleClearTag = () => {
    onTagSelect(null);
    navigate('/all');
    setSearchTerm('');
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="flex min-h-0 flex-1 flex-col px-2">
      <div className="shrink-0 px-1 py-1 text-xs font-bold uppercase text-gray-500 dark:text-gray-400">
        Tags
      </div>

      {currentTag && (
        <div
          className={`mb-2 flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm ${getAccentSelected(accentColor)} border ${getAccentBorder(accentColor)}`}
        >
          <Tag className={`h-4 w-4 shrink-0 ${getAccentText(accentColor)}`} />
          <span className="flex-1 truncate font-medium">{currentTag}</span>
          {tagCounts?.[currentTag] != null && (
            <span className="text-xs text-gray-500 dark:text-gray-400">{tagCounts[currentTag]}</span>
          )}
          <button
            type="button"
            onClick={handleClearTag}
            className="p-0.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            aria-label="Clear tag filter"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="flex shrink-0 items-center gap-2 rounded-md border border-gray-200 bg-white px-3 dark:border-gray-700 dark:bg-gray-900">
        <Search className="h-4 w-4 shrink-0 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Search tags…"
          className="flex-1 border-0 bg-transparent py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0 dark:text-gray-100"
        />
      </div>

      {showResults ? (
        <div className="mt-2 flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
          <div className="min-h-0 flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="p-3 text-sm text-gray-500 dark:text-gray-400">Loading tags…</div>
            ) : filteredTags.length === 0 ? (
              <div className="p-3 text-sm text-gray-500 dark:text-gray-400">No tags found</div>
            ) : (
              <ul className="py-1">
                {filteredTags.map((tag) => (
                  <li key={tag}>
                    <button
                      type="button"
                      onClick={() => handleSelect(tag)}
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-gray-900 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-800"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <Tag className="h-3 w-3 shrink-0 text-gray-500 dark:text-gray-400" />
                        <span className="truncate">{tag}</span>
                      </span>
                      {tagCounts?.[tag] != null && (
                        <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400">
                          {tagCounts[tag]}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : isOpen ? (
        <p className="mt-1.5 shrink-0 px-1 text-xs text-gray-500 dark:text-gray-400">Type to find a tag</p>
      ) : null}
    </div>
  );
};

export default TagSearch;
