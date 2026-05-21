'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Search } from 'lucide-react'

// Common currencies shown first, then alphabetically
const CURRENCIES = [
  { code: 'INR', name: 'Indian Rupee',         symbol: '₹' },
  { code: 'USD', name: 'US Dollar',             symbol: '$' },
  { code: 'EUR', name: 'Euro',                  symbol: '€' },
  { code: 'GBP', name: 'British Pound',         symbol: '£' },
  { code: 'AED', name: 'UAE Dirham',            symbol: 'د.إ' },
  { code: 'SGD', name: 'Singapore Dollar',      symbol: 'S$' },
  { code: 'AUD', name: 'Australian Dollar',     symbol: 'A$' },
  { code: 'CAD', name: 'Canadian Dollar',       symbol: 'CA$' },
  { code: 'SAR', name: 'Saudi Riyal',           symbol: '﷼' },
  { code: 'QAR', name: 'Qatari Riyal',          symbol: 'ر.ق' },
  { code: 'KWD', name: 'Kuwaiti Dinar',         symbol: 'KD' },
  { code: 'MYR', name: 'Malaysian Ringgit',     symbol: 'RM' },
  { code: 'THB', name: 'Thai Baht',             symbol: '฿' },
  { code: 'IDR', name: 'Indonesian Rupiah',     symbol: 'Rp' },
  { code: 'PHP', name: 'Philippine Peso',       symbol: '₱' },
  { code: 'BDT', name: 'Bangladeshi Taka',      symbol: '৳' },
  { code: 'PKR', name: 'Pakistani Rupee',       symbol: '₨' },
  { code: 'LKR', name: 'Sri Lankan Rupee',      symbol: 'Rs' },
  { code: 'NPR', name: 'Nepalese Rupee',        symbol: 'रू' },
  { code: 'ZAR', name: 'South African Rand',    symbol: 'R' },
  { code: 'BRL', name: 'Brazilian Real',        symbol: 'R$' },
  { code: 'MXN', name: 'Mexican Peso',          symbol: '$' },
  { code: 'CHF', name: 'Swiss Franc',           symbol: 'CHF' },
  { code: 'JPY', name: 'Japanese Yen',          symbol: '¥' },
  { code: 'CNY', name: 'Chinese Yuan',          symbol: '¥' },
  { code: 'KRW', name: 'South Korean Won',      symbol: '₩' },
  { code: 'HKD', name: 'Hong Kong Dollar',      symbol: 'HK$' },
  { code: 'NZD', name: 'New Zealand Dollar',    symbol: 'NZ$' },
  { code: 'SEK', name: 'Swedish Krona',         symbol: 'kr' },
  { code: 'NOK', name: 'Norwegian Krone',       symbol: 'kr' },
  { code: 'DKK', name: 'Danish Krone',          symbol: 'kr' },
]

interface Props {
  value: string
  onChange: (code: string) => void
  className?: string
}

export default function CurrencySelect({ value, onChange, className = '' }: Props) {
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

  const selected = CURRENCIES.find(c => c.code === value) || CURRENCIES[0]
  const filtered = CURRENCIES.filter(c =>
    `${c.code} ${c.name}`.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between bg-white/[0.06] border border-white/10 rounded-xl px-3 py-2 text-sm text-white hover:border-white/20 focus:outline-none focus:border-violet-500/60 transition-colors"
      >
        <span className="flex items-center gap-2">
          <span className="text-white/50 text-xs font-mono">{selected.code}</span>
          <span className="text-white/70">{selected.name}</span>
          <span className="text-white/30 text-xs">({selected.symbol})</span>
        </span>
        <ChevronDown className={`w-4 h-4 text-white/30 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-[#141420] border border-white/10 rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="p-2 border-b border-white/[0.06]">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
              <input
                autoFocus
                type="text"
                placeholder="Search currencies…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg pl-8 pr-3 py-1.5 text-sm text-white placeholder-white/20 focus:outline-none"
              />
            </div>
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filtered.map(c => (
              <button
                key={c.code}
                type="button"
                onClick={() => { onChange(c.code); setOpen(false); setSearch('') }}
                className={`w-full flex items-center gap-3 px-3 py-2 text-sm text-left hover:bg-white/[0.04] transition-colors ${
                  c.code === value ? 'text-violet-400 bg-violet-500/10' : 'text-white/70'
                }`}
              >
                <span className="font-mono text-xs text-white/40 w-8 flex-shrink-0">{c.code}</span>
                <span className="flex-1">{c.name}</span>
                <span className="text-white/30 text-xs">{c.symbol}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
