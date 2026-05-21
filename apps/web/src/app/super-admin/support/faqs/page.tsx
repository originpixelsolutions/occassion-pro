'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  BookOpen, Plus, Search, Edit3, Trash2, CheckCircle2,
  XCircle, ArrowLeft, Tag, Loader2, Save, X,
  ChevronDown, ChevronUp, RefreshCw, Eye, EyeOff,
  Sparkles, Hash,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1'

function getToken(): string {
  if (typeof window === 'undefined') return ''
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.includes('supabase') && key.includes('auth')) {
        const raw = localStorage.getItem(key)
        if (raw) {
          const p = JSON.parse(raw)
          return p?.access_token ?? p?.access_token ?? ''
        }
      }
    }
  } catch {}
  return ''
}

async function apiFetch(path: string, options: RequestInit = {}) {
  const token = getToken()
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  })
  if (!res.ok) throw new Error(await res.text())
  if (res.status === 204) return null
  return res.json()
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface FAQ {
  id: string
  question: string
  answer: string
  keywords: string[]
  category: string
  sort_order: number
  is_active: boolean
  use_count: number
  created_at: string
  updated_at: string
}

const CATEGORY_COLORS: Record<string, string> = {
  billing:      'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  events:       'bg-blue-500/15 text-blue-400 border-blue-500/20',
  guests:       'bg-violet-500/15 text-violet-400 border-violet-500/20',
  team:         'bg-amber-500/15 text-amber-400 border-amber-500/20',
  integrations: 'bg-pink-500/15 text-pink-400 border-pink-500/20',
  general:      'bg-slate-500/15 text-slate-400 border-slate-500/20',
  security:     'bg-red-500/15 text-red-400 border-red-500/20',
  api:          'bg-cyan-500/15 text-cyan-400 border-cyan-500/20',
}

const SUGGESTED_CATEGORIES = [
  'general', 'billing', 'events', 'guests', 'team', 'integrations', 'security', 'api',
]

// ─── FAQ Form ─────────────────────────────────────────────────────────────────

function FAQForm({
  initial,
  categories,
  onSave,
  onCancel,
}: {
  initial?: Partial<FAQ>
  categories: string[]
  onSave: (data: any) => Promise<void>
  onCancel: () => void
}) {
  const [form, setForm] = useState({
    question:   initial?.question   ?? '',
    answer:     initial?.answer     ?? '',
    category:   initial?.category   ?? 'general',
    keywords:   initial?.keywords?.join(', ') ?? '',
    sort_order: initial?.sort_order ?? 0,
    is_active:  initial?.is_active  ?? true,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const allCategories = Array.from(new Set([...SUGGESTED_CATEGORIES, ...categories]))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.question.trim() || !form.answer.trim()) {
      setError('Question and Answer are required.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await onSave({
        question:   form.question.trim(),
        answer:     form.answer.trim(),
        category:   form.category,
        keywords:   form.keywords.split(',').map((k) => k.trim()).filter(Boolean),
        sort_order: Number(form.sort_order),
        is_active:  form.is_active,
      })
    } catch (err: any) {
      setError(err.message ?? 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Question */}
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">
          Question <span className="text-red-400">*</span>
        </label>
        <input
          value={form.question}
          onChange={(e) => setForm({ ...form, question: e.target.value })}
          placeholder="What is the maximum number of guests per event?"
          className="w-full px-3 py-2.5 bg-muted rounded-lg text-sm border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
      </div>

      {/* Answer */}
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">
          Answer <span className="text-red-400">*</span>
        </label>
        <textarea
          value={form.answer}
          onChange={(e) => setForm({ ...form, answer: e.target.value })}
          rows={5}
          placeholder="The maximum number of guests depends on your plan. Free plan allows up to 50 guests per event…"
          className="w-full px-3 py-2.5 bg-muted rounded-lg text-sm border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
        />
      </div>

      {/* Category + Sort Order */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Category</label>
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="w-full px-3 py-2.5 bg-muted rounded-lg text-sm border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            {allCategories.map((c) => (
              <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Sort Order</label>
          <input
            type="number"
            value={form.sort_order}
            onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })}
            className="w-full px-3 py-2.5 bg-muted rounded-lg text-sm border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>
      </div>

      {/* Keywords */}
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">
          Keywords <span className="text-muted-foreground/60">(comma-separated, used for bot search)</span>
        </label>
        <input
          value={form.keywords}
          onChange={(e) => setForm({ ...form, keywords: e.target.value })}
          placeholder="guests, limit, maximum, plan"
          className="w-full px-3 py-2.5 bg-muted rounded-lg text-sm border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
      </div>

      {/* Active toggle */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setForm({ ...form, is_active: !form.is_active })}
          className={cn(
            'relative w-10 h-5.5 rounded-full transition-colors border',
            form.is_active ? 'bg-emerald-500/80 border-emerald-500/40' : 'bg-muted border-border',
          )}
          style={{ height: '22px', width: '40px' }}
        >
          <span
            className={cn(
              'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform',
              form.is_active ? 'translate-x-5' : 'translate-x-0.5',
            )}
          />
        </button>
        <span className="text-sm text-foreground">Active (visible to bot & users)</span>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-2.5 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="flex-1 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {initial?.id ? 'Update FAQ' : 'Create FAQ'}
        </button>
      </div>
    </form>
  )
}

// ─── FAQ Row ──────────────────────────────────────────────────────────────────

function FAQRow({
  faq,
  onEdit,
  onDelete,
  onToggle,
}: {
  faq: FAQ
  onEdit: (faq: FAQ) => void
  onDelete: (id: string) => void
  onToggle: (id: string, active: boolean) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const catColor = CATEGORY_COLORS[faq.category] ?? CATEGORY_COLORS.general

  const handleDelete = async () => {
    if (!confirm(`Delete FAQ "${faq.question.slice(0, 60)}…"?`)) return
    setDeleting(true)
    onDelete(faq.id)
  }

  return (
    <div
      className={cn(
        'border border-border rounded-xl overflow-hidden transition-all',
        !faq.is_active && 'opacity-60',
      )}
    >
      <div className="flex items-start gap-3 px-4 py-3">
        {/* Sort order */}
        <span className="w-7 h-7 rounded-md bg-muted flex items-center justify-center text-xs text-muted-foreground font-mono shrink-0 mt-0.5">
          {faq.sort_order}
        </span>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2 mb-1">
            <p
              className="text-sm font-medium text-foreground leading-snug cursor-pointer hover:text-violet-400 transition-colors flex-1"
              onClick={() => setExpanded((v) => !v)}
            >
              {faq.question}
            </p>
            <span className={cn('shrink-0 text-[10px] px-2 py-0.5 rounded-full border font-medium capitalize', catColor)}>
              {faq.category}
            </span>
          </div>

          {expanded && (
            <div className="mt-2 p-3 bg-muted/40 rounded-lg">
              <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">{faq.answer}</p>
              {faq.keywords.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {faq.keywords.map((kw) => (
                    <span key={kw} className="flex items-center gap-1 text-[10px] px-2 py-0.5 bg-muted border border-border rounded-full text-muted-foreground">
                      <Hash className="w-2.5 h-2.5" />{kw}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              {faq.use_count ?? 0} bot uses
            </span>
            <span>Updated {new Date(faq.updated_at).toLocaleDateString()}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onToggle(faq.id, !faq.is_active)}
            title={faq.is_active ? 'Deactivate' : 'Activate'}
            className={cn(
              'p-1.5 rounded-lg transition-colors',
              faq.is_active
                ? 'text-emerald-400 hover:bg-emerald-500/10'
                : 'text-muted-foreground hover:bg-muted/50',
            )}
          >
            {faq.is_active ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => onEdit(faq)}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-violet-400 hover:bg-violet-500/10 transition-colors"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40"
          >
            {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SuperAdminFAQsPage() {
  const router = useRouter()
  const [faqs, setFaqs]           = useState<FAQ[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [loading, setLoading]     = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch]       = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [showForm, setShowForm]   = useState(false)
  const [editingFaq, setEditingFaq] = useState<FAQ | null>(null)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const data = await apiFetch('/super-admin/support/faqs')
      setFaqs(Array.isArray(data) ? data : [])
      const cats = Array.from(new Set((data ?? []).map((f: FAQ) => f.category))) as string[]
      setCategories(cats)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleCreate = async (dto: any) => {
    await apiFetch('/super-admin/support/faqs', {
      method: 'POST',
      body: JSON.stringify(dto),
    })
    setShowForm(false)
    await load(true)
  }

  const handleUpdate = async (dto: any) => {
    if (!editingFaq) return
    await apiFetch(`/super-admin/support/faqs/${editingFaq.id}`, {
      method: 'PATCH',
      body: JSON.stringify(dto),
    })
    setEditingFaq(null)
    await load(true)
  }

  const handleDelete = async (id: string) => {
    try {
      await apiFetch(`/super-admin/support/faqs/${id}`, { method: 'DELETE' })
      setFaqs((prev) => prev.filter((f) => f.id !== id))
    } catch (e) {
      console.error(e)
    }
  }

  const handleToggle = async (id: string, active: boolean) => {
    try {
      await apiFetch(`/super-admin/support/faqs/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: active }),
      })
      setFaqs((prev) => prev.map((f) => f.id === id ? { ...f, is_active: active } : f))
    } catch (e) {
      console.error(e)
    }
  }

  const filtered = faqs
    .filter((f) => showInactive || f.is_active)
    .filter((f) => !catFilter || f.category === catFilter)
    .filter((f) =>
      !search ||
      f.question.toLowerCase().includes(search.toLowerCase()) ||
      f.answer.toLowerCase().includes(search.toLowerCase()) ||
      f.keywords.some((k) => k.toLowerCase().includes(search.toLowerCase())),
    )

  const activeCount   = faqs.filter((f) => f.is_active).length
  const inactiveCount = faqs.filter((f) => !f.is_active).length
  const totalUses     = faqs.reduce((s, f) => s + (f.use_count ?? 0), 0)

  const allCategories = Array.from(new Set(faqs.map((f) => f.category)))

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Header */}
      <div className="shrink-0 px-6 py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/super-admin/support')}
            className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="w-9 h-9 rounded-lg bg-amber-500/20 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h1 className="font-semibold text-foreground">FAQ Knowledge Base</h1>
            <p className="text-xs text-muted-foreground">Manage bot responses and help articles</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="p-2 rounded-lg hover:bg-muted/50 text-muted-foreground transition-colors"
          >
            <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
          </button>
          <button
            onClick={() => { setEditingFaq(null); setShowForm(true) }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            New FAQ
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="shrink-0 px-6 py-3 border-b border-border flex gap-6">
        {[
          { label: 'Total FAQs',    value: faqs.length,   color: 'text-foreground' },
          { label: 'Active',        value: activeCount,   color: 'text-emerald-400' },
          { label: 'Inactive',      value: inactiveCount, color: 'text-muted-foreground' },
          { label: 'Bot Uses',      value: totalUses,     color: 'text-violet-400' },
          { label: 'Categories',    value: allCategories.length, color: 'text-blue-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="flex items-baseline gap-1.5">
            <span className={cn('text-xl font-bold', color)}>{value}</span>
            <span className="text-xs text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="shrink-0 px-6 py-3 border-b border-border flex items-center gap-3 flex-wrap">
        {/* Category filter */}
        <div className="flex gap-1 flex-wrap">
          <button
            onClick={() => setCatFilter('')}
            className={cn(
              'px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
              !catFilter ? 'bg-violet-500/20 text-violet-400' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            All
          </button>
          {allCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCatFilter(cat === catFilter ? '' : cat)}
              className={cn(
                'px-2.5 py-1 rounded-md text-xs font-medium transition-colors capitalize',
                catFilter === cat ? 'bg-violet-500/20 text-violet-400' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Show inactive toggle */}
        <button
          onClick={() => setShowInactive((v) => !v)}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors',
            showInactive
              ? 'bg-muted text-foreground border-border'
              : 'border-border/50 text-muted-foreground hover:text-foreground hover:border-border',
          )}
        >
          {showInactive ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          {showInactive ? 'Hiding inactive' : 'Show inactive'}
        </button>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search FAQs…"
            className="pl-8 pr-3 py-1.5 bg-muted rounded-lg text-xs border border-border text-foreground placeholder:text-muted-foreground focus:outline-none w-48"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24 text-muted-foreground">
            <BookOpen className="w-8 h-8 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">No FAQs found</p>
            <p className="text-xs mt-1">
              {faqs.length === 0 ? 'Create your first FAQ to power the support bot.' : 'Try adjusting your filters.'}
            </p>
            {faqs.length === 0 && (
              <button
                onClick={() => { setEditingFaq(null); setShowForm(true) }}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" /> Create first FAQ
              </button>
            )}
          </div>
        ) : (
          filtered
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((faq) => (
              <FAQRow
                key={faq.id}
                faq={faq}
                onEdit={(f) => { setEditingFaq(f); setShowForm(true) }}
                onDelete={handleDelete}
                onToggle={handleToggle}
              />
            ))
        )}
      </div>

      {/* Create / Edit slide-over panel */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="flex-1 bg-black/50 backdrop-blur-sm"
            onClick={() => { setShowForm(false); setEditingFaq(null) }}
          />
          <div className="w-full max-w-lg bg-background border-l border-border overflow-y-auto flex flex-col">
            {/* Panel header */}
            <div className="shrink-0 px-6 py-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-violet-400" />
                <h2 className="font-semibold text-foreground">
                  {editingFaq ? 'Edit FAQ' : 'Create FAQ'}
                </h2>
              </div>
              <button
                onClick={() => { setShowForm(false); setEditingFaq(null) }}
                className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 px-6 py-5">
              <FAQForm
                initial={editingFaq ?? undefined}
                categories={allCategories}
                onSave={editingFaq ? handleUpdate : handleCreate}
                onCancel={() => { setShowForm(false); setEditingFaq(null) }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
