import React, { useState, useCallback } from 'react';
import { Search, ChevronDown, X, ArrowUpDown } from 'lucide-react';
import type { FilterDefinition, SortOption } from '../types';

interface SearchFilterProps {
  onSearch: (query: string) => void;
  filters: FilterDefinition[];
  sortOptions: SortOption[];
  onFilterChange: (filters: Record<string, string>) => void;
  onSortChange: (sort: string, direction: 'asc' | 'desc') => void;
}

export const SearchFilter: React.FC<SearchFilterProps> = ({
  onSearch,
  filters,
  sortOptions,
  onFilterChange,
  onSortChange,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const [currentSort, setCurrentSort] = useState(sortOptions[0]?.value ?? '');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setSearchQuery(val);
      onSearch(val);
    },
    [onSearch],
  );

  const handleFilterSelect = useCallback(
    (key: string, value: string) => {
      const next = { ...activeFilters };
      if (value === '') {
        delete next[key];
      } else {
        next[key] = value;
      }
      setActiveFilters(next);
      onFilterChange(next);
      setOpenDropdown(null);
    },
    [activeFilters, onFilterChange],
  );

  const handleSortSelect = useCallback(
    (value: string) => {
      if (value === currentSort) {
        const dir = sortDirection === 'asc' ? 'desc' : 'asc';
        setSortDirection(dir);
        onSortChange(value, dir);
      } else {
        setCurrentSort(value);
        setSortDirection('asc');
        onSortChange(value, 'asc');
      }
      setOpenDropdown(null);
    },
    [currentSort, sortDirection, onSortChange],
  );

  const clearAllFilters = useCallback(() => {
    setActiveFilters({});
    setSearchQuery('');
    onSearch('');
    onFilterChange({});
  }, [onSearch, onFilterChange]);

  const removeFilter = useCallback(
    (key: string) => {
      const next = { ...activeFilters };
      delete next[key];
      setActiveFilters(next);
      onFilterChange(next);
    },
    [activeFilters, onFilterChange],
  );

  const hasActiveFilters =
    Object.keys(activeFilters).length > 0 || searchQuery.length > 0;

  const currentSortLabel =
    sortOptions.find((s) => s.value === currentSort)?.label ?? 'Sort';

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        {/* Search input */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="w-full pl-9 pr-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                onSearch('');
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter dropdowns */}
        {filters.map((filter) => (
          <div key={filter.key} className="relative">
            <button
              onClick={() =>
                setOpenDropdown(openDropdown === filter.key ? null : filter.key)
              }
              className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-md border transition-colors ${
                activeFilters[filter.key]
                  ? 'bg-blue-600/20 border-blue-500/50 text-blue-300'
                  : 'bg-gray-700 border-gray-600 text-gray-300 hover:border-gray-500'
              }`}
            >
              {filter.label}
              {activeFilters[filter.key] && (
                <span className="text-blue-400 font-medium">
                  :{' '}
                  {filter.options.find(
                    (o) => o.value === activeFilters[filter.key],
                  )?.label ?? activeFilters[filter.key]}
                </span>
              )}
              <ChevronDown className="w-3.5 h-3.5" />
            </button>

            {openDropdown === filter.key && (
              <div className="absolute top-full left-0 mt-1 min-w-[160px] bg-gray-800 border border-gray-700 rounded-md shadow-lg z-50 py-1">
                <button
                  onClick={() => handleFilterSelect(filter.key, '')}
                  className="w-full text-left px-3 py-1.5 text-sm text-gray-400 hover:bg-gray-700 hover:text-white transition-colors"
                >
                  All
                </button>
                {filter.options.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handleFilterSelect(filter.key, opt.value)}
                    className={`w-full text-left px-3 py-1.5 text-sm transition-colors ${
                      activeFilters[filter.key] === opt.value
                        ? 'bg-blue-600/20 text-blue-300'
                        : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Sort dropdown */}
        <div className="relative">
          <button
            onClick={() =>
              setOpenDropdown(openDropdown === '_sort' ? null : '_sort')
            }
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-gray-700 border border-gray-600 text-gray-300 rounded-md hover:border-gray-500 transition-colors"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            {currentSortLabel}
            <span className="text-gray-500 text-xs">
              {sortDirection === 'asc' ? '\u2191' : '\u2193'}
            </span>
          </button>

          {openDropdown === '_sort' && (
            <div className="absolute top-full right-0 mt-1 min-w-[140px] bg-gray-800 border border-gray-700 rounded-md shadow-lg z-50 py-1">
              {sortOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleSortSelect(opt.value)}
                  className={`w-full text-left px-3 py-1.5 text-sm transition-colors ${
                    currentSort === opt.value
                      ? 'bg-blue-600/20 text-blue-300'
                      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  }`}
                >
                  {opt.label}
                  {currentSort === opt.value && (
                    <span className="ml-1 text-xs">
                      {sortDirection === 'asc' ? '\u2191' : '\u2193'}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Active filter badges */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2 flex-wrap">
          {Object.entries(activeFilters).map(([key, value]) => {
            const filterDef = filters.find((f) => f.key === key);
            const optLabel =
              filterDef?.options.find((o) => o.value === value)?.label ?? value;
            return (
              <span
                key={key}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-blue-600/20 text-blue-300 border border-blue-500/30 rounded-full"
              >
                {filterDef?.label}: {optLabel}
                <button
                  onClick={() => removeFilter(key)}
                  className="hover:text-white transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            );
          })}
          <button
            onClick={clearAllFilters}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
};

export default SearchFilter;
