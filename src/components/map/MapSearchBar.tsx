"use client";

import React from "react";
import { Search } from "lucide-react";

interface MapSearchBarProps {
  searchQuery: string;
  isSearching: boolean;
  searchError: string | null;
  topOffset: number;
  onSearchChange: (val: string) => void;
  onSearchSubmit: (e?: React.FormEvent | React.KeyboardEvent) => void;
  onClear: () => void;
}

export default function MapSearchBar({
  searchQuery,
  isSearching,
  searchError,
  topOffset,
  onSearchChange,
  onSearchSubmit,
  onClear,
}: MapSearchBarProps) {
  return (
    <div
      className="absolute left-1/2 transform -translate-x-1/2 z-40 w-11/12 max-w-md font-quicksand"
      style={{ top: topOffset }}
    >
      <form onSubmit={onSearchSubmit} className="relative w-full group">
        <input
          type="text"
          aria-label="Cerca luogo o indirizzo"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Cerca un luogo o indirizzo (es. Milano)..."
          className="w-full h-12 px-6 pr-12 bg-card/95 backdrop-blur-2xl border-2 border-primary/20 rounded-2xl shadow-dropdown text-sm font-bold text-foreground focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none placeholder:text-muted-foreground"
        />
        
        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
          {isSearching ? (
            <div className="size-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          ) : (
            <button 
              type="submit"
              className="p-1 text-muted-foreground hover:text-primary transition-colors flat-press"
              aria-label="Esegui ricerca"
            >
              <Search className="size-5" />
            </button>
          )}
          {searchQuery && !isSearching && (
            <button 
              type="button"
              onClick={onClear}
              className="size-6 flex items-center justify-center text-muted-foreground hover:text-primary transition-colors flat-press text-xs font-black rounded-full"
              aria-label="Cancella testo di ricerca"
            >
              ✕
            </button>
          )}
        </div>

        {searchError && (
          <div className="absolute top-full mt-2 left-0 right-0 bg-destructive text-destructive-foreground px-4 py-3 rounded-2xl text-xs font-bold shadow-dropdown animate-in fade-in slide-in-from-top-2">
            {searchError}
          </div>
        )}
      </form>
    </div>
  );
}
