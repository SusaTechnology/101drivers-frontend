// components/shared/reports/SearchableSelect.tsx
//
// A compact type-to-filter dropdown used by the insurance report filters
// (e.g. driver picker). Lifted out of insurance-portal.tsx so both the
// carrier portal and the admin insurance-reporting page render the exact
// same filter UI.

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Search, X, ChevronRight } from 'lucide-react';

export interface SearchableSelectItem {
  id: string;
  name: string;
}

interface SearchableSelectProps {
  items: SearchableSelectItem[];
  value: string;
  onChange: (id: string) => void;
  placeholder: string;
  /** Optional extra className for the trigger. */
  className?: string;
}

export function SearchableSelect({
  items,
  value,
  onChange,
  placeholder,
  className,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  // Find the selected item's name for display
  const selectedItem = items.find((item) => item.id === value);
  const displayValue = selectedItem ? selectedItem.name : '';

  // Filter items by search text
  const filtered = items.filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (id: string) => {
    onChange(id);
    setOpen(false);
    setSearch('');
  };

  const handleClear = () => {
    onChange('');
    setSearch('');
  };

  return (
    <div className="relative">
      <div
        className={cn(
          'w-full h-9 px-3 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center justify-between cursor-pointer',
          className
        )}
        onClick={() => setOpen(!open)}
      >
        <span
          className={cn(
            'truncate',
            displayValue
              ? 'text-slate-900 dark:text-white font-semibold'
              : 'text-slate-400'
          )}
        >
          {displayValue || placeholder}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {value && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleClear();
              }}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <ChevronRight
            className={cn(
              'w-3.5 h-3.5 text-slate-400 transition-transform',
              open && 'rotate-90'
            )}
          />
        </div>
      </div>

      {open && (
        <>
          {/* Backdrop to close on outside click */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => {
              setOpen(false);
              setSearch('');
            }}
          />

          {/* Dropdown panel */}
          <div className="absolute z-20 mt-1 w-full bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl max-h-[240px] overflow-hidden">
            {/* Search input */}
            <div className="p-2 border-b border-slate-100 dark:border-slate-800">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Type to search..."
                  className="w-full h-8 pl-8 pr-3 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/40"
                  autoFocus
                />
              </div>
            </div>

            {/* Options list */}
            <div className="overflow-y-auto max-h-[180px]">
              <button
                type="button"
                onClick={() => handleSelect('')}
                className={cn(
                  'w-full text-left px-3 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition',
                  !value
                    ? 'bg-primary/5 font-bold text-primary'
                    : 'text-slate-600 dark:text-slate-400'
                )}
              >
                {placeholder}
              </button>
              {filtered.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelect(item.id)}
                  className={cn(
                    'w-full text-left px-3 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition truncate',
                    value === item.id
                      ? 'bg-primary/5 font-bold text-primary'
                      : 'text-slate-600 dark:text-slate-400'
                  )}
                >
                  {item.name}
                </button>
              ))}
              {filtered.length === 0 && (
                <div className="px-3 py-4 text-xs text-center text-slate-400">
                  No results found
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default SearchableSelect;
