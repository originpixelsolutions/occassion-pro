'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Search, Clock } from 'lucide-react'

// IANA timezones grouped by region — comprehensive but curated
const TIMEZONE_GROUPS: { region: string; zones: { tz: string; label: string; offset: string }[] }[] = [
  {
    region: 'South Asia',
    zones: [
      { tz: 'Asia/Kolkata',   label: 'India (IST)',         offset: '+05:30' },
      { tz: 'Asia/Colombo',   label: 'Sri Lanka (SLST)',    offset: '+05:30' },
      { tz: 'Asia/Dhaka',     label: 'Bangladesh (BST)',    offset: '+06:00' },
      { tz: 'Asia/Karachi',   label: 'Pakistan (PKT)',      offset: '+05:00' },
      { tz: 'Asia/Kathmandu', label: 'Nepal (NPT)',         offset: '+05:45' },
    ],
  },
  {
    region: 'Middle East',
    zones: [
      { tz: 'Asia/Dubai',     label: 'UAE (GST)',           offset: '+04:00' },
      { tz: 'Asia/Riyadh',    label: 'Saudi Arabia (AST)',  offset: '+03:00' },
      { tz: 'Asia/Qatar',     label: 'Qatar (AST)',         offset: '+03:00' },
      { tz: 'Asia/Kuwait',    label: 'Kuwait (AST)',        offset: '+03:00' },
      { tz: 'Asia/Bahrain',   label: 'Bahrain (AST)',       offset: '+03:00' },
      { tz: 'Asia/Muscat',    label: 'Oman (GST)',          offset: '+04:00' },
    ],
  },
  {
    region: 'East Asia & Pacific',
    zones: [
      { tz: 'Asia/Singapore',    label: 'Singapore (SGT)',     offset: '+08:00' },
      { tz: 'Asia/Kuala_Lumpur', label: 'Malaysia (MYT)',      offset: '+08:00' },
      { tz: 'Asia/Hong_Kong',    label: 'Hong Kong (HKT)',     offset: '+08:00' },
      { tz: 'Asia/Shanghai',     label: 'China (CST)',         offset: '+08:00' },
      { tz: 'Asia/Tokyo',        label: 'Japan (JST)',         offset: '+09:00' },
      { tz: 'Asia/Seoul',        label: 'South Korea (KST)',   offset: '+09:00' },
      { tz: 'Australia/Sydney',  label: 'Sydney (AEST)',       offset: '+10:00' },
      { tz: 'Pacific/Auckland',  label: 'New Zealand (NZST)',  offset: '+12:00' },
    ],
  },
  {
    region: 'Europe',
    zones: [
      { tz: 'Europe/London',      label: 'London (GMT/BST)',    offset: '+00:00' },
      { tz: 'Europe/Paris',       label: 'Paris (CET)',         offset: '+01:00' },
      { tz: 'Europe/Berlin',      label: 'Berlin (CET)',        offset: '+01:00' },
      { tz: 'Europe/Moscow',      label: 'Moscow (MSK)',        offset: '+03:00' },
      { tz: 'Europe/Istanbul',    label: 'Istanbul (TRT)',      offset: '+03:00' },
    ],
  },
  {
    region: 'Americas',
    zones: [
      { tz: 'America/New_York',    label: 'New York (EST)',      offset: '-05:00' },
      { tz: 'America/Chicago',     label: 'Chicago (CST)',       offset: '-06:00' },
      { tz: 'America/Los_Angeles', label: 'Los Angeles (PST)',   offset: '-08:00' },
      { tz: 'America/Toronto',     label: 'Toronto (EST)',       offset: '-05:00' },
      { tz: 'America/Sao_Paulo',   label: 'São Paulo (BRT)',     offset: '-03:00' },
      { tz: 'America/Mexico_City', label: 'Mexico City (CST)',   offset: '-06:00' },
    ],
  },
  {
    region: 'Africa',
    zones: [
      { tz: 'Africa/Nairobi',     label: 'Nairobi (EAT)',       offset: '+03:00' },
      { tz: 'Africa/Lagos',       label: 'Lagos (WAT)',         offset: '+01:00' },
      { tz: 'Africa/Johannesburg',label: 'Johannesburg (SAST)', offset: '+02:00' },
      { tz: 'Africa/Cairo',       label: 'Cairo (EET)',         offset: '+02:00' },
    ],
  },
]

// Flat list for searching
const ALL_ZONES = TIMEZONE_GROUPS.flatMap(g => g.zones.map(z => ({ ...z, region: g.region })))

interface Props {
  value: string
  onChange: (tz: string) => void
  className?: string
}

export default function TimezoneSelect({ value, onChange, className = '' }: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const selected = ALL_ZONES.find(z => z.tz === value)
  const isSearching = search.length > 0
  const filteredFlat = ALL_ZONES.filter(z =>
    `${z.tz} ${z.label} ${z.region}`.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between bg-white/[0.06] border border-white/10 rounded-xl px-3 py-2 text-sm text-white hover:border-white/20 focus:outline-none focus:border-violet-500/60 transition-colors"
      >
        <span className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-white/30 flex-shrink-0" />
          <span className="text-white/70 truncate">{selected?.label || value}</span>
          {selected && (
            <span className="text-white/30 text-xs font-mono flex-shrink-0">
              UTC{selected.offset}
            </span>
          )}
        </span>
        <ChevronDown className={`w-4 h-4 text-white/30 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-[#141420] border border-white/10 rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="p-2 border-b border-white/[0.06]">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
              <input
                autoFocus
                type="text"
                placeholder="Search timezone or city…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg pl-8 pr-3 py-1.5 text-sm text-white placeholder-white/20 focus:outline-none"
              />
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto">
            {isSearching ? (
              // Flat filtered results
              filteredFlat.map(z => (
                <TzOption key={z.tz} zone={z} selected={z.tz === value} onSelect={() => { onChange(z.tz); setOpen(false); setSearch('') }} />
              ))
            ) : (
              // Grouped
              TIMEZONE_GROUPS.map(group => (
                <div key={group.region}>
                  <div className="px-3 py-1.5 text-[10px] font-semibold text-white/30 uppercase tracking-wider bg-white/[0.02]">
                    {group.region}
                  </div>
                  {group.zones.map(z => (
                    <TzOption key={z.tz} zone={{ ...z, region: group.region }} selected={z.tz === value} onSelect={() => { onChange(z.tz); setOpen(false) }} />
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function TzOption({
  zone,
  selected,
  onSelect,
}: {
  zone: { tz: string; label: string; offset: string; region: string }
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-white/[0.04] transition-colors ${
        selected ? 'text-violet-400 bg-violet-500/10' : 'text-white/70'
      }`}
    >
      <span>{zone.label}</span>
      <span className="text-white/30 text-xs font-mono">UTC{zone.offset}</span>
    </button>
  )
}
