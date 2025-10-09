import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, X, Tag } from 'lucide-react';
import { useTags } from '@/hooks/useTags';
import { useTagCounts } from '@/hooks/useTagCounts';
import { getAccentHex } from '@/utils/accentColors';
import { useAppStore } from '@/store';

interface TagSelectorProps {
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
  placeholder?: string;
  className?: string;
}

export const TagSelector: React.FC<TagSelectorProps> = ({
  selectedTags,
  onTagsChange,
  placeholder = "Search tags",
  className = ""
}) => {
  const { data: allTags = [], isLoading } = useTags();
  const { data: tagCounts } = useTagCounts();
  const { accentColor, enableColorIntegration } = useAppStore();
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filter tags based on search term
  const filteredTags = allTags.filter(tag => 
    tag.toLowerCase().includes(searchTerm.toLowerCase()) &&
    !selectedTags.includes(tag)
  );

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
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
    // Keep dropdown open for multiple tag selection
    // setIsOpen(false);
  };

  const handleTagRemove = (tagToRemove: string) => {
    onTagsChange(selectedTags.filter(tag => tag !== tagToRemove));
  };

  const handleInputClick = () => {
    setIsOpen(true);
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Input field */}
      <div 
        className="cursor-text w-fit min-w-[200px] max-w-[400px]"
        onClick={handleInputClick}
      >
        <div className="flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 min-h-[42px] cursor-pointer w-full">
          <Tag className="text-gray-400 w-4 h-4 flex-shrink-0" />
          
          {selectedTags.length > 0 ? (
            <div className="flex items-center gap-1 flex-1 flex-wrap min-w-0">
              {selectedTags.map(tag => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md whitespace-nowrap flex-shrink-0"
                  style={enableColorIntegration ? { backgroundColor: `${getAccentHex(accentColor)}20`, color: getAccentHex(accentColor) } : undefined}
                >
                  {tag}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTagRemove(tag);
                    }}
                    className="hover:opacity-80"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <span className="text-gray-500 dark:text-gray-400 text-sm flex-1">
              {placeholder}
            </span>
          )}
          
          <ChevronDown className={`text-gray-400 w-4 h-4 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg shadow-lg z-20 max-h-60 overflow-y-auto text-gray-900 dark:text-gray-100 w-full min-w-[200px] max-w-[400px]">
          {/* Header with selected count and done button */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {selectedTags.length > 0 ? `${selectedTags.length} tag${selectedTags.length === 1 ? '' : 's'} selected` : 'Select tags'}
            </span>
            <button
              onClick={() => setIsOpen(false)}
              className="text-xs"
              style={{ color: getAccentHex(accentColor) }}
            >
              Done
            </button>
          </div>
          
          {isLoading ? (
            <div className="p-3 text-sm text-gray-500 dark:text-gray-400">
              Loading tags...
            </div>
          ) : filteredTags.length === 0 ? (
            <div className="p-3 text-sm text-gray-500 dark:text-gray-400">
              {searchTerm ? 'No tags found' : 'No tags available'}
            </div>
          ) : (
            <div className="py-1">
              {filteredTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => handleTagSelect(tag)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center justify-between text-gray-900 dark:text-gray-100"
                >
                  <span className="flex items-center gap-2">
                    <Tag className="w-3 h-3 text-gray-500 dark:text-gray-400" />
                    {tag}
                  </span>
                  {tagCounts && tagCounts[tag] && (
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                      {tagCounts[tag]} photos
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
          
          {/* Add custom tag option */}
          {searchTerm.trim() && !allTags.includes(searchTerm.trim()) && (
            <div className="border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => handleTagSelect(searchTerm.trim())}
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
                style={{ color: getAccentHex(accentColor) }}
              >
                <Tag className="w-3 h-3" />
                Add "{searchTerm.trim()}" as new tag
              </button>
            </div>
          )}
          
          {/* Help text */}
          {selectedTags.length > 0 && (
            <div className="border-t border-gray-200 dark:border-gray-700 px-3 py-2">
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Photos with ALL of the selected tags will be shown
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}; 