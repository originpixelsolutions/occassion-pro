'use client'

/**
 * GuestSearch
 *
 * Debounced fuzzy search over the IndexedDB guest cache using fuse.js.
 * Keyboard navigable — Arrow keys move selection, Enter confirms.
 * Works fully offline (searches cached data only).
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import type { CachedGuest } from '../hooks/useCheckinCache'

interface GuestSearchProps {
  guests: CachedGuest[]
  onSelect: (guest: CachedGuest) => void
  disabled?: boolean
}

export function GuestSearch({ guests, onSelect, disabled = false }: GuestSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CachedGuest[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [fuseReady, setFuseReady] = useState(false)
  const fuseRef = useRef<InstanceType<typeof import('fuse.js').default> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Initialise Fuse when guests list changes
  useEffect(() => {
    async function initFuse() {
      const Fuse = (await import('fuse.js')).default
      fuseRef.current = new Fuse(guests, {
        keys: [
          { name: 'guest_name', weight: 0.5 },
          { name: 'email', weight: 0.25 },
          { name: 'company', weight: 0.15 },
          { name: 'table_number', weight: 0.1 },
        ],
        threshold: 0.35,
        includeScore: true,
        minMatchCharLength: 2,
      })
      setFuseReady(true)
    }
    if (guests.length > 0) initFuse()
  }, [guests])

  const search = useCallback(
    (value: string) => {
      if (!fuseRef.current || value.trim().length < 2) {
        setResults([])
        return
      }
      const found = fuseRef.current.search(value).map((r) => r.item)
      setResults(found.slice(0, 8))
      setSelectedIndex(0)
    },
    [],
  )

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(value), 200)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (results.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (results[selectedIndex]) {
        handleSelect(results[selectedIndex])
      }
    } else if (e.key === 'Escape') {
      setResults([])
      setQuery('')
    }
  }

  const handleSelect = (guest: CachedGuest) => {
    setQuery('')
    setResults([])
    onSelect(guest)
    inputRef.current?.focus()
  }

  return (
    <div className="relative w-full">
      {/* Search input */}
      <div className="relative">
        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
          <svg className="w-4 h-4 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-4.35-4.35M16.65 16.65A7.5 7.5 0 1116.65 2a7.5 7.5 0 010 14.65z" />
          </svg>
        </div>
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={disabled || !fuseReady}
          placeholder={fuseReady ? 'Search by name, email, company…' : 'Loading guests…'}
          className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/5 border border-white/10
                     text-white placeholder:text-white/30 text-sm
                     focus:outline-none focus:ring-2 focus:ring-indigo-500/60
                     disabled:opacity-50 transition-all"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
        />
        {query.length > 0 && (
          <button
            onClick={() => { setQuery(''); setResults([]) }}
            className="absolute inset-y-0 right-3 flex items-center text-white/30 hover:text-white/60 transition-colors"
            tabIndex={-1}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Results dropdown */}
      {results.length > 0 && (
        <ul
          role="listbox"
          className="absolute top-full mt-1 left-0 right-0 z-50 bg-[#1a1a2e] border border-white/10
                     rounded-xl shadow-2xl overflow-hidden max-h-72 overflow-y-auto"
        >
          {results.map((guest, i) => (
            <li
              key={guest.id}
              role="option"
              aria-selected={i === selectedIndex}
              onClick={() => handleSelect(guest)}
              onMouseEnter={() => setSelectedIndex(i)}
              className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors select-none
                          ${i === selectedIndex ? 'bg-indigo-600/30' : 'hover:bg-white/5'}`}
            >
              {/* Avatar */}
              <div className="w-9 h-9 rounded-full bg-indigo-600/30 flex items-center justify-center
                              text-indigo-300 font-semibold text-sm shrink-0 uppercase">
                {guest.guest_name.charAt(0)}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-white text-sm font-medium truncate">{guest.guest_name}</span>
                  {guest.is_checked_in && (
                    <span className="shrink-0 px-1.5 py-0.5 rounded text-xs font-medium
                                     bg-emerald-500/20 text-emerald-400">
                      ✓ In
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-white/40 truncate">
                  {guest.email && <span className="truncate">{guest.email}</span>}
                  {guest.table_number && (
                    <span className="shrink-0 text-indigo-400">Table {guest.table_number}</span>
                  )}
                  {guest.ticket_type && (
                    <span className="shrink-0 text-white/30">{guest.ticket_type}</span>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* No results */}
      {query.length >= 2 && results.length === 0 && fuseReady && (
        <div className="absolute top-full mt-1 left-0 right-0 z-50 bg-[#1a1a2e] border border-white/10
                        rounded-xl shadow-2xl px-4 py-3">
          <p className="text-white/40 text-sm text-center">No guests found for "{query}"</p>
        </div>
      )}
    </div>
  )
}
