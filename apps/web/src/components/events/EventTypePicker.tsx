'use client'

import { useState, useEffect } from 'react'
import { Search, Plus, Check } from 'lucide-react'

interface EventType {
  id: string
  name: string
  icon: string
  color?: string
  is_system: boolean
  description?: string
}

interface Props {
  value: string | null
  onChange: (id: string | null, type?: EventType) => void
  tenantId?: string
  className?: string
}

export default function EventTypePicker({ value, onChange, className = '' }: Props) {
  const [types, setTypes] = useState<EventType[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showCustomForm, setShowCustomForm] = useState(false)
  const [customName, setCustomName] = useState('')
  const [customIcon, setCustomIcon] = useState('📅')

  const apiBase = process.env.NEXT_PUBLIC_API_URL || ''

  useEffect(() => {
    fetch(`${apiBase}/event-types`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then(setTypes)
      .finally(() => setLoading(false))
  }, [apiBase])

  const filtered = types.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()),
  )

  const handleCreateCustom = async () => {
    if (!customName.trim()) return
    const res = await fetch(`${apiBase}/event-types`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: customName, icon: customIcon }),
    })
    if (res.ok) {
      const newType: EventType = await res.json()
      setTypes(prev => [...prev, newType])
      onChange(newType.id, newType)
      setShowCustomForm(false)
      setCustomName('')
    }
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
        <input
          type="text"
          placeholder="Search event types…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-white/[0.04] border border-white/10 rounded-xl pl-8 pr-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-violet-500/60"
        />
      </div>

      {/* Type grid */}
      {loading ? (
        <div className="text-center py-6 text-white/20 text-sm">Loading types…</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-72 overflow-y-auto pr-1">
          {filtered.map(type => {
            const isSelected = value === type.id
            return (
              <button
                key={type.id}
                type="button"
                onClick={() => onChange(isSelected ? null : type.id, type)}
                className={`relative flex flex-col items-center gap-2 p-3 rounded-xl border text-center transition-all duration-150 ${
                  isSelected
                    ? 'border-violet-500/70 bg-violet-500/15'
                    : 'border-white/[0.07] bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]'
                }`}
              >
                {isSelected && (
                  <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-violet-500 rounded-full flex items-center justify-center">
                    <Check className="w-2.5 h-2.5 text-white" />
                  </span>
                )}
                <span className="text-2xl leading-none">{type.icon}</span>
                <span className="text-xs text-white/70 font-medium leading-tight">
                  {type.name}
                </span>
              </button>
            )
          })}

          {/* + Custom button */}
          <button
            type="button"
            onClick={() => setShowCustomForm(v => !v)}
            className="flex flex-col items-center gap-2 p-3 rounded-xl border border-dashed border-white/10 hover:border-violet-500/40 hover:bg-violet-500/5 text-white/30 hover:text-white/60 transition-all"
          >
            <Plus className="w-6 h-6" />
            <span className="text-xs font-medium">Custom</span>
          </button>
        </div>
      )}

      {/* Custom type form */}
      {showCustomForm && (
        <div className="bg-white/[0.04] border border-white/10 rounded-xl p-3 space-y-2">
          <p className="text-xs text-white/40 font-medium uppercase tracking-wider">New Custom Type</p>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Icon emoji"
              value={customIcon}
              onChange={e => setCustomIcon(e.target.value)}
              maxLength={4}
              className="w-16 bg-white/[0.06] border border-white/10 rounded-lg px-2 py-1.5 text-center text-sm text-white focus:outline-none focus:border-violet-500/60"
            />
            <input
              type="text"
              placeholder="Type name"
              value={customName}
              onChange={e => setCustomName(e.target.value)}
              className="flex-1 bg-white/[0.06] border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-violet-500/60"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCreateCustom}
              disabled={!customName.trim()}
              className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-xs rounded-lg transition-colors"
            >
              Create
            </button>
            <button
              type="button"
              onClick={() => setShowCustomForm(false)}
              className="px-3 py-1.5 text-white/40 hover:text-white text-xs transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
