'use client'

import { useState, useEffect, useCallback } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

type SetupStatus = 'pending' | 'in_setup' | 'ready' | 'live' | 'dismantling' | 'done'
type EquipmentStatus = 'reserved' | 'dispatched' | 'on_site' | 'in_use' | 'returned' | 'damaged'
type LoadStatus = 'scheduled' | 'arrived' | 'in_progress' | 'completed' | 'cancelled' | 'delayed'
type SupplierStatus = 'pending' | 'briefed' | 'confirmed' | 'on_site' | 'completed' | 'cancelled'

interface ProductionSetup {
  id: string
  name: string
  category: string
  description?: string
  location?: string
  status: SetupStatus
  setup_start?: string
  setup_end?: string
  responsible?: { id: string; full_name: string; avatar_url?: string }
  vendor?: { id: string; name: string }
  notes?: string
  checklist: ChecklistItem[]
}

interface ChecklistItem {
  item: string
  done: boolean
  checked_by?: string
  checked_at?: string
}

interface EquipmentAssignment {
  id: string
  status: EquipmentStatus
  quantity: number
  notes?: string
  dispatched_at?: string
  returned_at?: string
  equipment: { id: string; name: string; category: string; make?: string; model?: string }
  assigned_to?: { id: string; full_name: string }
  setup?: { id: string; name: string }
}

interface LoadScheduleItem {
  id: string
  type: string
  title: string
  description?: string
  scheduled_time: string
  duration_minutes: number
  location?: string
  vehicle_info?: string
  contact_name?: string
  contact_phone?: string
  status: LoadStatus
  actual_time?: string
  delay_minutes: number
  vendor?: { id: string; name: string }
}

interface SupplierCoord {
  id: string
  status: SupplierStatus
  category: string
  brief_sent: boolean
  confirmed: boolean
  advance_paid: boolean
  advance_amount?: number
  balance_due?: number
  arrival_time?: string
  contact_name?: string
  contact_phone?: string
  requirements?: string
  vendor: { id: string; name: string; category: string; contact_email?: string; contact_phone?: string }
}

interface DashboardData {
  setups: ProductionSetup[]
  equipment: EquipmentAssignment[]
  load_schedule: LoadScheduleItem[]
  suppliers: SupplierCoord[]
  stats: {
    setups: { total: number; ready: number; in_setup: number; pending: number }
    suppliers: { total: number; confirmed: number; briefed: number; on_site: number }
  }
  upcoming_loads: LoadScheduleItem[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SETUP_STATUS_CONFIG: Record<SetupStatus, { label: string; color: string; bg: string }> = {
  pending:      { label: 'Pending',      color: '#64748b', bg: 'rgba(100,116,139,0.15)' },
  in_setup:     { label: 'In Setup',     color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
  ready:        { label: 'Ready',        color: '#10b981', bg: 'rgba(16,185,129,0.15)' },
  live:         { label: 'Live',         color: '#22c55e', bg: 'rgba(34,197,94,0.2)' },
  dismantling:  { label: 'Dismantling',  color: '#8b5cf6', bg: 'rgba(139,92,246,0.15)' },
  done:         { label: 'Done',         color: '#475569', bg: 'rgba(71,85,105,0.15)' },
}

const SETUP_CATEGORY_ICONS: Record<string, string> = {
  stage: '🎭', av: '📡', lighting: '💡', sound: '🔊', power: '⚡',
  network: '🌐', rigging: '🔧', pyrotechnics: '🎆', video: '🎬', decor: '🌸', general: '📦',
}

const LOAD_TYPE_ICONS: Record<string, string> = {
  load_in: '⬇️', load_out: '⬆️', delivery: '🚚', pickup: '📦',
  vendor_arrival: '🏃', vendor_departure: '🚶',
}

const EQUIP_STATUS_CONFIG: Record<EquipmentStatus, { color: string; label: string }> = {
  reserved:   { color: '#64748b', label: 'Reserved' },
  dispatched: { color: '#f59e0b', label: 'Dispatched' },
  on_site:    { color: '#3b82f6', label: 'On Site' },
  in_use:     { color: '#22c55e', label: 'In Use' },
  returned:   { color: '#475569', label: 'Returned' },
  damaged:    { color: '#ef4444', label: 'Damaged' },
}

// ─── API helpers ──────────────────────────────────────────────────────────────

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

function getToken(): string {
  try {
    const raw = localStorage.getItem(`sb-lndcqdnsllfcnkidhtem-auth-token`)
    if (!raw) return ''
    return JSON.parse(raw)?.access_token ?? ''
  } catch { return '' }
}

function buildHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${getToken()}`,
  }
}

async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(`${API}/v1${path}`, { ...opts, headers: { ...buildHeaders(), ...(opts?.headers ?? {}) } })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color }: { label: string; value: number | string; sub?: string; color?: string }) {
  return (
    <div style={{
      background: 'hsl(var(--card))',
      border: '1px solid hsl(var(--border) / 0.5)',
      borderRadius: 12,
      padding: '20px 24px',
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
    }}>
      <span style={{ fontSize: 13, color: 'hsl(var(--muted-foreground))', letterSpacing: '0.02em' }}>{label}</span>
      <span style={{ fontSize: 32, fontWeight: 700, color: color ?? 'hsl(var(--foreground))', lineHeight: 1.1 }}>{value}</span>
      {sub && <span style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>{sub}</span>}
    </div>
  )
}

function StatusBadge({ status, config }: { status: string; config: Record<string, { color: string; label: string; bg?: string }> }) {
  const cfg = config[status] ?? { color: 'hsl(var(--muted-foreground))', label: status, bg: 'rgba(148,163,184,0.1)' }
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
      color: cfg.color, background: cfg.bg ?? `${cfg.color}22`,
      textTransform: 'uppercase', letterSpacing: '0.05em',
    }}>
      {cfg.label}
    </span>
  )
}

function ChecklistProgress({ items }: { items: ChecklistItem[] }) {
  if (!items.length) return <span style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>No checklist</span>
  const done = items.filter(i => i.done).length
  const pct = Math.round((done / items.length) * 100)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 5, background: 'hsl(var(--muted))', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? '#10b981' : '#3b82f6', borderRadius: 4, transition: 'width 0.3s' }} />
      </div>
      <span style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))', whiteSpace: 'nowrap' }}>{done}/{items.length}</span>
    </div>
  )
}

function SetupCard({ setup, onStatusChange, onChecklistToggle }: {
  setup: ProductionSetup
  onStatusChange: (id: string, status: string) => void
  onChecklistToggle: (id: string, checklist: ChecklistItem[]) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const cfg = SETUP_STATUS_CONFIG[setup.status]
  const icon = SETUP_CATEGORY_ICONS[setup.category] ?? '📦'

  const nextStatus: Record<SetupStatus, SetupStatus | null> = {
    pending: 'in_setup', in_setup: 'ready', ready: 'live', live: 'dismantling', dismantling: 'done', done: null,
  }

  const handleChecklistItem = (idx: number) => {
    const updated = setup.checklist.map((item, i) => i === idx ? { ...item, done: !item.done, checked_at: new Date().toISOString() } : item)
    onChecklistToggle(setup.id, updated)
  }

  return (
    <div style={{
      background: 'hsl(var(--card))',
      border: `1px solid ${cfg.color}33`,
      borderRadius: 12,
      overflow: 'hidden',
      transition: 'border-color 0.2s',
    }}>
      <div
        style={{ padding: '16px 20px', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 14 }}
        onClick={() => setExpanded(e => !e)}
      >
        <div style={{ width: 42, height: 42, borderRadius: 10, background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
          {icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontWeight: 600, fontSize: 15, color: 'hsl(var(--foreground))' }}>{setup.name}</span>
            <StatusBadge status={setup.status} config={SETUP_STATUS_CONFIG} />
          </div>
          {setup.location && <div style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))', marginBottom: 6 }}>📍 {setup.location}</div>}
          <ChecklistProgress items={setup.checklist} />
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          {nextStatus[setup.status] && (
            <button
              onClick={e => { e.stopPropagation(); onStatusChange(setup.id, nextStatus[setup.status]!) }}
              style={{ padding: '5px 12px', borderRadius: 8, border: `1px solid ${cfg.color}66`, background: cfg.bg, color: cfg.color, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
            >
              → {SETUP_STATUS_CONFIG[nextStatus[setup.status]!].label}
            </button>
          )}
          <span style={{ color: 'hsl(var(--muted-foreground))', fontSize: 14, alignSelf: 'center' }}>{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {expanded && (
        <div style={{ borderTop: '1px solid hsl(var(--border) / 0.4)', padding: '16px 20px' }}>
          {setup.description && <p style={{ fontSize: 13, color: 'hsl(var(--muted-foreground))', marginBottom: 12 }}>{setup.description}</p>}

          {setup.checklist.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Checklist</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {setup.checklist.map((item, idx) => (
                  <label key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => handleChecklistItem(idx)}>
                    <div style={{
                      width: 18, height: 18, borderRadius: 5, border: `2px solid ${item.done ? '#10b981' : 'hsl(var(--border))'}`,
                      background: item.done ? '#10b981' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      {item.done && <span style={{ color: '#fff', fontSize: 11 }}>✓</span>}
                    </div>
                    <span style={{ fontSize: 13, color: item.done ? 'hsl(var(--muted-foreground))' : 'hsl(var(--foreground))', textDecoration: item.done ? 'line-through' : 'none' }}>{item.item}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {setup.notes && (
            <div style={{ marginTop: 12, fontSize: 12, color: 'hsl(var(--muted-foreground))', background: 'hsl(var(--card))', padding: '10px 12px', borderRadius: 8 }}>
              {setup.notes}
            </div>
          )}

          {(setup.responsible || setup.vendor) && (
            <div style={{ marginTop: 12, display: 'flex', gap: 16 }}>
              {setup.responsible && (
                <div style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>
                  👤 <span style={{ color: 'hsl(var(--foreground))' }}>{setup.responsible.full_name}</span>
                </div>
              )}
              {setup.vendor && (
                <div style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>
                  🏢 <span style={{ color: 'hsl(var(--foreground))' }}>{setup.vendor.name}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function LoadTimelineItem({ item, onStatusChange }: { item: LoadScheduleItem; onStatusChange: (id: string, status: string) => void }) {
  const isCompleted = item.status === 'completed' || item.status === 'cancelled'
  const isDelayed = item.delay_minutes > 0
  const time = new Date(item.scheduled_time)

  const statusColors: Record<LoadStatus, string> = {
    scheduled: '#64748b', arrived: '#3b82f6', in_progress: '#f59e0b',
    completed: '#10b981', cancelled: '#475569', delayed: '#ef4444',
  }

  return (
    <div style={{
      display: 'flex', gap: 16, padding: '14px 0',
      borderBottom: '1px solid hsl(var(--border) / 0.3)',
      opacity: isCompleted ? 0.5 : 1,
    }}>
      <div style={{ width: 72, flexShrink: 0, textAlign: 'right' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'hsl(var(--foreground))' }}>
          {time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
        </div>
        <div style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>{item.duration_minutes}min</div>
      </div>

      <div style={{ width: 2, background: `${statusColors[item.status]}66`, borderRadius: 2, position: 'relative', flexShrink: 0 }}>
        <div style={{
          position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)',
          width: 10, height: 10, borderRadius: '50%',
          background: statusColors[item.status], border: '2px solid hsl(var(--background))',
        }} />
      </div>

      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 14 }}>{LOAD_TYPE_ICONS[item.type] ?? '📋'}</span>
          <span style={{ fontWeight: 600, fontSize: 14, color: 'hsl(var(--foreground))' }}>{item.title}</span>
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 12,
            background: `${statusColors[item.status]}22`, color: statusColors[item.status],
            textTransform: 'uppercase', letterSpacing: '0.05em',
          }}>
            {item.status}
          </span>
          {isDelayed && <span style={{ fontSize: 11, color: '#ef4444' }}>+{item.delay_minutes}min</span>}
        </div>

        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {item.location && <span style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>📍 {item.location}</span>}
          {item.vehicle_info && <span style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>🚛 {item.vehicle_info}</span>}
          {item.contact_name && <span style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>👤 {item.contact_name}</span>}
          {item.contact_phone && <span style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>📞 {item.contact_phone}</span>}
          {item.vendor && <span style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>🏢 {item.vendor.name}</span>}
        </div>

        {!isCompleted && (
          <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
            {item.status === 'scheduled' && (
              <button onClick={() => onStatusChange(item.id, 'arrived')} style={actionBtnStyle('#3b82f6')}>Mark Arrived</button>
            )}
            {item.status === 'arrived' && (
              <button onClick={() => onStatusChange(item.id, 'in_progress')} style={actionBtnStyle('#f59e0b')}>Start</button>
            )}
            {item.status === 'in_progress' && (
              <button onClick={() => onStatusChange(item.id, 'completed')} style={actionBtnStyle('#10b981')}>Complete</button>
            )}
            {item.status !== 'cancelled' && item.status !== 'completed' && (
              <button onClick={() => onStatusChange(item.id, 'delayed')} style={actionBtnStyle('#ef4444', true)}>Delayed</button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function SupplierRow({ supplier, onBrief, onConfirm }: {
  supplier: SupplierCoord
  onBrief: (id: string) => void
  onConfirm: (id: string) => void
}) {
  const statusColors: Record<SupplierStatus, string> = {
    pending: '#64748b', briefed: '#f59e0b', confirmed: '#10b981',
    on_site: '#22c55e', completed: '#475569', cancelled: '#ef4444',
  }
  const color = statusColors[supplier.status] ?? '#64748b'

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 16, padding: '14px 0',
      borderBottom: '1px solid hsl(var(--border) / 0.3)',
    }}>
      <div style={{ width: 42, height: 42, borderRadius: 10, background: 'hsl(var(--muted))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
        🏢
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: 'hsl(var(--foreground))', marginBottom: 3 }}>{supplier.vendor.name}</div>
        <div style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <span>{supplier.category}</span>
          {supplier.contact_name && <span>👤 {supplier.contact_name}</span>}
          {supplier.contact_phone && <span>📞 {supplier.contact_phone}</span>}
          {supplier.arrival_time && <span>🕐 {new Date(supplier.arrival_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <span style={{ fontSize: 13, color: supplier.brief_sent ? '#10b981' : '#64748b' }}>
          {supplier.brief_sent ? '✓ Brief' : '○ Brief'}
        </span>
        <span style={{ fontSize: 13, color: supplier.confirmed ? '#10b981' : '#64748b' }}>
          {supplier.confirmed ? '✓ Confirmed' : '○ Confirmed'}
        </span>

        <span style={{
          fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 12,
          background: `${color}22`, color,
          textTransform: 'uppercase', letterSpacing: '0.04em',
        }}>
          {supplier.status}
        </span>

        {!supplier.brief_sent && (
          <button onClick={() => onBrief(supplier.id)} style={actionBtnStyle('#f59e0b')}>Send Brief</button>
        )}
        {supplier.brief_sent && !supplier.confirmed && (
          <button onClick={() => onConfirm(supplier.id)} style={actionBtnStyle('#10b981')}>Confirm</button>
        )}
      </div>
    </div>
  )
}

function actionBtnStyle(color: string, ghost?: boolean): React.CSSProperties {
  return {
    padding: '4px 10px', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer',
    border: `1px solid ${color}66`, background: ghost ? 'transparent' : `${color}22`, color,
  }
}

// ─── Add Setup Modal ──────────────────────────────────────────────────────────

function AddSetupModal({ onClose, onSave }: { onClose: () => void; onSave: (data: any) => void }) {
  const [form, setForm] = useState({
    name: '', category: 'general', location: '', description: '', notes: '',
  })
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Add Production Setup</h3>
          <button onClick={onClose} style={closeBtn}>✕</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ gridColumn: '1/-1' }}>
            <label style={labelStyle}>Name *</label>
            <input style={inputStyle} value={form.name} onChange={e => set('name', e.target.value)} placeholder="Main Stage, AV Booth, etc." />
          </div>
          <div>
            <label style={labelStyle}>Category</label>
            <select style={inputStyle} value={form.category} onChange={e => set('category', e.target.value)}>
              {['stage','av','lighting','sound','power','network','rigging','pyrotechnics','video','decor','general'].map(c => (
                <option key={c} value={c}>{SETUP_CATEGORY_ICONS[c]} {c.charAt(0).toUpperCase() + c.slice(1)}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Location</label>
            <input style={inputStyle} value={form.location} onChange={e => set('location', e.target.value)} placeholder="Gate 2, North Wing..." />
          </div>
          <div style={{ gridColumn: '1/-1' }}>
            <label style={labelStyle}>Description</label>
            <textarea style={{ ...inputStyle, height: 70, resize: 'vertical' }} value={form.description} onChange={e => set('description', e.target.value)} />
          </div>
          <div style={{ gridColumn: '1/-1' }}>
            <label style={labelStyle}>Notes</label>
            <textarea style={{ ...inputStyle, height: 60, resize: 'vertical' }} value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ ...actionBtnStyle('#64748b'), padding: '8px 20px' }}>Cancel</button>
          <button
            onClick={() => { if (form.name.trim()) onSave(form) }}
            style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
          >
            Create Setup
          </button>
        </div>
      </div>
    </div>
  )
}

function AddLoadModal({ onClose, onSave }: { onClose: () => void; onSave: (data: any) => void }) {
  const [form, setForm] = useState({
    type: 'load_in', title: '', scheduled_time: '', location: '',
    vehicle_info: '', contact_name: '', contact_phone: '', duration_minutes: 60,
  })
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Add Load Schedule Entry</h3>
          <button onClick={onClose} style={closeBtn}>✕</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label style={labelStyle}>Type</label>
            <select style={inputStyle} value={form.type} onChange={e => set('type', e.target.value)}>
              {['load_in','load_out','delivery','pickup','vendor_arrival','vendor_departure'].map(t => (
                <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Scheduled Time *</label>
            <input type="datetime-local" style={inputStyle} value={form.scheduled_time} onChange={e => set('scheduled_time', e.target.value)} />
          </div>
          <div style={{ gridColumn: '1/-1' }}>
            <label style={labelStyle}>Title *</label>
            <input style={inputStyle} value={form.title} onChange={e => set('title', e.target.value)} placeholder="Stage equipment load-in..." />
          </div>
          <div>
            <label style={labelStyle}>Location / Gate</label>
            <input style={inputStyle} value={form.location} onChange={e => set('location', e.target.value)} placeholder="Gate B, Loading Dock 2..." />
          </div>
          <div>
            <label style={labelStyle}>Duration (min)</label>
            <input type="number" style={inputStyle} value={form.duration_minutes} onChange={e => set('duration_minutes', parseInt(e.target.value))} />
          </div>
          <div>
            <label style={labelStyle}>Vehicle Info</label>
            <input style={inputStyle} value={form.vehicle_info} onChange={e => set('vehicle_info', e.target.value)} placeholder="Truck #3 - MH01AB1234" />
          </div>
          <div>
            <label style={labelStyle}>Contact Name</label>
            <input style={inputStyle} value={form.contact_name} onChange={e => set('contact_name', e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Contact Phone</label>
            <input style={inputStyle} value={form.contact_phone} onChange={e => set('contact_phone', e.target.value)} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ ...actionBtnStyle('#64748b'), padding: '8px 20px' }}>Cancel</button>
          <button
            onClick={() => { if (form.title.trim() && form.scheduled_time) onSave(form) }}
            style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
          >
            Add Entry
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Shared modal styles ──────────────────────────────────────────────────────

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex',
  alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(8px)',
}
const modalStyle: React.CSSProperties = {
  background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 16,
  padding: 32, width: '100%', maxWidth: 600, maxHeight: '90vh', overflowY: 'auto',
}
const closeBtn: React.CSSProperties = {
  background: 'hsl(var(--muted))', border: 'none', color: 'hsl(var(--muted-foreground))',
  width: 32, height: 32, borderRadius: 8, cursor: 'pointer', fontSize: 14,
}
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600, color: 'hsl(var(--muted-foreground))',
  textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6,
}
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', borderRadius: 8, background: 'hsl(var(--muted))',
  border: '1px solid hsl(var(--border))', color: 'hsl(var(--foreground))', fontSize: 14, boxSizing: 'border-box',
}

// ─── Main Component ───────────────────────────────────────────────────────────

type Tab = 'setups' | 'load' | 'equipment' | 'suppliers'

export default function ProductionPage() {
  const [selectedEventId, setSelectedEventId] = useState<string>('')
  const [events, setEvents] = useState<{ id: string; name: string; event_date: string }[]>([])
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(false)
  const [eventsLoading, setEventsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('setups')
  const [showAddSetup, setShowAddSetup] = useState(false)
  const [showAddLoad, setShowAddLoad] = useState(false)

  // ── Load events list ──────────────────────────────────────────────────────
  useEffect(() => {
    setEventsLoading(true)
    apiFetch('/events?limit=50&sort=event_date')
      .then(res => {
        const list = Array.isArray(res.events) ? res.events : Array.isArray(res.data) ? res.data : []
        setEvents(list)
        if (!selectedEventId && list.length > 0) {
          // Auto-select live event first, else first upcoming
          const live = list.find((e: any) => e.status === 'live' || e.status === 'active')
          setSelectedEventId(live?.id ?? list[0].id)
        }
      })
      .catch(() => {})
      .finally(() => setEventsLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Load production dashboard for selected event ───────────────────────────
  const loadDashboard = useCallback(async () => {
    if (!selectedEventId) return
    setLoading(true)
    try {
      const res = await apiFetch(`/production/events/${selectedEventId}/dashboard`)
      setData(res)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [selectedEventId])

  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  const emptyData: DashboardData = {
    setups: [], equipment: [], load_schedule: [], suppliers: [], upcoming_loads: [],
    stats: { setups: { total: 0, ready: 0, in_setup: 0, pending: 0 }, suppliers: { total: 0, confirmed: 0, briefed: 0, on_site: 0 } },
  }
  const displayData = data ?? emptyData

  const handleSetupStatusChange = useCallback(async (id: string, status: string) => {
    await apiFetch(`/production/setups/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) })
    setData(d => d ? { ...d, setups: d.setups.map(s => s.id === id ? { ...s, status: status as SetupStatus } : s) } : null)
  }, [])

  const handleChecklistToggle = useCallback(async (id: string, checklist: ChecklistItem[]) => {
    await apiFetch(`/production/setups/${id}/checklist`, { method: 'PATCH', body: JSON.stringify({ checklist }) })
    setData(d => d ? { ...d, setups: d.setups.map(s => s.id === id ? { ...s, checklist } : s) } : null)
  }, [])

  const handleLoadStatusChange = useCallback(async (id: string, status: string) => {
    await apiFetch(`/production/load-schedule/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) })
    setData(d => d ? { ...d, load_schedule: d.load_schedule.map(l => l.id === id ? { ...l, status: status as LoadStatus } : l) } : null)
  }, [])

  const handleSendBrief = useCallback(async (id: string) => {
    await apiFetch(`/production/suppliers/${id}/brief`, { method: 'PATCH' })
    setData(d => d ? { ...d, suppliers: d.suppliers.map(s => s.id === id ? { ...s, brief_sent: true, status: 'briefed' as SupplierStatus } : s) } : null)
  }, [])

  const handleConfirmSupplier = useCallback(async (id: string) => {
    await apiFetch(`/production/suppliers/${id}/confirm`, { method: 'PATCH' })
    setData(d => d ? { ...d, suppliers: d.suppliers.map(s => s.id === id ? { ...s, confirmed: true, status: 'confirmed' as SupplierStatus } : s) } : null)
  }, [])

  const handleAddSetup = useCallback(async (formData: any) => {
    if (!selectedEventId) return
    await apiFetch(`/production/events/${selectedEventId}/setups`, { method: 'POST', body: JSON.stringify(formData) })
    await loadDashboard()
    setShowAddSetup(false)
  }, [selectedEventId, loadDashboard])

  const handleAddLoad = useCallback(async (formData: any) => {
    if (!selectedEventId) return
    await apiFetch(`/production/events/${selectedEventId}/load-schedule`, { method: 'POST', body: JSON.stringify(formData) })
    await loadDashboard()
    setShowAddLoad(false)
  }, [selectedEventId, loadDashboard])

  const stats = displayData.stats
  const confirmedPct = stats.suppliers.total ? Math.round((stats.suppliers.confirmed / stats.suppliers.total) * 100) : 0
  const readyPct = stats.setups.total ? Math.round((stats.setups.ready / stats.setups.total) * 100) : 0

  const TABS: { key: Tab; label: string; count: number }[] = [
    { key: 'setups', label: 'Production Setups', count: displayData.setups.length },
    { key: 'load', label: 'Load Schedule', count: displayData.load_schedule.length },
    { key: 'equipment', label: 'Equipment', count: displayData.equipment.length },
    { key: 'suppliers', label: 'Suppliers', count: displayData.suppliers.length },
  ]

  return (
    <div style={{ minHeight: '100vh', background: 'hsl(var(--background))', color: 'hsl(var(--foreground))', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      {/* Header */}
      <div style={{ padding: '32px 40px 0', borderBottom: '1px solid hsl(var(--border) / 0.4)', marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px' }}>Production & Logistics</h1>
            <p style={{ margin: '4px 0 0', color: 'hsl(var(--muted-foreground))', fontSize: 14 }}>
              Stage setup, equipment tracking, load schedules & supplier coordination
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {/* Event selector */}
            <select
              value={selectedEventId}
              onChange={e => setSelectedEventId(e.target.value)}
              disabled={eventsLoading}
              style={{
                padding: '8px 14px', borderRadius: 10, border: '1px solid hsl(var(--border) / 0.6)',
                background: 'hsl(var(--background))', color: 'hsl(var(--foreground))',
                fontSize: 13, fontWeight: 500, cursor: 'pointer', minWidth: 220,
              }}
            >
              {eventsLoading
                ? <option>Loading events…</option>
                : events.length === 0
                  ? <option value="">No events found</option>
                  : events.map(ev => (
                    <option key={ev.id} value={ev.id}>
                      {ev.name}{ev.event_date ? ` — ${new Date(ev.event_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}` : ''}
                    </option>
                  ))
              }
            </select>
            {/* Refresh */}
            <button
              onClick={loadDashboard}
              disabled={loading || !selectedEventId}
              style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid hsl(var(--border) / 0.6)', background: 'transparent', color: 'hsl(var(--muted-foreground))', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
              title="Refresh"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={loading ? { animation: 'spin 1s linear infinite' } : {}}>
                <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16"/>
              </svg>
            </button>
            {activeTab === 'setups' && selectedEventId && (
              <button
                onClick={() => setShowAddSetup(true)}
                style={{ padding: '10px 20px', borderRadius: 10, border: '1px solid hsl(var(--primary) / 0.5)', background: 'hsl(var(--primary) / 0.15)', color: 'hsl(var(--primary))', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
              >
                + Add Setup
              </button>
            )}
            {activeTab === 'load' && selectedEventId && (
              <button
                onClick={() => setShowAddLoad(true)}
                style={{ padding: '10px 20px', borderRadius: 10, border: '1px solid hsl(var(--primary) / 0.5)', background: 'hsl(var(--primary) / 0.15)', color: 'hsl(var(--primary))', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
              >
                + Add Entry
              </button>
            )}
          </div>
        </div>

        {/* Stats bar */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 16, marginBottom: 24 }}>
          <StatCard label="Total Setups" value={stats.setups.total} />
          <StatCard label="Ready / Live" value={stats.setups.ready} color="#10b981" sub={`${readyPct}%`} />
          <StatCard label="In Setup" value={stats.setups.in_setup} color="#f59e0b" />
          <StatCard label="Suppliers" value={stats.suppliers.total} />
          <StatCard label="Confirmed" value={stats.suppliers.confirmed} color="#10b981" sub={`${confirmedPct}%`} />
          <StatCard label="Equipment Items" value={displayData.equipment.length} />
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4 }}>
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '10px 20px', borderRadius: '10px 10px 0 0',
                border: '1px solid hsl(var(--border) / 0.5)',
                borderBottom: activeTab === tab.key ? '2px solid hsl(var(--primary))' : '1px solid hsl(var(--border) / 0.5)',
                background: activeTab === tab.key ? 'hsl(var(--primary) / 0.12)' : 'transparent',
                color: activeTab === tab.key ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                fontSize: 14, fontWeight: activeTab === tab.key ? 700 : 500, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              {tab.label}
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 10,
                background: activeTab === tab.key ? 'hsl(var(--primary) / 0.3)' : 'hsl(var(--muted))',
                color: activeTab === tab.key ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
              }}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Loading / no-event state */}
      {!selectedEventId && !eventsLoading && (
        <div style={{ padding: '80px 40px', textAlign: 'center', color: 'hsl(var(--muted-foreground))' }}>
          <p style={{ fontSize: 16, margin: 0 }}>No events found. Create an event to start tracking production.</p>
        </div>
      )}
      {loading && (
        <div style={{ padding: '80px 40px', textAlign: 'center', color: 'hsl(var(--muted-foreground))' }}>
          <p style={{ fontSize: 14, margin: 0 }}>Loading production dashboard…</p>
        </div>
      )}

      {/* Tab content */}
      {!loading && selectedEventId && <div style={{ padding: '0 40px 40px' }}>

        {/* ── Production Setups ──────────────────────────────────────────── */}
        {activeTab === 'setups' && (
          <div style={{ paddingTop: 24 }}>
            {/* Category groups */}
            {['stage','av','lighting','sound','power','decor','general'].map(cat => {
              const catSetups = displayData.setups.filter(s => s.category === cat)
              if (!catSetups.length) return null
              return (
                <div key={cat} style={{ marginBottom: 28 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>{SETUP_CATEGORY_ICONS[cat]}</span> {cat}
                    <span style={{ fontWeight: 400, color: 'hsl(var(--muted-foreground))' }}>({catSetups.length})</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {catSetups.map(setup => (
                      <SetupCard
                        key={setup.id}
                        setup={setup}
                        onStatusChange={handleSetupStatusChange}
                        onChecklistToggle={handleChecklistToggle}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
            {displayData.setups.length === 0 && (
              <div style={{ textAlign: 'center', padding: '60px 0', color: 'hsl(var(--muted-foreground))' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🎭</div>
                <div style={{ fontSize: 16 }}>No production setups yet</div>
                <div style={{ fontSize: 13, marginTop: 4 }}>Add your first setup to start tracking progress</div>
              </div>
            )}
          </div>
        )}

        {/* ── Load Schedule ──────────────────────────────────────────────── */}
        {activeTab === 'load' && (
          <div style={{ paddingTop: 24 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 24 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 16 }}>Timeline</div>
                {displayData.load_schedule.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px 0', color: 'hsl(var(--muted-foreground))' }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>🚛</div>
                    <div>No load schedule entries yet</div>
                  </div>
                ) : (
                  displayData.load_schedule.map(item => (
                    <LoadTimelineItem key={item.id} item={item} onStatusChange={handleLoadStatusChange} />
                  ))
                )}
              </div>

              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 16 }}>Status Summary</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {(['completed','in_progress','arrived','scheduled','delayed','cancelled'] as LoadStatus[]).map(s => {
                    const count = displayData.load_schedule.filter(l => l.status === s).length
                    if (!count) return null
                    const colors: Record<LoadStatus, string> = { completed: '#10b981', in_progress: '#f59e0b', arrived: '#3b82f6', scheduled: '#64748b', delayed: '#ef4444', cancelled: '#475569' }
                    return (
                      <div key={s} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'hsl(var(--card))', borderRadius: 8, border: `1px solid ${colors[s]}22` }}>
                        <span style={{ fontSize: 13, color: 'hsl(var(--foreground))', textTransform: 'capitalize' }}>{s.replace(/_/g, ' ')}</span>
                        <span style={{ fontSize: 18, fontWeight: 700, color: colors[s] }}>{count}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Equipment ──────────────────────────────────────────────────── */}
        {activeTab === 'equipment' && (
          <div style={{ paddingTop: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 16 }}>Event Equipment Assignments</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {/* Header */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 16, padding: '10px 16px', fontSize: 11, fontWeight: 700, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid hsl(var(--border) / 0.4)' }}>
                <span>Equipment</span><span>Category</span><span>Qty</span><span>Setup</span><span>Status</span>
              </div>
              {displayData.equipment.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 0', color: 'hsl(var(--muted-foreground))' }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>🎛️</div>
                  <div>No equipment assigned yet</div>
                </div>
              ) : (
                displayData.equipment.map(eq => {
                  const cfg = EQUIP_STATUS_CONFIG[eq.status]
                  return (
                    <div key={eq.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 16, padding: '14px 16px', borderBottom: '1px solid hsl(var(--border) / 0.2)', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14, color: 'hsl(var(--foreground))' }}>{eq.equipment.name}</div>
                        {(eq.equipment.make || eq.equipment.model) && (
                          <div style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>
                            {[eq.equipment.make, eq.equipment.model].filter(Boolean).join(' ')}
                          </div>
                        )}
                        {eq.assigned_to && <div style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))', marginTop: 2 }}>👤 {eq.assigned_to.full_name}</div>}
                      </div>
                      <span style={{ fontSize: 13, color: 'hsl(var(--muted-foreground))', textTransform: 'capitalize' }}>{eq.equipment.category}</span>
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'hsl(var(--foreground))' }}>{eq.quantity}</span>
                      <span style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>{eq.setup?.name ?? '—'}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 10, background: `${cfg.color}22`, color: cfg.color, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          {cfg.label}
                        </span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}

        {/* ── Suppliers ──────────────────────────────────────────────────── */}
        {activeTab === 'suppliers' && (
          <div style={{ paddingTop: 24 }}>
            {/* Progress overview */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
              <div style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border) / 0.5)', borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Brief Sent</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#f59e0b', marginBottom: 8 }}>
                  {displayData.suppliers.filter(s => s.brief_sent).length}/{displayData.suppliers.length}
                </div>
                <div style={{ height: 5, background: 'hsl(var(--muted))', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${displayData.suppliers.length ? (displayData.suppliers.filter(s => s.brief_sent).length / displayData.suppliers.length) * 100 : 0}%`, background: '#f59e0b', borderRadius: 4 }} />
                </div>
              </div>
              <div style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border) / 0.5)', borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Confirmed</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#10b981', marginBottom: 8 }}>
                  {displayData.suppliers.filter(s => s.confirmed).length}/{displayData.suppliers.length}
                </div>
                <div style={{ height: 5, background: 'hsl(var(--muted))', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${confirmedPct}%`, background: '#10b981', borderRadius: 4 }} />
                </div>
              </div>
              <div style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border) / 0.5)', borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>On Site</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#22c55e', marginBottom: 8 }}>
                  {displayData.suppliers.filter(s => s.status === 'on_site').length}
                </div>
                <div style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>vendors present</div>
              </div>
            </div>

            {/* Supplier list */}
            <div style={{ fontSize: 13, fontWeight: 700, color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>Supplier Coordination</div>
            {displayData.suppliers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: 'hsl(var(--muted-foreground))' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🏢</div>
                <div>No suppliers added yet</div>
              </div>
            ) : (
              displayData.suppliers.map(supplier => (
                <SupplierRow
                  key={supplier.id}
                  supplier={supplier}
                  onBrief={handleSendBrief}
                  onConfirm={handleConfirmSupplier}
                />
              ))
            )}
          </div>
        )}
      </div>}

      {/* Modals */}
      {showAddSetup && <AddSetupModal onClose={() => setShowAddSetup(false)} onSave={handleAddSetup} />}
      {showAddLoad && <AddLoadModal onClose={() => setShowAddLoad(false)} onSave={handleAddLoad} />}
    </div>
  )
}
