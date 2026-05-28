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

  const filteredTags = useMemo(
    () => filterTags(allTags, searchTerm, { limit: 30 }),
    [allTags, searchTerm],
  );

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
    <div className="mt-4">
      <div className="px-3 py-1 text-xs font-bold uppercase text-gray-500 dark:text-gray-400">Tags</div>

      {currentTag && (
        <div
          className={`mx-2 mb-2 flex items-center gap-2 rounded-md px-3 py-2 text-sm ${getAccentSelected(accentColor)} border ${getAccentBorder(accentColor)}`}
        >
          <Tag className={`w-4 h-4 shrink-0 ${getAccentText(accentColor)}`} />
          <span className="flex-1 truncate font-medium">{currentTag}</span>
          {tagCounts?.[currentTag] != null && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {tagCounts[currentTag]}
            </span>
          )}
          <button
            type="button"
            onClick={handleClearTag}
            className="p-0.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            aria-label="Clear tag filter"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div ref={containerRef} className="relative px-2">
        <Search className="pointer-events-none absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
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
          className="w-full rounded-md border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:ring-gray-600"
        />

        {showResults && (
          <div className="absolute left-2 right-2 top-full z-30 mt-1 max-h-60 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900">
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
        )}

        {isOpen && !searchTerm.trim() && (
          <p className="mt-1.5 px-1 text-xs text-gray-500 dark:text-gray-400">
            Type to find a tag
          </p>
        )}
      </div>
    </div>
  );
};

export default TagSearch;
