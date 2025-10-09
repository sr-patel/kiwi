import React, { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
import { useAppStore } from '@/store';
import { getAccentRing } from '@/utils/accentColors';
import { TagSelector } from '@/components/TagSelector/TagSelector';

interface SearchBarProps {
  className?: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({ className = '' }) => {
  const { searchQuery, setSearchQuery, filters, setFilters, accentColor, enableColorIntegration } = useAppStore();
  const [inputValue, setInputValue] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<number | null>(null);

  // Parse search query to separate content and tags
  useEffect(() => {
    // For now, we'll let the backend handle the smart tag detection
    // The backend will automatically detect if search terms match existing tags
    // and treat them as tag searches, otherwise as content searches
    
    // Split by spaces and identify explicit tag patterns (tag: or #)
    const parts = searchQuery.trim().split(/\s+/);
    const tagParts: string[] = [];
    const contentParts: string[] = [];
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (part.startsWith('tag:') || part.startsWith('#')) {
        // This is a tag prefix, collect the tag content
        const tagPrefix = part;
        const tagContent: string[] = [];
        
        // Collect all parts until we hit another tag prefix or end
        i++; // Move to next part
        while (i < parts.length && !parts[i].startsWith('tag:') && !parts[i].startsWith('#')) {
          tagContent.push(parts[i]);
          i++;
        }
        i--; // Go back one since the loop will increment
        
        // Combine tag prefix with content
        const fullTag = tagPrefix + (tagContent.length > 0 ? ' ' + tagContent.join(' ') : '');
        const tag = fullTag.replace(/^(tag:|#)/, '').trim();
        if (tag) {
          tagParts.push(tag);
        }
      } else {
        // This is content - the backend will handle smart tag detection
        contentParts.push(part);
      }
    }
    
    console.log('🔍 SearchBar: Parsed query:', { 
      originalQuery: searchQuery, 
      contentParts: contentParts.join(' '), 
      tagParts 
    });
    
    setInputValue(contentParts.join(' '));
    setSelectedTags(tagParts);
  }, [searchQuery]);

  // Update search query when inputs change (debounced)
  const updateSearchQuery = (content: string, tags: string[]) => {
    const contentParts = content.trim().split(' ').filter(Boolean);
    const tagParts = tags.map(tag => `tag:${tag}`);
    
    const searchParts = [
      ...contentParts,
      ...tagParts
    ];
    
    const newQuery = searchParts.join(' ');
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
    }
    debounceRef.current = window.setTimeout(() => {
      setSearchQuery(newQuery);
    }, 300);
  };

  const handleContentChange = (value: string) => {
    setInputValue(value);
    updateSearchQuery(value, selectedTags);
  };

  const handleTagsChange = (tags: string[]) => {
    setSelectedTags(tags);
    updateSearchQuery(inputValue, tags);
  };

  const handleClearSearch = () => {
    setInputValue('');
    setSelectedTags([]);
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    setSearchQuery('');
    setFilters({ ...filters, tags: [] });
  };

  const hasSearchContent = inputValue.trim() || selectedTags.length > 0;

  return (
    <div className={`flex gap-2 ${className}`}>
      {/* Main search input */}
      <div 
        className="relative flex-shrink-0" 
        style={{ 
          minWidth: '200px',
          maxWidth: inputValue.trim() ? 'none' : '200px',
          width: inputValue.trim() ? 'auto' : '200px'
        }}
      >
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search"
          value={inputValue}
          onChange={(e) => handleContentChange(e.target.value)}
          className={`w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 ${enableColorIntegration ? getAccentRing(accentColor) : 'focus:ring-gray-400 dark:focus:ring-gray-600'} focus:border-transparent`}
        />
        {hasSearchContent && (
          <button
            onClick={handleClearSearch}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Tag selector */}
      <div className="flex-1 min-w-0" data-tag-selector>
        <TagSelector
          selectedTags={selectedTags}
          onTagsChange={handleTagsChange}
          placeholder="Search tags"
        />
      </div>


    </div>
  );
}; 