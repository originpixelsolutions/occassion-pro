'use client'

/**
 * AssignVendorModal — staff modal for assigning a vendor to an event.
 * Two paths:
 *   1. Search existing vendor accounts (by name / email / category)
 *   2. Add a brand-new vendor inline (name + email are required)
 */

import { useState, useEffect, useRef } from 'react'
import {
  X, Search, User, Building2, Tag, Phone, Globe, Loader2,
  Plus, ChevronRight, Star, Check,
} from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1'

const CATEGORIES = [
  'Catering','Photography','Decor','AV','Transport',
  'Security','Entertainment','Venue','Floral','Cake',
  'Makeup','Invitations','Lighting','Staffing','Other',
]

interface VendorResult {
  id: string
  name: string
  business_name: string | null
  email: string
  category: string
  phone: string | null
  website: string | null
  avg_rating?: number | null
  score?: number | null
}

interface Props {
  eventId: string
  onClose: () => void
  onAssigned: () => void
}

export default function AssignVendorModal({ eventId, onClose, onAssigned }: Props) {
  const [tab, setTab] = useState<'search' | 'new'>('search')

  // ── Search tab state ──────────────────────────────────────────────────────
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [results, setResults] = useState<VendorResult[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<VendorResult | null>(null)
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── New vendor tab state ──────────────────────────────────────────────────
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newBusiness, setNewBusiness] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newCategory, setNewCategory] = useState('Other')

  // ── Shared assignment fields ──────────────────────────────────────────────
  const [description, setDescription] = useState('')
  const [amount, setAmount]           = useState('')
  const [currency, setCurrency]       = useState('INR')
  const [submitting, setSubmitting]   = useState(false)
  const [error, setError]             = useState('')

  // Debounced vendor search
  useEffect(() => {
    if (tab !== 'search') return
    if (searchRef.current) clearTimeout(searchRef.current)
    if (!query.trim() && !category) { setResults([]); return }

    searchRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const params = new URLSearchParams()
        if (query.trim()) params.set('q', query.trim())
        if (category)     params.set('category', category)
        const res = await fetch(`${API}/vendor-portal/staff/vendors/search?${params}`, {
          credentials: 'include',
        })
        if (res.ok) {
          const data = await res.json()
          setResults(data.vendors ?? data)
        }
      } catch {}
      finally { setSearching(false) }
    }, 350)
  }, [query, category, tab])

  // ── Submit ────────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (tab === 'search' && !selected) {
      setError('Please select a vendor from the search results.')
      return
    }
    if (tab === 'new' && (!newName.trim() || !newEmail.trim())) {
      setError('Vendor name and email are required.')
      return
    }

    const body: Record<string, any> = {
      service_description: description.trim() || undefined,
      agreed_amount: amount ? parseFloat(amount) : undefined,
      currency_code: currency,
    }

    if (tab === 'search' && selected) {
      body.vendor_id = selected.id
    } else {
      body.vendor_email    = newEmail.trim()
      body.vendor_name     = newName.trim()
      body.vendor_category = newCategory
    }

    setSubmitting(true)
    try {
      const res = await fetch(`${API}/vendor-portal/staff/events/${eventId}/assignments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.message ?? 'Failed to assign vendor.')
        return
      }
      onAssigned()
      onClose()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-white">Assign Vendor</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Search existing vendors or add a new one</p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-5 pt-3 flex gap-1 shrink-0">
          {(['search', 'new'] as const).map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setSelected(null); setError('') }}
              className={`px-4 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                tab === t
                  ? 'bg-violet-600 text-white'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
            >
              {t === 'search' ? 'Search Existing' : 'Add New Vendor'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="px-5 py-4 space-y-4">

            {/* ── Search tab ─────────────────────────────────────────────── */}
            {tab === 'search' && (
              <>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                    <input
                      value={query}
                      onChange={e => setQuery(e.target.value)}
                      placeholder="Search by name or email…"
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-violet-500"
                      autoFocus
                    />
                  </div>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:border-violet-500"
                  >
                    <option value="">All categories</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                {/* Results */}
                <div className="space-y-1.5 max-h-52 overflow-y-auto">
                  {searching && (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 className="w-4 h-4 text-zinc-500 animate-spin" />
                    </div>
                  )}
                  {!searching && results.length === 0 && (query || category) && (
                    <p className="text-xs text-zinc-500 text-center py-4">No vendors found</p>
                  )}
                  {results.map(v => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setSelected(selected?.id === v.id ? null : v)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                        selected?.id === v.id
                          ? 'bg-violet-600/10 border-violet-500/40'
                          : 'bg-zinc-800/50 border-zinc-700/50 hover:border-zinc-600'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center shrink-0 text-xs font-semibold text-zinc-300">
                        {v.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white truncate">{v.name}</span>
                          <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-400">{v.category}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-zinc-500 truncate">{v.email}</span>
                          {v.business_name && (
                            <span className="text-xs text-zinc-600 truncate">· {v.business_name}</span>
                          )}
                        </div>
                      </div>
                      {v.score != null && (
                        <div className="flex items-center gap-1 shrink-0">
                          <Star className="w-3 h-3 text-amber-400" />
                          <span className="text-xs text-amber-400">{v.score}</span>
                        </div>
                      )}
                      {selected?.id === v.id && (
                        <Check className="w-4 h-4 text-violet-400 shrink-0" />
                      )}
                    </button>
                  ))}
                </div>

                {selected && (
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-violet-500/10 border border-violet-500/20">
                    <Check className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                    <span className="text-xs text-violet-300">
                      Selected: <strong>{selected.name}</strong>
                      {selected.business_name && ` (${selected.business_name})`}
                    </span>
                  </div>
                )}
              </>
            )}

            {/* ── New vendor tab ─────────────────────────────────────────── */}
            {tab === 'new' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs text-zinc-400 mb-1 block">Vendor Name *</label>
                  <input
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="e.g. Shutter Stories Photography"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-violet-500"
                    required
                    autoFocus
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-zinc-400 mb-1 block">Email Address *</label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={e => setNewEmail(e.target.value)}
                    placeholder="vendor@example.com"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-violet-500"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Business Name</label>
                  <input
                    value={newBusiness}
                    onChange={e => setNewBusiness(e.target.value)}
                    placeholder="Optional"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-violet-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Phone</label>
                  <input
                    value={newPhone}
                    onChange={e => setNewPhone(e.target.value)}
                    placeholder="Optional"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-violet-500"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-zinc-400 mb-1 block">Category</label>
                  <select
                    value={newCategory}
                    onChange={e => setNewCategory(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:border-violet-500"
                  >
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
            )}

            {/* ── Shared assignment fields ──────────────────────────────── */}
            <div className="pt-3 border-t border-zinc-800 space-y-3">
              <p className="text-xs text-zinc-500 font-medium uppercase tracking-wide">Assignment Details</p>
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Service Description</label>
                <input
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="e.g. Full-day wedding photography + album"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-violet-500"
                />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-xs text-zinc-400 mb-1 block">Agreed Amount</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-violet-500"
                  />
                </div>
                <div className="w-24">
                  <label className="text-xs text-zinc-400 mb-1 block">Currency</label>
                  <select
                    value={currency}
                    onChange={e => setCurrency(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:border-violet-500"
                  >
                    {['INR','USD','EUR','GBP','AED','SGD'].map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {error && (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-4 border-t border-zinc-800 flex items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs text-zinc-300 hover:text-white border border-zinc-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-1.5 px-5 py-2 text-xs bg-violet-600 hover:bg-violet-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {submitting
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Assigning…</>
                : <><Plus className="w-3.5 h-3.5" /> Assign Vendor</>
              }
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
