'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import { useSession } from '@/lib/auth/useSession'
import { usePresence, PresenceAvatars } from '@/lib/realtime/usePresence'
import { useRunsheetGateway, type TypingIndicator } from '@/lib/realtime/useRunsheetGateway'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Lock, Unlock, History, Download, ChevronRight, ChevronDown,
  Plus, GripVertical, MessageSquare, Eye, EyeOff, Clock,
  CheckCircle2, PlayCircle, SkipForward, AlertTriangle,
  Circle, ChevronUp, Edit2, Trash2, Save, X, Wifi, WifiOff,
  Sun, Zap, MoreHorizontal, Flag, Users, Tag, StickyNote,
  RotateCcw, FileText, Sheet
} from 'lucide-react'
import { format, differenceInMinutes, parseISO, addMinutes } from 'date-fns'

// ─── Types ────────────────────────────────────────────────────────────────────

type ItemStatus = 'pending' | 'in_progress' | 'completed' | 'skipped' | 'delayed'
type ViewMode = 'timeline' | 'list'

interface RunsheetItem {
  id: string
  runsheet_id: string
  parent_id: string | null
  position: number
  start_time: string | null
  end_time: string | null
  duration_minutes: number | null
  title: string
  description: string | null
  category: string
  assigned_to: string[]
  assigned_vendors: string[]
  status: ItemStatus
  delay_minutes: number
  is_guest_visible: boolean
  notes: string | null
  color: string | null
  comment_count: number
  children?: RunsheetItem[]
  created_at: string
  updated_at: string
}

interface Runsheet {
  id: string
  event_id: string
  title: string
  is_locked: boolean
  locked_by: string | null
  version: number
  created_by: string
  items: RunsheetItem[]
}

interface PresenceUser {
  userId: string
  userName: string
  avatar?: string
  color: string
  activeItemId?: string
}

interface Version {
  id: string
  version: number
  label: string | null
  created_by: string
  created_at: string
}

interface Comment {
  id: string
  item_id: string
  user_id: string
  comment: string
  created_at: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

const CATEGORY_COLORS: Record<string, string> = {
  Setup:       'bg-slate-500/20 text-slate-300 border-slate-500/30',
  Ceremony:    'bg-rose-500/20 text-rose-300 border-rose-500/30',
  Reception:   'bg-pink-500/20 text-pink-300 border-pink-500/30',
  Performance: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  Speech:      'bg-blue-500/20 text-blue-300 border-blue-500/30',
  Catering:    'bg-amber-500/20 text-amber-300 border-amber-500/30',
  Technical:   'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  Transport:   'bg-green-500/20 text-green-300 border-green-500/30',
  VIP:         'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  Media:       'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
  Rehearsal:   'bg-teal-500/20 text-teal-300 border-teal-500/30',
  Breakdown:   'bg-orange-500/20 text-orange-300 border-orange-500/30',
  Other:       'bg-zinc-500/20 text-zinc-300 border-zinc-500/30',
}

const STATUS_CONFIG: Record<ItemStatus, { label: string; color: string; icon: React.ReactNode }> = {
  pending:     { label: 'Pending',     color: '#71717a', icon: <Circle size={14} /> },
  in_progress: { label: 'In Progress', color: '#3b82f6', icon: <PlayCircle size={14} /> },
  completed:   { label: 'Completed',   color: '#22c55e', icon: <CheckCircle2 size={14} /> },
  skipped:     { label: 'Skipped',     color: '#a1a1aa', icon: <SkipForward size={14} /> },
  delayed:     { label: 'Delayed',     color: '#f59e0b', icon: <AlertTriangle size={14} /> },
}

const CATEGORIES = ['Setup','Ceremony','Reception','Performance','Speech','Catering','Technical','Transport','VIP','Media','Rehearsal','Breakdown','Other']

function getToken(): string | null {
  try {
    const keys = Object.keys(localStorage).filter((k) => k.includes('supabase') && k.includes('auth'))
    if (keys.length > 0) {
      const raw = localStorage.getItem(keys[0])
      if (raw) return JSON.parse(raw)?.access_token ?? null
    }
    return null
  } catch { return null }
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

// ─── Status Dot ──────────────────────────────────────────────────────────────

function StatusDot({
  status,
  size = 'sm',
  flash = false,
  onClick,
}: {
  status: ItemStatus
  size?: 'sm' | 'lg'
  flash?: boolean
  onClick?: (e: React.MouseEvent) => void
}) {
  const cfg = STATUS_CONFIG[status]
  const dim = size === 'lg' ? 'w-5 h-5' : 'w-3.5 h-3.5'
  return (
    <button
      onClick={onClick}
      className={`${dim} rounded-full flex items-center justify-center flex-shrink-0 transition-all
        ${flash ? 'animate-pulse scale-125' : ''}
        ${onClick ? 'cursor-pointer hover:ring-2 hover:ring-white/20' : 'cursor-default'}`}
      style={{ backgroundColor: cfg.color + '33', color: cfg.color, border: `1.5px solid ${cfg.color}` }}
      title={cfg.label}
    >
      <span style={{ color: cfg.color }}>{cfg.icon}</span>
    </button>
  )
}

// ─── Status Dropdown ─────────────────────────────────────────────────────────

function StatusDropdown({
  current,
  onSelect,
  onClose,
}: {
  current: ItemStatus
  onSelect: (s: ItemStatus, delay?: number) => void
  onClose: () => void
}) {
  const [delay, setDelay] = useState(0)
  const [showDelay, setShowDelay] = useState(false)

  return (
    <div className="absolute z-50 top-6 left-0 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl p-2 w-52 text-sm">
      {(Object.keys(STATUS_CONFIG) as ItemStatus[]).map((s) => {
        const cfg = STATUS_CONFIG[s]
        return (
          <button
            key={s}
            onClick={() => {
              if (s === 'delayed') { setShowDelay(true); return }
              onSelect(s)
              onClose()
            }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-zinc-800 transition-colors
              ${current === s ? 'bg-zinc-800' : ''}`}
          >
            <span style={{ color: cfg.color }}>{cfg.icon}</span>
            <span className="text-zinc-200">{cfg.label}</span>
          </button>
        )
      })}
      {showDelay && (
        <div className="mt-2 pt-2 border-t border-zinc-700">
          <p className="text-xs text-zinc-400 mb-1.5 px-1">Delay (minutes)</p>
          <div className="flex gap-2 px-1">
            <input
              type="number"
              min={1}
              value={delay}
              onChange={(e) => setDelay(Number(e.target.value))}
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-sm text-white"
            />
            <button
              onClick={() => { onSelect('delayed', delay); onClose() }}
              className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-black rounded-lg text-xs font-medium"
            >
              Set
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Quick Add Form ───────────────────────────────────────────────────────────

function QuickAddForm({
  onAdd,
  onCancel,
  defaultTime,
}: {
  onAdd: (title: string, startTime?: string, category?: string) => void
  onCancel: () => void
  defaultTime?: string
}) {
  const [title, setTitle] = useState('')
  const [time, setTime] = useState(defaultTime ?? '')
  const [category, setCategory] = useState('Other')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    onAdd(title.trim(), time || undefined, category)
  }

  return (
    <motion.form
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      onSubmit={handleSubmit}
      className="bg-zinc-900 border border-violet-500/40 rounded-xl p-3 flex items-center gap-2"
    >
      <input
        ref={inputRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Item title..."
        className="flex-1 bg-transparent text-white text-sm outline-none placeholder:text-zinc-500"
      />
      <input
        type="time"
        value={time}
        onChange={(e) => setTime(e.target.value)}
        className="bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-xs text-zinc-300 w-24"
      />
      <select
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        className="bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-xs text-zinc-300"
      >
        {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <button type="submit" className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-xs font-medium">
        Add
      </button>
      <button type="button" onClick={onCancel} className="p-1.5 text-zinc-500 hover:text-zinc-300">
        <X size={14} />
      </button>
    </motion.form>
  )
}

// ─── Edit Side Panel ──────────────────────────────────────────────────────────

function EditPanel({
  item,
  comments,
  onSave,
  onClose,
  onAddComment,
  onTyping,
  presenceUsers,
  typingIndicators,
  currentUserId,
}: {
  item: RunsheetItem
  comments: Comment[]
  onSave: (id: string, data: Partial<RunsheetItem>) => Promise<void>
  onClose: () => void
  onAddComment: (itemId: string, comment: string) => Promise<void>
  onTyping?: (field: string) => void
  presenceUsers: PresenceUser[]
  typingIndicators?: Map<string, TypingIndicator>
  currentUserId: string
}) {
  const [form, setForm] = useState({
    title: item.title,
    description: item.description ?? '',
    category: item.category,
    start_time: item.start_time ? format(parseISO(item.start_time), "yyyy-MM-dd'T'HH:mm") : '',
    end_time: item.end_time ? format(parseISO(item.end_time), "yyyy-MM-dd'T'HH:mm") : '',
    duration_minutes: item.duration_minutes ?? '',
    notes: item.notes ?? '',
    color: item.color ?? '',
    is_guest_visible: item.is_guest_visible,
  })
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)
  const [addingComment, setAddingComment] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(item.id, {
        title: form.title,
        description: form.description || null,
        category: form.category as any,
        start_time: form.start_time || null,
        end_time: form.end_time || null,
        duration_minutes: form.duration_minutes ? Number(form.duration_minutes) : null,
        notes: form.notes || null,
        color: form.color || null,
        is_guest_visible: form.is_guest_visible,
      })
    } finally {
      setSaving(false)
    }
  }

  const handleComment = async () => {
    if (!comment.trim()) return
    setAddingComment(true)
    try {
      await onAddComment(item.id, comment.trim())
      setComment('')
    } finally {
      setAddingComment(false)
    }
  }

  // Who's editing this item right now
  const editingUsers = presenceUsers.filter(
    (u) => u.activeItemId === item.id && u.userId !== currentUserId,
  )

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      className="fixed inset-y-0 right-0 w-[460px] bg-zinc-950 border-l border-zinc-800 shadow-2xl z-50 flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <StatusDot status={item.status} />
          <h3 className="font-semibold text-white text-sm truncate max-w-[280px]">{item.title}</h3>
        </div>
        <div className="flex items-center gap-2">
          {editingUsers.length > 0 && (
            <div className="flex -space-x-1">
              {editingUsers.slice(0, 3).map((u) => (
                <div
                  key={u.userId}
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ring-2 ring-zinc-950"
                  style={{ backgroundColor: u.color }}
                  title={u.userName}
                >
                  {u.userName[0].toUpperCase()}
                </div>
              ))}
            </div>
          )}
          <button onClick={handleSave} disabled={saving} className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-xs font-medium flex items-center gap-1.5">
            <Save size={12} />
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button onClick={onClose} className="p-1.5 text-zinc-500 hover:text-zinc-300 rounded-lg hover:bg-zinc-800">
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Form fields */}
        <div className="p-5 space-y-4">
          {/* Title */}
          <div>
            <label className="text-xs font-medium text-zinc-400 mb-1.5 block">Title</label>
            <input
              value={form.title}
              onChange={(e) => { setForm((f) => ({ ...f, title: e.target.value })); onTyping?.('title') }}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:border-violet-500 outline-none"
            />
            {typingIndicators?.get(item.id)?.field === 'title' && (
              <p className="text-xs mt-1" style={{ color: typingIndicators.get(item.id)!.color }}>
                {typingIndicators.get(item.id)!.userName} is typing…
              </p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-medium text-zinc-400 mb-1.5 block">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => { setForm((f) => ({ ...f, description: e.target.value })); onTyping?.('description') }}
              rows={3}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:border-violet-500 outline-none resize-none"
            />
            {typingIndicators?.get(item.id)?.field === 'description' && (
              <p className="text-xs mt-1" style={{ color: typingIndicators.get(item.id)!.color }}>
                {typingIndicators.get(item.id)!.userName} is typing…
              </p>
            )}
          </div>

          {/* Category + Color */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-zinc-400 mb-1.5 block">Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:border-violet-500 outline-none"
              >
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-400 mb-1.5 block">Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.color || '#3b82f6'}
                  onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                  className="w-10 h-9 bg-zinc-900 border border-zinc-800 rounded-lg cursor-pointer p-0.5"
                />
                <input
                  value={form.color}
                  onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                  placeholder="#3b82f6"
                  className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-2 text-xs text-zinc-300 focus:border-violet-500 outline-none font-mono"
                />
              </div>
            </div>
          </div>

          {/* Time fields */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-zinc-400 mb-1.5 block">Start Time</label>
              <input
                type="datetime-local"
                value={form.start_time}
                onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-2 text-xs text-zinc-300 focus:border-violet-500 outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-400 mb-1.5 block">End Time</label>
              <input
                type="datetime-local"
                value={form.end_time}
                onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-2 text-xs text-zinc-300 focus:border-violet-500 outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-400 mb-1.5 block">Duration (min)</label>
              <input
                type="number"
                min={1}
                value={form.duration_minutes}
                onChange={(e) => setForm((f) => ({ ...f, duration_minutes: e.target.value }))}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-2 text-xs text-zinc-300 focus:border-violet-500 outline-none"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-medium text-zinc-400 mb-1.5 block">
              <StickyNote size={12} className="inline mr-1" />Notes
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={3}
              placeholder="Internal notes..."
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-300 focus:border-violet-500 outline-none resize-none"
            />
          </div>

          {/* Guest visible */}
          <label className="flex items-center gap-3 cursor-pointer p-3 bg-zinc-900 border border-zinc-800 rounded-xl hover:border-zinc-700 transition-colors">
            <div
              onClick={() => setForm((f) => ({ ...f, is_guest_visible: !f.is_guest_visible }))}
              className={`relative w-9 h-5 rounded-full transition-colors ${form.is_guest_visible ? 'bg-violet-600' : 'bg-zinc-700'}`}
            >
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${form.is_guest_visible ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </div>
            <div>
              <p className="text-sm text-zinc-200">Show on Guest Portal</p>
              <p className="text-xs text-zinc-500">Guests will see this in their itinerary</p>
            </div>
          </label>
        </div>

        {/* Comments */}
        <div className="px-5 pb-5">
          <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <MessageSquare size={12} />
            Comments ({comments.length})
          </h4>
          <div className="space-y-3 mb-3 max-h-48 overflow-y-auto">
            {comments.length === 0 && (
              <p className="text-xs text-zinc-600 text-center py-4">No comments yet</p>
            )}
            {comments.map((c) => (
              <div key={c.id} className="bg-zinc-900 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-5 h-5 rounded-full bg-violet-600 flex items-center justify-center text-xs font-bold text-white">
                    U
                  </div>
                  <span className="text-xs text-zinc-500">{format(parseISO(c.created_at), 'MMM d, HH:mm')}</span>
                </div>
                <p className="text-sm text-zinc-300">{c.comment}</p>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleComment() }}
              placeholder="Add a comment..."
              className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:border-violet-500 outline-none"
            />
            <button
              onClick={handleComment}
              disabled={addingComment || !comment.trim()}
              className="px-3 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-medium disabled:opacity-40"
            >
              Post
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Runsheet Item Card ───────────────────────────────────────────────────────

function RunsheetItemCard({
  item,
  onStatusChange,
  onExpand,
  isExpanded,
  onEdit,
  onDelete,
  onInsertBelow,
  presenceUsers,
  currentUserId,
  isCurrentItem,
  isDayOfMode,
  onDragStart,
  onDragOver,
  onDrop,
  draggingId,
  flashStatuses,
}: {
  item: RunsheetItem
  onStatusChange: (id: string, status: ItemStatus, delay?: number) => void
  onExpand: (id: string) => void
  isExpanded: boolean
  onEdit: (item: RunsheetItem) => void
  onDelete: (id: string) => void
  onInsertBelow: (afterItem: RunsheetItem) => void
  presenceUsers: PresenceUser[]
  currentUserId: string
  isCurrentItem: boolean
  isDayOfMode: boolean
  onDragStart: (id: string) => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: (targetId: string) => void
  draggingId: string | null
  flashStatuses: Set<string>
}) {
  const [showStatusMenu, setShowStatusMenu] = useState(false)
  const [showHoverAdd, setShowHoverAdd] = useState(false)
  const statusRef = useRef<HTMLDivElement>(null)

  const cfg = STATUS_CONFIG[item.status]
  const categoryColor = CATEGORY_COLORS[item.category] ?? CATEGORY_COLORS.Other
  const editingUsers = presenceUsers.filter(
    (u) => u.activeItemId === item.id && u.userId !== currentUserId,
  )
  const isBeingDragged = draggingId === item.id

  return (
    <div
      onMouseEnter={() => setShowHoverAdd(true)}
      onMouseLeave={() => setShowHoverAdd(false)}
    >
      <div
        draggable
        onDragStart={() => onDragStart(item.id)}
        onDragOver={onDragOver}
        onDrop={() => onDrop(item.id)}
        className={`relative group rounded-xl border transition-all duration-200
          ${isBeingDragged ? 'opacity-40 scale-[0.98]' : 'opacity-100'}
          ${isCurrentItem && isDayOfMode
            ? 'border-violet-400 bg-violet-500/10 shadow-lg shadow-violet-500/10'
            : item.status === 'completed'
            ? 'border-zinc-800 bg-zinc-900/30'
            : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700'
          }
          ${editingUsers.length > 0 ? 'ring-1' : ''}
        `}
        style={{
          borderLeftColor: item.color ?? undefined,
          borderLeftWidth: item.color ? '3px' : undefined,
          ...(editingUsers[0] ? { ringColor: editingUsers[0].color } : {}),
        }}
      >
        <div className="flex items-start gap-2 p-3">
          {/* Drag handle */}
          <div className="opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing mt-0.5 flex-shrink-0">
            <GripVertical size={14} className="text-zinc-600" />
          </div>

          {/* Status dot */}
          <div ref={statusRef} className="relative mt-0.5 flex-shrink-0">
            <StatusDot
              status={item.status}
              size={isDayOfMode ? 'lg' : 'sm'}
              flash={flashStatuses.has(item.id)}
              onClick={(e) => { e.stopPropagation(); setShowStatusMenu(true) }}
            />
            <AnimatePresence>
              {showStatusMenu && (
                <StatusDropdown
                  current={item.status}
                  onSelect={(s, d) => { onStatusChange(item.id, s, d); setShowStatusMenu(false) }}
                  onClose={() => setShowStatusMenu(false)}
                />
              )}
            </AnimatePresence>
          </div>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-sm font-medium ${item.status === 'completed' ? 'line-through text-zinc-500' : 'text-white'}`}>
                {item.title}
              </span>
              {item.delay_minutes > 0 && (
                <span className="text-xs bg-amber-500/15 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded-md">
                  +{item.delay_minutes}m delay
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {/* Time */}
              {item.start_time && (
                <span className="text-xs text-zinc-500 flex items-center gap-1">
                  <Clock size={10} />
                  {format(parseISO(item.start_time), 'HH:mm')}
                  {item.duration_minutes && <span className="text-zinc-600">· {item.duration_minutes}m</span>}
                </span>
              )}

              {/* Category badge */}
              <span className={`text-xs px-1.5 py-0.5 rounded-md border ${categoryColor}`}>
                {item.category}
              </span>

              {/* Guest visible */}
              {item.is_guest_visible && (
                <span className="text-zinc-500" title="Visible to guests">
                  <Eye size={12} />
                </span>
              )}

              {/* Comment count */}
              {item.comment_count > 0 && (
                <span className="text-xs text-zinc-500 flex items-center gap-0.5">
                  <MessageSquare size={10} />
                  {item.comment_count}
                </span>
              )}

              {/* Presence: who's editing */}
              {editingUsers.length > 0 && (
                <div className="flex -space-x-1 ml-1">
                  {editingUsers.slice(0, 3).map((u) => (
                    <div
                      key={u.userId}
                      className="w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center ring-1 ring-zinc-900"
                      style={{ backgroundColor: u.color }}
                      title={`${u.userName} is editing`}
                    >
                      {u.userName[0].toUpperCase()}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Description (if expanded) */}
            {isExpanded && item.description && (
              <p className="text-xs text-zinc-400 mt-2 leading-relaxed">{item.description}</p>
            )}
            {isExpanded && item.notes && (
              <div className="mt-2 p-2 bg-amber-500/5 border border-amber-500/10 rounded-lg">
                <p className="text-xs text-amber-400/70">{item.notes}</p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            <button
              onClick={() => onExpand(item.id)}
              className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded-lg transition-colors"
              title={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
            <button
              onClick={() => onEdit(item)}
              className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded-lg transition-colors"
              title="Edit details"
            >
              <Edit2 size={13} />
            </button>
            <button
              onClick={() => onDelete(item.id)}
              className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
              title="Delete"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        {/* Current item indicator (day-of mode) */}
        {isCurrentItem && isDayOfMode && (
          <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
        )}

        {/* Children */}
        {item.children && item.children.length > 0 && isExpanded && (
          <div className="ml-8 mb-3 mr-3 space-y-1.5 border-l border-zinc-800 pl-3">
            {item.children.map((child) => (
              <div key={child.id} className="bg-zinc-800/50 rounded-lg p-2 flex items-center gap-2 text-sm text-zinc-400">
                <StatusDot status={child.status} />
                <span>{child.title}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Insert between items button */}
      <AnimatePresence>
        {showHoverAdd && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex items-center justify-center my-1"
          >
            <button
              onClick={() => onInsertBelow(item)}
              className="flex items-center gap-1 text-xs text-zinc-600 hover:text-violet-400 transition-colors px-2 py-0.5 rounded-lg hover:bg-violet-500/10"
            >
              <Plus size={11} />
              Insert item
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Version History Panel ────────────────────────────────────────────────────

function VersionPanel({
  versions,
  onRestore,
  onClose,
  onSave,
}: {
  versions: Version[]
  onRestore: (id: string) => void
  onClose: () => void
  onSave: (label?: string) => void
}) {
  const [label, setLabel] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    await onSave(label || undefined)
    setLabel('')
    setSaving(false)
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="absolute top-14 right-0 w-80 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl z-50 overflow-hidden"
    >
      <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Version History</h3>
        <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
          <X size={14} />
        </button>
      </div>

      {/* Save new version */}
      <div className="p-3 border-b border-zinc-800">
        <div className="flex gap-2">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Version label (optional)"
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-white focus:border-violet-500 outline-none"
          />
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-xs font-medium"
          >
            {saving ? '...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Version list */}
      <div className="max-h-72 overflow-y-auto">
        {versions.length === 0 && (
          <p className="text-xs text-zinc-500 text-center py-6">No versions saved yet</p>
        )}
        {versions.map((v) => (
          <div key={v.id} className="flex items-center justify-between px-4 py-3 hover:bg-zinc-800 border-b border-zinc-800/50 last:border-0">
            <div>
              <p className="text-xs font-medium text-zinc-300">
                v{v.version} {v.label && <span className="text-zinc-500">— {v.label}</span>}
              </p>
              <p className="text-xs text-zinc-600">{format(parseISO(v.created_at), 'MMM d, HH:mm')}</p>
            </div>
            <button
              onClick={() => onRestore(v.id)}
              className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1"
            >
              <RotateCcw size={10} />
              Restore
            </button>
          </div>
        ))}
      </div>
    </motion.div>
  )
}

// ─── Timeline Time Column ─────────────────────────────────────────────────────

function TimeColumn({ startTime, endTime }: { startTime: string | null; endTime: string | null }) {
  if (!startTime) return <div className="w-16 flex-shrink-0" />

  const start = parseISO(startTime)
  const end = endTime ? parseISO(endTime) : addMinutes(start, 30)
  const duration = differenceInMinutes(end, start)

  return (
    <div className="w-16 flex-shrink-0 flex flex-col items-end pr-2 pt-0.5">
      <span className="text-xs font-mono text-zinc-400">{format(start, 'HH:mm')}</span>
      {duration > 0 && (
        <span className="text-xs text-zinc-600 mt-0.5">{duration}m</span>
      )}
    </div>
  )
}

// ─── Main Runsheet Page ───────────────────────────────────────────────────────

export default function RunsheetPage() {
  const params = useParams()
  const tenant = params?.tenant as string
  const eventId = params?.eventId as string

  // State
  const [runsheet, setRunsheet] = useState<Runsheet | null>(null)
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('timeline')
  const [isDayOfMode, setIsDayOfMode] = useState(false)
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const [editingItem, setEditingItem] = useState<RunsheetItem | null>(null)
  const [editItemComments, setEditItemComments] = useState<Comment[]>([])
  const [showVersionPanel, setShowVersionPanel] = useState(false)
  const [versions, setVersions] = useState<Version[]>([])
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [insertAfter, setInsertAfter] = useState<RunsheetItem | null>(null)
  const [flashStatuses, setFlashStatuses] = useState<Set<string>>(new Set())
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [now, setNow] = useState(new Date())

  // Clock tick for day-of mode
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 10000)
    return () => clearInterval(t)
  }, [])

  // ─── Auth session ───────────────────────────────────────────────────────────
  const { session } = useSession()
  const currentUserId   = session?.user?.id ?? ''
  const currentUserName = session?.user?.user_metadata?.full_name ?? session?.user?.email ?? 'Unknown'

  // ─── Fetch runsheet (defined early so gateway can call it) ─────────────────
  const fetchRunsheet = useCallback(async () => {
    try {
      const data = await apiFetch(`/${tenant}/events/${eventId}/runsheet`)
      setRunsheet(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [tenant, eventId])

  useEffect(() => { fetchRunsheet() }, [fetchRunsheet])

  // ─── Supabase Presence (top-bar "who's viewing") ────────────────────────────
  const { others: presenceViewers } = usePresence({
    channelKey: `runsheet:${runsheet?.id ?? ''}`,
    currentUser: { id: currentUserId, name: currentUserName },
    page: 'runsheet',
    enabled: !!runsheet?.id && !!currentUserId,
  })

  // ─── Socket.IO Gateway (per-item presence + mutations) ──────────────────────
  const {
    connected,
    presenceUsers,
    typingIndicators,
    notifyCursorMove,
    notifyTyping,
  } = useRunsheetGateway<RunsheetItem>({
    runsheetId:   runsheet?.id ?? null,
    userId:       currentUserId,
    userName:     currentUserName,
    token:        session?.access_token ?? null,
    enabled:      !!runsheet?.id && !!currentUserId,

    // Item mutations — apply to local state (dedup: skip if item already present)
    onItemCreated: (item) => {
      setRunsheet((prev) => {
        if (!prev) return prev
        if (prev.items.some((i) => i.id === item.id)) return prev // originator dedup
        return { ...prev, items: [...prev.items, item] }
      })
    },
    onItemUpdated: (item) => {
      setRunsheet((prev) =>
        prev ? { ...prev, items: prev.items.map((i) => i.id === item.id ? { ...i, ...item } : i) } : prev,
      )
    },
    onItemDeleted: (itemId) => {
      setRunsheet((prev) =>
        prev ? { ...prev, items: prev.items.filter((i) => i.id !== itemId) } : prev,
      )
    },
    onItemStatusChanged: ({ itemId, status, delayMinutes }) => {
      setRunsheet((prev) =>
        prev
          ? { ...prev, items: prev.items.map((i) => i.id === itemId ? { ...i, status: status as ItemStatus, delay_minutes: delayMinutes ?? 0 } : i) }
          : prev,
      )
      setFlashStatuses((prev) => new Set([...prev, itemId]))
      setTimeout(() => setFlashStatuses((prev) => { const s = new Set(prev); s.delete(itemId); return s }), 1000)
    },
    onItemsReordered: (reorderList) => {
      setRunsheet((prev) => {
        if (!prev) return prev
        const posMap = new Map(reorderList.map((r) => [r.id, r.position]))
        const updated = prev.items.map((i) => posMap.has(i.id) ? { ...i, position: posMap.get(i.id)! } : i)
        return { ...prev, items: [...updated].sort((a, b) => a.position - b.position) }
      })
    },
    // Runsheet-level events
    onRunsheetLocked:   (by)        => setRunsheet((prev) => prev ? { ...prev, is_locked: true,  locked_by: by }  : prev),
    onRunsheetUnlocked: ()          => setRunsheet((prev) => prev ? { ...prev, is_locked: false, locked_by: null } : prev),
    onRunsheetRestored: (_versionId) => fetchRunsheet(),
  })

  // Determine current item based on current time
  const currentItemId = runsheet?.items.find((item) => {
    if (!item.start_time) return false
    const start = parseISO(item.start_time)
    const end = item.end_time ? parseISO(item.end_time) : addMinutes(start, item.duration_minutes ?? 30)
    return now >= start && now <= end
  })?.id ?? null


  // ─── Add item ──────────────────────────────────────────────────────────────
  const handleAddItem = async (title: string, startTime?: string, category?: string) => {
    if (!runsheet) return
    try {
      const startIso = startTime
        ? new Date(`${new Date().toISOString().split('T')[0]}T${startTime}`).toISOString()
        : undefined

      const item = await apiFetch(`/${tenant}/events/${eventId}/runsheet/items`, {
        method: 'POST',
        body: JSON.stringify({ title, start_time: startIso, category: category ?? 'Other' }),
      })
      setRunsheet((prev) => prev ? { ...prev, items: [...prev.items, item] } : prev)
      setShowQuickAdd(false)
      setInsertAfter(null)
    } catch (e) { console.error(e) }
  }

  // ─── Update item ───────────────────────────────────────────────────────────
  const handleUpdateItem = async (itemId: string, data: Partial<RunsheetItem>) => {
    if (!runsheet) return
    try {
      const updated = await apiFetch(`/${tenant}/events/${eventId}/runsheet/items/${itemId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      })
      setRunsheet((prev) =>
        prev ? { ...prev, items: prev.items.map((i) => (i.id === itemId ? { ...i, ...updated } : i)) } : prev,
      )
    } catch (e) { console.error(e) }
  }

  // ─── Delete item ───────────────────────────────────────────────────────────
  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('Delete this item?')) return
    try {
      await apiFetch(`/${tenant}/events/${eventId}/runsheet/items/${itemId}`, { method: 'DELETE' })
      setRunsheet((prev) =>
        prev ? { ...prev, items: prev.items.filter((i) => i.id !== itemId) } : prev,
      )
    } catch (e) { console.error(e) }
  }

  // ─── Status change ─────────────────────────────────────────────────────────
  const handleStatusChange = async (itemId: string, status: ItemStatus, delay?: number) => {
    try {
      await apiFetch(`/${tenant}/events/${eventId}/runsheet/items/${itemId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, delay_minutes: delay ?? 0 }),
      })
      setRunsheet((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.map((i) =>
                i.id === itemId ? { ...i, status, delay_minutes: delay ?? 0 } : i,
              ),
            }
          : prev,
      )
      // Flash animation
      setFlashStatuses((prev) => new Set([...prev, itemId]))
      setTimeout(() => setFlashStatuses((prev) => { const s = new Set(prev); s.delete(itemId); return s }), 1000)
    } catch (e) { console.error(e) }
  }

  // ─── Lock / Unlock ─────────────────────────────────────────────────────────
  const handleLockToggle = async () => {
    if (!runsheet) return
    const endpoint = runsheet.is_locked ? 'unlock' : 'lock'
    try {
      const updated = await apiFetch(`/${tenant}/events/${eventId}/runsheet/${endpoint}`, { method: 'POST' })
      setRunsheet((prev) => prev ? { ...prev, ...updated } : prev)
    } catch (e) { console.error(e) }
  }

  // ─── Drag & drop reorder ───────────────────────────────────────────────────
  const handleDragStart = (id: string) => setDraggingId(id)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = async (targetId: string) => {
    if (!draggingId || !runsheet || draggingId === targetId) { setDraggingId(null); return }

    const items = [...runsheet.items]
    const dragIdx = items.findIndex((i) => i.id === draggingId)
    const targetIdx = items.findIndex((i) => i.id === targetId)

    if (dragIdx === -1 || targetIdx === -1) { setDraggingId(null); return }

    // Reorder locally
    const [moved] = items.splice(dragIdx, 1)
    items.splice(targetIdx, 0, moved)

    // Recalculate positions with fractional indexing
    const newPositions = items.map((item, idx) => ({
      id: item.id,
      position: (idx + 1) * 1000,
    }))

    const reordered = items.map((item, idx) => ({ ...item, position: (idx + 1) * 1000 }))
    setRunsheet((prev) => prev ? { ...prev, items: reordered } : prev)
    setDraggingId(null)

    try {
      await apiFetch(`/${tenant}/events/${eventId}/runsheet/items/reorder`, {
        method: 'POST',
        body: JSON.stringify({ items: newPositions }),
      })
    } catch (e) { console.error(e) }
  }

  // ─── Open edit panel ───────────────────────────────────────────────────────
  const handleEdit = async (item: RunsheetItem) => {
    setEditingItem(item)
    notifyCursorMove(item.id)
    try {
      const comments = await apiFetch(`/${tenant}/events/${eventId}/runsheet/items/${item.id}/comments`)
      setEditItemComments(comments ?? [])
    } catch { setEditItemComments([]) }
  }

  // ─── Add comment ───────────────────────────────────────────────────────────
  const handleAddComment = async (itemId: string, comment: string) => {
    try {
      const c = await apiFetch(`/${tenant}/events/${eventId}/runsheet/items/${itemId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ comment }),
      })
      setEditItemComments((prev) => [...prev, c])
      // Update comment count in runsheet
      setRunsheet((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.map((i) =>
                i.id === itemId ? { ...i, comment_count: (i.comment_count ?? 0) + 1 } : i,
              ),
            }
          : prev,
      )
    } catch (e) { console.error(e) }
  }

  // ─── Version actions ───────────────────────────────────────────────────────
  const handleOpenVersions = async () => {
    setShowVersionPanel(true)
    try {
      const data = await apiFetch(`/${tenant}/events/${eventId}/runsheet/versions`)
      setVersions(data ?? [])
    } catch { setVersions([]) }
  }

  const handleSaveVersion = async (label?: string) => {
    try {
      await apiFetch(`/${tenant}/events/${eventId}/runsheet/versions`, {
        method: 'POST',
        body: JSON.stringify({ label }),
      })
      const data = await apiFetch(`/${tenant}/events/${eventId}/runsheet/versions`)
      setVersions(data ?? [])
    } catch (e) { console.error(e) }
  }

  const handleRestoreVersion = async (versionId: string) => {
    if (!confirm('Restore this version? Current state will be saved first.')) return
    try {
      await apiFetch(`/${tenant}/events/${eventId}/runsheet/versions/${versionId}/restore`, { method: 'POST' })
      await fetchRunsheet()
      setShowVersionPanel(false)
    } catch (e) { console.error(e) }
  }

  // ─── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center h-full">
        <div className="space-y-3 text-center">
          <div className="w-10 h-10 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-zinc-500">Loading runsheet...</p>
        </div>
      </div>
    )
  }

  if (!runsheet) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-zinc-400">Failed to load runsheet.</p>
          <button onClick={fetchRunsheet} className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm">Retry</button>
        </div>
      </div>
    )
  }

  const items = runsheet.items
  const completedCount = items.filter((i) => i.status === 'completed').length
  const inProgressCount = items.filter((i) => i.status === 'in_progress').length
  const delayedCount = items.filter((i) => i.status === 'delayed').length
  const progressPct = items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0

  return (
    <div className={`flex flex-col h-full ${isDayOfMode ? 'bg-zinc-950' : ''}`}>
      {/* ─── Top Bar ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800 bg-zinc-950 flex-shrink-0">
        {/* Left: title + lock */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Sheet size={18} className="text-violet-400" />
            <h1 className="text-base font-semibold text-white">{runsheet.title}</h1>
          </div>

          <button
            onClick={handleLockToggle}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors
              ${runsheet.is_locked
                ? 'bg-red-500/15 text-red-400 border border-red-500/20 hover:bg-red-500/25'
                : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:bg-zinc-700'}`}
          >
            {runsheet.is_locked ? <><Lock size={11} /> Locked</> : <><Unlock size={11} /> Lock</>}
          </button>

          {/* Connection status */}
          <div className={`flex items-center gap-1.5 text-xs ${connected ? 'text-emerald-400' : 'text-zinc-600'}`}>
            {connected ? <Wifi size={12} /> : <WifiOff size={12} />}
            {connected ? 'Live' : 'Offline'}
          </div>
        </div>

        {/* Center: progress */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <div className="w-32 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-violet-500 to-emerald-500 rounded-full transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span>{progressPct}%</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-blue-400">{inProgressCount} active</span>
            <span className="text-zinc-600">·</span>
            <span className="text-emerald-400">{completedCount} done</span>
            {delayedCount > 0 && <><span className="text-zinc-600">·</span><span className="text-amber-400">{delayedCount} delayed</span></>}
          </div>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2">
          {/* Presence avatars — "who's viewing this runsheet" */}
          {presenceViewers.length > 0 && (
            <PresenceAvatars users={presenceViewers} maxVisible={5} size="md" />
          )}

          {/* View mode toggle */}
          <div className="flex bg-zinc-900 border border-zinc-800 rounded-xl p-0.5">
            {(['timeline', 'list'] as ViewMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setViewMode(m)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors
                  ${viewMode === m ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                {m}
              </button>
            ))}
          </div>

          {/* Day-of mode */}
          <button
            onClick={() => setIsDayOfMode((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors
              ${isDayOfMode
                ? 'bg-amber-500 text-black'
                : 'bg-zinc-900 border border-zinc-700 text-zinc-400 hover:text-zinc-300'}`}
          >
            <Zap size={12} />
            Day-of
          </button>

          {/* Version history */}
          <div className="relative">
            <button
              onClick={handleOpenVersions}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 border border-zinc-700 text-zinc-400 hover:text-zinc-300 rounded-xl text-xs font-medium transition-colors"
            >
              <History size={12} />
              History
            </button>
            <AnimatePresence>
              {showVersionPanel && (
                <VersionPanel
                  versions={versions}
                  onRestore={handleRestoreVersion}
                  onClose={() => setShowVersionPanel(false)}
                  onSave={handleSaveVersion}
                />
              )}
            </AnimatePresence>
          </div>

          {/* Export */}
          <div className="relative group">
            <button className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 border border-zinc-700 text-zinc-400 hover:text-zinc-300 rounded-xl text-xs font-medium transition-colors">
              <Download size={12} />
              Export
            </button>
            <div className="absolute right-0 top-full mt-1 w-36 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl py-1 hidden group-hover:block z-50">
              <a
                href={`${API}/${tenant}/events/${eventId}/runsheet/export?format=pdf&token=${getToken()}`}
                target="_blank"
                className="flex items-center gap-2 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800 transition-colors"
              >
                <FileText size={12} />PDF
              </a>
              <a
                href={`${API}/${tenant}/events/${eventId}/runsheet/export?format=excel&token=${getToken()}`}
                target="_blank"
                className="flex items-center gap-2 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800 transition-colors"
              >
                <Sheet size={12} />Excel
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Day-of Mode Banner ───────────────────────────────────────────── */}
      {isDayOfMode && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-5 py-2 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <Zap size={14} className="text-amber-400" />
            <span className="text-sm font-medium text-amber-400">Day-of Mode Active</span>
            <span className="text-xs text-amber-400/60">{format(now, 'HH:mm:ss')}</span>
          </div>
          {currentItemId && (
            <div className="flex items-center gap-2 text-xs text-amber-300/80">
              <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              Currently in progress
            </div>
          )}
        </div>
      )}

      {/* ─── Main Content ──────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 py-4">

          {/* Item list */}
          <div className="space-y-1.5">
            <AnimatePresence>
              {items.map((item) => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8, scale: 0.96 }}
                  transition={{ duration: 0.15 }}
                >
                  <div className={`flex items-start gap-3 ${viewMode === 'timeline' ? '' : ''}`}>
                    {/* Time column (timeline view) */}
                    {viewMode === 'timeline' && (
                      <TimeColumn startTime={item.start_time} endTime={item.end_time} />
                    )}

                    {/* Connector line (timeline view) */}
                    {viewMode === 'timeline' && (
                      <div className="flex flex-col items-center w-4 flex-shrink-0 pt-4">
                        <div className="w-2 h-2 rounded-full border-2 flex-shrink-0" style={{ borderColor: STATUS_CONFIG[item.status].color, backgroundColor: item.status === 'completed' ? STATUS_CONFIG[item.status].color : 'transparent' }} />
                        <div className="w-px flex-1 mt-1 min-h-6" style={{ backgroundColor: `${STATUS_CONFIG[item.status].color}30` }} />
                      </div>
                    )}

                    {/* Card */}
                    <div className="flex-1 min-w-0">
                      <RunsheetItemCard
                        item={item}
                        onStatusChange={handleStatusChange}
                        onExpand={(id) => setExpandedItems((prev) => {
                          const s = new Set(prev)
                          s.has(id) ? s.delete(id) : s.add(id)
                          return s
                        })}
                        isExpanded={expandedItems.has(item.id)}
                        onEdit={handleEdit}
                        onDelete={handleDeleteItem}
                        onInsertBelow={(afterItem) => { setInsertAfter(afterItem); setShowQuickAdd(true) }}
                        presenceUsers={presenceUsers}
                        currentUserId={currentUserId}
                        isCurrentItem={currentItemId === item.id}
                        isDayOfMode={isDayOfMode}
                        onDragStart={handleDragStart}
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                        draggingId={draggingId}
                        flashStatuses={flashStatuses}
                      />
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Quick Add */}
          <div className="mt-3">
            <AnimatePresence>
              {showQuickAdd && (
                <QuickAddForm
                  onAdd={handleAddItem}
                  onCancel={() => { setShowQuickAdd(false); setInsertAfter(null) }}
                />
              )}
            </AnimatePresence>
            {!showQuickAdd && (
              <button
                onClick={() => setShowQuickAdd(true)}
                className="w-full flex items-center justify-center gap-2 py-3 border border-dashed border-zinc-800 rounded-xl text-sm text-zinc-600 hover:text-zinc-400 hover:border-zinc-700 transition-colors group"
              >
                <Plus size={14} className="group-hover:text-violet-400 transition-colors" />
                Add item
              </button>
            )}
          </div>

          {/* Empty state */}
          {items.length === 0 && !showQuickAdd && (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto mb-4">
                <Sheet size={28} className="text-zinc-700" />
              </div>
              <h3 className="text-lg font-semibold text-zinc-400 mb-1">Empty Runsheet</h3>
              <p className="text-sm text-zinc-600 mb-6">Add your first item to start building the event timeline.</p>
              <button
                onClick={() => setShowQuickAdd(true)}
                className="px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-medium transition-colors"
              >
                Add First Item
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ─── Edit Panel ───────────────────────────────────────────────────── */}
      <AnimatePresence>
        {editingItem && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-40"
              onClick={() => { setEditingItem(null); notifyCursorMove(null) }}
            />
            <EditPanel
              item={editingItem}
              comments={editItemComments}
              onSave={async (id, data) => {
                await handleUpdateItem(id, data)
                setEditingItem((prev) => prev ? { ...prev, ...data } : null)
              }}
              onClose={() => { setEditingItem(null); notifyCursorMove(null) }}
              onAddComment={handleAddComment}
              onTyping={(field) => notifyTyping(editingItem.id, field)}
              presenceUsers={presenceUsers}
              typingIndicators={typingIndicators}
              currentUserId={currentUserId}
            />
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
