'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  CalendarDays, Plus, Trash2, Pencil, Lock,
  Loader2, RefreshCw, Check, X,
} from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'
import { cn } from '@/lib/utils'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/v1'

// ── Types ──────────────────────────────────────────────────────────────────────

type EventType = {
  id: string
  name: string
  slug: string
  icon: string
  description: string | null
  color: string
  is_system: boolean
  tenant_id: string | null
  sort_order: number
}

// ── Colour swatch presets ──────────────────────────────────────────────────────

const COLOR_PRESETS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#06b6d4', '#64748b', '#a855f7',
]

// ── Emoji quick-picks ──────────────────────────────────────────────────────────

const EMOJI_PICKS = [
  '🎉', '🎤', '🎸', '🎭', '💍', '🎂', '🏆', '🤝',
  '🎓', '🌍', '🏟️', '🎪', '📅', '🎯', '✨', '🔥',
]

// ── Create / Edit Modal ────────────────────────────────────────────────────────

function EventTypeModal({
  initial,
  onClose,
  onSaved,
  token,
}: {
  initial?: EventType
  onClose: () => void
  onSaved: () => void
  token: string
}) {
  const isEdit = !!initial
  const [name, setName]             = useState(initial?.name        ?? '')
  const [icon, setIcon]             = useState(initial?.icon        ?? '📅')
  const [description, setDesc]      = useState(initial?.description ?? '')
  const [color, setColor]           = useState(initial?.color       ?? '#6366f1')
  const [customIcon, setCustomIcon] = useState('')
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState('')

  const handleSave = async () => {
    if (!name.trim()) { setError('Name is required'); return }
    setSaving(true)
    setError('')
    try {
      const url    = isEdit ? `${API}/event-types/${initial!.id}` : `${API}/event-types`
      const method = isEdit ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: name.trim(), icon, description: description.trim(), color }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setError(err.message ?? 'Failed to save')
        return
      }
      onSaved()
      onClose()
    } catch {
      setError('Network error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md shadow-xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-foreground">
            {isEdit ? 'Edit Event Type' : 'New Event Type'}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Preview badge */}
        <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-surface/40">
          <span className="text-2xl">{icon}</span>
          <div>
            <p
              className="text-sm font-semibold"
              style={{ color }}
            >
              {name || 'Event Type Name'}
            </p>
            {description && (
              <p className="text-xs text-muted-foreground line-clamp-1">{description}</p>
            )}
          </div>
        </div>

        {/* Name */}
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Name *</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Corporate Summit"
            className="w-full px-3 py-2 rounded-lg bg-muted/40 border border-border/60 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
          />
        </div>

        {/* Emoji */}
        <div>
          <label className="text-xs text-muted-foreground mb-2 block">Icon / Emoji</label>
          <div className="grid grid-cols-8 gap-1.5 mb-2">
            {EMOJI_PICKS.map(e => (
              <button
                key={e}
                onClick={() => { setIcon(e); setCustomIcon('') }}
                className={cn(
                  'h-8 w-8 rounded-lg text-base flex items-center justify-center transition-all border',
                  icon === e
                    ? 'border-primary/60 bg-primary/10'
                    : 'border-border hover:border-border/80 hover:bg-muted/40',
                )}
              >
                {e}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              value={customIcon}
              onChange={e => { setCustomIcon(e.target.value); if (e.target.value) setIcon(e.target.value) }}
              placeholder="Or type any emoji…"
              className="flex-1 px-3 py-1.5 rounded-lg bg-muted/40 border border-border/60 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
            />
          </div>
        </div>

        {/* Colour */}
        <div>
          <label className="text-xs text-muted-foreground mb-2 block">Colour</label>
          <div className="flex flex-wrap gap-2">
            {COLOR_PRESETS.map(c => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={cn(
                  'h-6 w-6 rounded-full transition-all border-2',
                  color === c ? 'border-foreground scale-110' : 'border-transparent hover:scale-105',
                )}
                style={{ backgroundColor: c }}
              />
            ))}
            <input
              type="color"
              value={color}
              onChange={e => setColor(e.target.value)}
              className="h-6 w-6 rounded-full cursor-pointer border-0 bg-transparent"
              title="Custom colour"
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Description</label>
          <input
            value={description}
            onChange={e => setDesc(e.target.value)}
            placeholder="Short description (optional)"
            className="w-full px-3 py-2 rounded-lg bg-muted/40 border border-border/60 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
          />
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}

        {/* Actions */}
        <div className="flex gap-2 justify-end pt-1">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-muted/40 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="flex items-center gap-1.5 px-4 py-1.5 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {isEdit ? 'Save Changes' : 'Create Type'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Event Type Card ────────────────────────────────────────────────────────────

function EventTypeCard({
  et,
  onEdit,
  onDelete,
  deleting,
}: {
  et: EventType
  onEdit: (et: EventType) => void
  onDelete: (id: string) => void
  deleting: boolean
}) {
  return (
    <div className="group flex items-center gap-4 px-4 py-3 rounded-xl border border-border bg-card hover:bg-surface/50 transition-colors">
      {/* Icon */}
      <div
        className="h-10 w-10 rounded-xl flex items-center justify-center text-xl shrink-0"
        style={{ backgroundColor: `${et.color}18` }}
      >
        {et.icon}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className="text-sm font-semibold truncate"
            style={{ color: et.color }}
          >
            {et.name}
          </span>
          {et.is_system && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-muted/60 text-muted-foreground">
              <Lock className="w-2.5 h-2.5" />
              System
            </span>
          )}
        </div>
        {et.description && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">{et.description}</p>
        )}
      </div>

      {/* Colour dot */}
      <div
        className="h-3 w-3 rounded-full shrink-0 opacity-60"
        style={{ backgroundColor: et.color }}
      />

      {/* Actions (custom only) */}
      {!et.is_system && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onEdit(et)}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDelete(et.id)}
            disabled={deleting}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-50"
          >
            {deleting
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Trash2 className="w-3.5 h-3.5" />
            }
          </button>
        </div>
      )}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function EventTypesPage() {
  const { token } = useAuth()
  const [types, setTypes]       = useState<EventType[]>([])
  const [loading, setLoading]   = useState(true)
  const [showModal, setModal]   = useState(false)
  const [editing, setEditing]   = useState<EventType | undefined>(undefined)
  const [deletingId, setDelId]  = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const res = await fetch(`${API}/event-types`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) return
      const data = await res.json()
      setTypes(Array.isArray(data) ? data : (data.data ?? []))
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [token])

  useEffect(() => { load() }, [load])

  const handleDelete = async (id: string) => {
    if (!token) return
    setDelId(id)
    try {
      await fetch(`${API}/event-types/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      setTypes(prev => prev.filter(t => t.id !== id))
    } catch { /* silent */ }
    finally { setDelId(null) }
  }

  const openCreate = () => { setEditing(undefined); setModal(true) }
  const openEdit   = (et: EventType) => { setEditing(et); setModal(true) }

  const systemTypes = types.filter(t => t.is_system)
  const customTypes = types.filter(t => !t.is_system)

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Modal */}
      {showModal && token && (
        <EventTypeModal
          initial={editing}
          token={token}
          onClose={() => { setModal(false); setEditing(undefined) }}
          onSaved={load}
        />
      )}

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Event Types</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Define the categories of events your workspace supports.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="p-2 rounded-lg border border-border hover:bg-muted/40 text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground text-sm rounded-lg font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>New Type</span>
          </button>
        </div>
      </div>

      {/* Info banner */}
      <div className="bg-card border border-border rounded-xl p-4 flex items-start gap-3">
        <CalendarDays className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">About Event Types</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            System types are built-in and cover the most common event categories. They cannot be
            modified or deleted. Custom types let you define specialised categories specific to
            your business — each type can have a unique icon, colour, and description.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map(i => (
            <div
              key={i}
              className="flex items-center gap-4 px-4 py-3 rounded-xl border border-border animate-pulse"
            >
              <div className="h-10 w-10 rounded-xl bg-muted/60" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 w-36 rounded bg-muted/60" />
                <div className="h-3 w-56 rounded bg-muted/40" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* System types */}
          {systemTypes.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground opacity-60 px-1">
                System Types ({systemTypes.length})
              </p>
              {systemTypes.map(et => (
                <EventTypeCard
                  key={et.id}
                  et={et}
                  onEdit={openEdit}
                  onDelete={handleDelete}
                  deleting={deletingId === et.id}
                />
              ))}
            </div>
          )}

          {/* Custom types */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground opacity-60 px-1">
              Custom Types ({customTypes.length})
            </p>
            {customTypes.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-8 text-center">
                <p className="text-sm text-muted-foreground mb-3">
                  No custom event types yet
                </p>
                <button
                  onClick={openCreate}
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-medium"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Create your first type
                </button>
              </div>
            ) : (
              customTypes.map(et => (
                <EventTypeCard
                  key={et.id}
                  et={et}
                  onEdit={openEdit}
                  onDelete={handleDelete}
                  deleting={deletingId === et.id}
                />
              ))
            )}
          </div>
        </>
      )}

      {/* Footer count */}
      {!loading && types.length > 0 && (
        <p className="text-xs text-muted-foreground text-right">
          {types.length} total event types ({systemTypes.length} system, {customTypes.length} custom)
        </p>
      )}
    </div>
  )
}
