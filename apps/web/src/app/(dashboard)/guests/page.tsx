'use client'
import {
  useState, useCallback, useEffect, useRef, useMemo,
} from 'react'
import {
  Users, UserPlus, Search, CheckCircle2, Clock, XCircle, ChevronRight, X,
  Edit2, Trash2, Mail, Phone, UtensilsCrossed, Tag, Download, QrCode,
  ChevronDown, ChevronUp, GripVertical, Eye, EyeOff, Columns3, Filter,
  Upload, Link2, UserCheck, SlidersHorizontal, Plus, AlertCircle,
  Building2, Car, Bed, TableProperties, MoreHorizontal, Send, Printer,
  LayoutGrid, Palette, FileDown, Check, Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/use-auth'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1'

// ─── Types ───────────────────────────────────────────────────────────────────

type InviteStatus = 'not_sent' | 'sent' | 'delivered' | 'opened' | 'bounced'
type RsvpStatus   = 'pending'  | 'confirmed' | 'declined' | 'maybe' | 'waitlist'
type AccomStatus  = 'not_required' | 'requested' | 'assigned' | 'checked_in' | 'checked_out'
type TransportStatus = 'not_required' | 'requested' | 'arranged'
type Category     = 'family' | 'friend' | 'colleague' | 'vip' | 'vendor' | 'media' | 'general'

interface ColumnDef {
  id: string; field: string; label: string
  visible: boolean; width: 'narrow' | 'normal' | 'wide'; frozen: boolean; order: number
}

interface TableView {
  id: string; name: string; is_default: boolean
  column_ids: string[]; sort_by?: string; sort_dir?: 'asc'|'desc'
  filter_config: Record<string, string>; group_by?: string; share_token: string
}

interface FormattingRule {
  field: string; operator: string; value?: string
  row_bg_color?: string; row_text_color?: string
  left_border_color?: string; bold_text?: boolean; sort_order: number
}

interface Guest {
  id: string
  full_name?: string; first_name: string; last_name: string
  email?: string; phone?: string
  category?: Category
  invite_status?: InviteStatus
  rsvp_status?: RsvpStatus
  accommodation_status?: AccomStatus
  transport_status?: TransportStatus
  meal_preference?: string
  table_number?: string
  checked_in?: boolean; check_in_time?: string
  plus_ones?: number
  company?: string; designation?: string
  source?: string; notes?: string
  custom_data?: Record<string, any>
  event_id?: string
}

// ─── Status configs ──────────────────────────────────────────────────────────

const INVITE_CFG: Record<string, { label: string; cls: string }> = {
  not_sent:  { label: 'Not Sent',  cls: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20' },
  sent:      { label: 'Sent',      cls: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  delivered: { label: 'Delivered', cls: 'bg-sky-500/10 text-sky-400 border-sky-500/20' },
  opened:    { label: 'Opened',    cls: 'bg-violet-500/10 text-violet-400 border-violet-500/20' },
  bounced:   { label: 'Bounced',   cls: 'bg-red-500/10 text-red-400 border-red-500/20' },
}
const RSVP_CFG: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  pending:   { label: 'Pending',   cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20',   icon: <Clock className="w-3 h-3" /> },
  confirmed: { label: 'Confirmed', cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', icon: <CheckCircle2 className="w-3 h-3" /> },
  declined:  { label: 'Declined',  cls: 'bg-red-500/10 text-red-400 border-red-500/20',          icon: <XCircle className="w-3 h-3" /> },
  maybe:     { label: 'Maybe',     cls: 'bg-orange-500/10 text-orange-400 border-orange-500/20', icon: <Clock className="w-3 h-3" /> },
  waitlist:  { label: 'Waitlist',  cls: 'bg-blue-500/10 text-blue-400 border-blue-500/20',       icon: <Clock className="w-3 h-3" /> },
}
const ACCOM_CFG: Record<string, { label: string; cls: string }> = {
  not_required: { label: '—',           cls: 'text-muted-foreground text-xs' },
  requested:    { label: 'Requested',   cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  assigned:     { label: 'Assigned',    cls: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  checked_in:   { label: 'Checked In',  cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  checked_out:  { label: 'Checked Out', cls: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20' },
}
const CAT_CFG: Record<string, string> = {
  family: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
  friend: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  colleague: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  vip: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  vendor: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
  media: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  general: 'bg-muted text-muted-foreground border-border',
}
const MEAL_EMOJI: Record<string, string> = {
  vegetarian: '🥗', vegan: '🌱', halal: '🥩', kosher: '✡️',
  'gluten-free': '🌾', jain: '🙏', 'no nuts': '🥜',
}

const DEFAULT_COLS: ColumnDef[] = [
  { id: 'name',          field: 'full_name',            label: 'Guest Name',    visible: true,  width: 'wide',   frozen: true,  order: 0  },
  { id: 'category',      field: 'category',             label: 'Category',      visible: true,  width: 'normal', frozen: false, order: 1  },
  { id: 'invite',        field: 'invite_status',        label: 'Invite',        visible: true,  width: 'normal', frozen: false, order: 2  },
  { id: 'rsvp',          field: 'rsvp_status',          label: 'RSVP',          visible: true,  width: 'normal', frozen: false, order: 3  },
  { id: 'accommodation', field: 'accommodation_status', label: 'Accommodation', visible: true,  width: 'normal', frozen: false, order: 4  },
  { id: 'transport',     field: 'transport_status',     label: 'Transport',     visible: false, width: 'normal', frozen: false, order: 5  },
  { id: 'meal',          field: 'meal_preference',      label: 'Meal',          visible: true,  width: 'narrow', frozen: false, order: 6  },
  { id: 'table',         field: 'table_number',         label: 'Table',         visible: true,  width: 'narrow', frozen: false, order: 7  },
  { id: 'checkin',       field: 'checked_in',           label: 'Check-in',      visible: true,  width: 'normal', frozen: false, order: 8  },
  { id: 'plus_ones',     field: 'plus_ones',            label: '+1s',           visible: true,  width: 'narrow', frozen: false, order: 9  },
  { id: 'actions',       field: '',                     label: '',              visible: true,  width: 'narrow', frozen: false, order: 10 },
]

// ─── Hooks ───────────────────────────────────────────────────────────────────

function useApi<T>(path: string, token: string) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const refetch = useCallback(() => {
    if (!token) return
    setLoading(true)
    fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(setData).catch(console.error).finally(() => setLoading(false))
  }, [path, token])
  useEffect(() => { refetch() }, [refetch])
  return { data, loading, refetch }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function Avatar({ name, size = 7 }: { name: string; size?: number }) {
  const parts = name.trim().split(' ')
  const initials = (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')
  const colors = ['bg-violet-500/20 text-violet-400', 'bg-blue-500/20 text-blue-400', 'bg-emerald-500/20 text-emerald-400', 'bg-amber-500/20 text-amber-400', 'bg-pink-500/20 text-pink-400']
  const color = colors[name.charCodeAt(0) % colors.length]
  return (
    <div className={cn(`w-${size} h-${size} rounded-full flex items-center justify-center text-xs font-bold shrink-0`, color)}>
      {initials.toUpperCase()}
    </div>
  )
}

function Pill({ children, cls }: { children: React.ReactNode; cls?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border', cls)}>
      {children}
    </span>
  )
}

// ─── Add Guest Modal ──────────────────────────────────────────────────────────

function AddGuestModal({ token, eventId, onClose, onSaved }: {
  token: string; eventId: string; onClose: () => void; onSaved: () => void
}) {
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', phone: '',
    category: 'general' as Category, company: '', designation: '',
    rsvp_status: 'pending' as RsvpStatus, plus_ones: 0, notes: '',
  })
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!form.first_name) return
    setSaving(true)
    await fetch(`${API}/events/${eventId}/guests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...form, full_name: `${form.first_name} ${form.last_name}`.trim() }),
    })
    setSaving(false); onSaved(); onClose()
  }

  const inp = "w-full bg-input border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
  const F = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="space-y-1"><label className="text-xs text-muted-foreground font-medium">{label}</label>{children}</div>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="font-semibold text-sm">Add Guest</h2>
          <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <F label="First Name *"><input className={inp} value={form.first_name} onChange={e => setForm(p => ({ ...p, first_name: e.target.value }))} /></F>
            <F label="Last Name"><input className={inp} value={form.last_name} onChange={e => setForm(p => ({ ...p, last_name: e.target.value }))} /></F>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <F label="Email"><input type="email" className={inp} value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></F>
            <F label="Phone"><input className={inp} value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} /></F>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <F label="Category">
              <select className={inp} value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value as Category }))}>
                {(['family','friend','colleague','vip','vendor','media','general'] as Category[]).map(c => (
                  <option key={c} value={c} className="capitalize">{c}</option>
                ))}
              </select>
            </F>
            <F label="Plus Ones"><input type="number" min={0} max={10} className={inp} value={form.plus_ones} onChange={e => setForm(p => ({ ...p, plus_ones: +e.target.value }))} /></F>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <F label="Company"><input className={inp} value={form.company} onChange={e => setForm(p => ({ ...p, company: e.target.value }))} /></F>
            <F label="Designation"><input className={inp} value={form.designation} onChange={e => setForm(p => ({ ...p, designation: e.target.value }))} /></F>
          </div>
          <F label="Notes"><textarea className={inp + ' resize-none'} rows={2} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} /></F>
        </div>
        <div className="flex justify-end gap-2 px-5 pb-5">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-accent">Cancel</button>
          <button onClick={save} disabled={saving || !form.first_name} className="px-4 py-2 text-sm rounded-lg bg-primary text-white hover:bg-primary/90 disabled:opacity-50">
            {saving ? 'Saving…' : 'Add Guest'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Import Modal (4-step CSV flow) ──────────────────────────────────────────

const IMPORT_FIELD_OPTIONS = [
  { value: '', label: '— Skip —' },
  { value: 'full_name', label: 'Full Name' },
  { value: 'first_name', label: 'First Name' },
  { value: 'last_name', label: 'Last Name' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'category', label: 'Category' },
  { value: 'company', label: 'Company' },
  { value: 'designation', label: 'Designation' },
  { value: 'meal_preference', label: 'Meal Preference' },
  { value: 'table_number', label: 'Table Number' },
  { value: 'plus_ones', label: 'Plus Ones' },
  { value: 'notes', label: 'Notes' },
]

function ImportModal({ token, eventId, onClose, onSaved }: {
  token: string; eventId: string; onClose: () => void; onSaved: () => void
}) {
  const [step, setStep] = useState<'upload'|'map'|'preview'|'result'>('upload')
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<Record<string, string>[]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [previewData, setPreviewData] = useState<any>(null)
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function parseCSV(text: string) {
    const lines = text.split('\n').filter(l => l.trim())
    if (!lines.length) return
    const h = lines[0].split(',').map(c => c.trim().replace(/^"|"$/g, ''))
    const r = lines.slice(1, 11).map(line => {
      const vals = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''))
      return Object.fromEntries(h.map((hh, i) => [hh, vals[i] ?? '']))
    })
    setHeaders(h)
    setRows(r)
    // Auto-map known headers
    const autoMap: Record<string, string> = {}
    h.forEach(hh => {
      const lower = hh.toLowerCase()
      if (lower === 'name' || lower === 'full name' || lower === 'guest name') autoMap[hh] = 'full_name'
      else if (lower === 'first name' || lower === 'first_name') autoMap[hh] = 'first_name'
      else if (lower === 'last name' || lower === 'last_name') autoMap[hh] = 'last_name'
      else if (lower === 'email' || lower === 'email address') autoMap[hh] = 'email'
      else if (lower === 'phone' || lower === 'mobile' || lower === 'contact') autoMap[hh] = 'phone'
      else if (lower === 'category' || lower === 'type') autoMap[hh] = 'category'
      else if (lower === 'company' || lower === 'organization' || lower === 'org') autoMap[hh] = 'company'
      else if (lower === 'designation' || lower === 'role' || lower === 'title') autoMap[hh] = 'designation'
      else if (lower === 'meal' || lower === 'dietary' || lower === 'food') autoMap[hh] = 'meal_preference'
      else if (lower === 'table' || lower === 'table number' || lower === 'seat') autoMap[hh] = 'table_number'
      else if (lower === 'plus ones' || lower === 'plus_ones' || lower === 'guests') autoMap[hh] = 'plus_ones'
      else if (lower === 'notes' || lower === 'remarks') autoMap[hh] = 'notes'
    })
    setMapping(autoMap)
    setStep('map')
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    const reader = new FileReader()
    reader.onload = ev => parseCSV(ev.target?.result as string)
    reader.readAsText(f)
  }

  async function preview() {
    setLoading(true)
    const res = await fetch(`${API}/events/${eventId}/guests/import/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ headers, rows }),
    })
    const data = await res.json()
    setPreviewData(data)
    setLoading(false)
    setStep('preview')
  }

  async function execute() {
    setLoading(true)
    const res = await fetch(`${API}/events/${eventId}/guests/import/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ filename: 'import.csv', headers, rows, columnMapping: mapping }),
    })
    const data = await res.json()
    setResult(data)
    setLoading(false)
    setStep('result')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-3">
            <h2 className="font-semibold text-sm">Import Guests</h2>
            <div className="flex items-center gap-1">
              {(['upload','map','preview','result'] as const).map((s, i) => (
                <div key={s} className="flex items-center gap-1">
                  <div className={cn('w-6 h-6 rounded-full text-xs flex items-center justify-center font-medium', step === s ? 'bg-primary text-white' : ['upload','map','preview','result'].indexOf(step) > i ? 'bg-emerald-500 text-white' : 'bg-muted text-muted-foreground')}>
                    {i + 1}
                  </div>
                  {i < 3 && <div className="w-6 h-px bg-border" />}
                </div>
              ))}
            </div>
          </div>
          <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>

        <div className="p-5">
          {step === 'upload' && (
            <div className="space-y-4">
              <div
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-border rounded-xl p-10 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
              >
                <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm font-medium">Drop a CSV or Excel file here</p>
                <p className="text-xs text-muted-foreground mt-1">or click to browse</p>
                <input ref={fileRef} type="file" accept=".csv,.xlsx" className="hidden" onChange={onFile} />
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground">or</span>
                <div className="flex-1 h-px bg-border" />
              </div>
              <button
                onClick={async () => {
                  const res = await fetch(`${API}/events/${eventId}/guests/import/template`, { headers: { Authorization: `Bearer ${token}` } })
                  const blob = await res.blob()
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a'); a.href = url; a.download = 'guest_import_template.csv'; a.click()
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent"
              >
                <Download className="w-4 h-4" />Download Template CSV
              </button>
            </div>
          )}

          {step === 'map' && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">Map your CSV columns to guest fields. Unmapped columns will be skipped.</p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {headers.map(h => (
                  <div key={h} className="flex items-center gap-3">
                    <span className="text-sm font-medium w-40 truncate">{h}</span>
                    <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                    <select
                      value={mapping[h] ?? ''}
                      onChange={e => setMapping(p => ({ ...p, [h]: e.target.value }))}
                      className="flex-1 bg-input border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      {IMPORT_FIELD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setStep('upload')} className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-accent">Back</button>
                <button onClick={preview} disabled={loading} className="px-4 py-2 text-sm rounded-lg bg-primary text-white hover:bg-primary/90 disabled:opacity-50">
                  {loading ? 'Loading…' : 'Preview'}
                </button>
              </div>
            </div>
          )}

          {step === 'preview' && previewData && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Valid', value: previewData.valid ?? 0, cls: 'text-emerald-400' },
                  { label: 'Duplicates', value: previewData.duplicates ?? 0, cls: 'text-amber-400' },
                  { label: 'Errors', value: previewData.errors?.length ?? 0, cls: 'text-red-400' },
                ].map(s => (
                  <div key={s.label} className="bg-muted/20 rounded-lg p-3 text-center">
                    <p className={cn('text-2xl font-bold', s.cls)}>{s.value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
                  </div>
                ))}
              </div>
              {previewData.errors?.length > 0 && (
                <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3 space-y-1 max-h-32 overflow-y-auto">
                  {previewData.errors.map((e: any, i: number) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-red-400">
                      <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                      <span>Row {e.row}: {e.errors?.join(', ')}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="overflow-x-auto border border-border rounded-lg">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/20 border-b border-border">
                      {Object.keys(previewData.sample?.[0] ?? {}).map(k => (
                        <th key={k} className="px-3 py-2 text-left text-muted-foreground font-medium">{k}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(previewData.sample ?? []).slice(0, 5).map((row: any, i: number) => (
                      <tr key={i} className="border-b border-border last:border-0">
                        {Object.values(row).map((v: any, j: number) => (
                          <td key={j} className="px-3 py-2 text-muted-foreground truncate max-w-[120px]">{String(v ?? '—')}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setStep('map')} className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-accent">Back</button>
                <button onClick={execute} disabled={loading || !previewData.valid} className="px-4 py-2 text-sm rounded-lg bg-primary text-white hover:bg-primary/90 disabled:opacity-50">
                  {loading ? 'Importing…' : `Import ${previewData.valid} Guests`}
                </button>
              </div>
            </div>
          )}

          {step === 'result' && result && (
            <div className="space-y-4">
              <div className="text-center py-4">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
                <p className="font-semibold">Import Complete</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {result.inserted ?? 0} guests added · {result.duplicates ?? 0} duplicates skipped · {result.failed ?? 0} failed
                </p>
              </div>
              <div className="flex justify-end">
                <button onClick={() => { onSaved(); onClose() }} className="px-4 py-2 text-sm rounded-lg bg-primary text-white hover:bg-primary/90">Done</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Column Manager Panel ─────────────────────────────────────────────────────

function ColumnManagerPanel({ cols, onChange, onClose }: {
  cols: ColumnDef[]; onChange: (cols: ColumnDef[]) => void; onClose: () => void
}) {
  const [local, setLocal] = useState(cols)
  const drag = useRef<number | null>(null)

  function toggle(id: string) {
    setLocal(p => p.map(c => c.id === id ? { ...c, visible: !c.visible } : c))
  }
  function setWidth(id: string, w: ColumnDef['width']) {
    setLocal(p => p.map(c => c.id === id ? { ...c, width: w } : c))
  }
  function onDragStart(i: number) { drag.current = i }
  function onDrop(i: number) {
    if (drag.current === null || drag.current === i) return
    const next = [...local]
    const [moved] = next.splice(drag.current, 1)
    next.splice(i, 0, moved)
    setLocal(next.map((c, idx) => ({ ...c, order: idx })))
    drag.current = null
  }

  return (
    <div className="absolute top-full right-0 mt-1 w-72 bg-card border border-border rounded-xl shadow-xl z-20">
      <div className="flex items-center justify-between p-3 border-b border-border">
        <span className="text-sm font-medium">Column Manager</span>
        <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
      </div>
      <div className="max-h-80 overflow-y-auto p-2 space-y-0.5">
        {local.filter(c => c.id !== 'actions').map((col, i) => (
          <div
            key={col.id}
            draggable
            onDragStart={() => onDragStart(i)}
            onDragOver={e => e.preventDefault()}
            onDrop={() => onDrop(i)}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-accent group cursor-grab active:cursor-grabbing"
          >
            <GripVertical className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
            <button onClick={() => toggle(col.id)} className="text-muted-foreground hover:text-foreground">
              {col.visible ? <Eye className="w-3.5 h-3.5 text-primary" /> : <EyeOff className="w-3.5 h-3.5" />}
            </button>
            <span className={cn('text-xs flex-1', !col.visible && 'text-muted-foreground')}>{col.label}</span>
            <div className="flex gap-0.5">
              {(['narrow','normal','wide'] as const).map(w => (
                <button key={w} onClick={() => setWidth(col.id, w)} className={cn('px-1.5 py-0.5 rounded text-xs', col.width === w ? 'bg-primary text-white' : 'text-muted-foreground hover:text-foreground')}>
                  {w === 'narrow' ? 'S' : w === 'normal' ? 'M' : 'L'}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="p-3 border-t border-border flex justify-end gap-2">
        <button onClick={onClose} className="px-3 py-1.5 text-xs rounded-lg border border-border hover:bg-accent">Cancel</button>
        <button onClick={() => { onChange(local); onClose() }} className="px-3 py-1.5 text-xs rounded-lg bg-primary text-white hover:bg-primary/90">Apply</button>
      </div>
    </div>
  )
}

// ─── Guest Detail Panel ───────────────────────────────────────────────────────

function GuestDetailPanel({ guest, token, eventId, onClose, onUpdate }: {
  guest: Guest; token: string; eventId: string; onClose: () => void; onUpdate: () => void
}) {
  const fullName = guest.full_name ?? `${guest.first_name} ${guest.last_name}`

  async function remove() {
    if (!confirm(`Remove ${fullName}?`)) return
    await fetch(`${API}/events/${eventId}/guests/${guest.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    onUpdate(); onClose()
  }

  async function checkIn() {
    await fetch(`${API}/events/${eventId}/guests/${guest.id}/check-in`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
    onUpdate()
  }

  const rsvp = RSVP_CFG[guest.rsvp_status ?? 'pending']
  const invite = INVITE_CFG[guest.invite_status ?? 'not_sent']
  const accom = ACCOM_CFG[guest.accommodation_status ?? 'not_required']

  return (
    <div className="w-80 shrink-0 border-l border-border bg-card flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h3 className="font-semibold text-sm">Guest Details</h3>
        <div className="flex gap-1">
          <button onClick={remove} className="p-1.5 hover:bg-red-500/10 rounded-lg text-muted-foreground hover:text-red-400">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={onClose} className="p-1.5 hover:bg-accent rounded-lg text-muted-foreground">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="flex items-center gap-3">
          <Avatar name={fullName} size={12} />
          <div>
            <p className="font-semibold text-sm">{fullName}</p>
            {guest.designation && <p className="text-xs text-muted-foreground">{guest.designation}{guest.company ? `, ${guest.company}` : ''}</p>}
            {guest.category && (
              <Pill cls={cn('mt-1', CAT_CFG[guest.category] ?? CAT_CFG.general)}>
                {guest.category}
              </Pill>
            )}
          </div>
        </div>

        {/* Check-in */}
        <div className={cn("p-3 rounded-lg border", guest.checked_in ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-muted/20 border-border')}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <QrCode className={cn("w-4 h-4", guest.checked_in ? 'text-emerald-400' : 'text-muted-foreground')} />
              <span className="text-xs font-medium">{guest.checked_in ? 'Checked In' : 'Not Checked In'}</span>
            </div>
            {!guest.checked_in && guest.rsvp_status === 'confirmed' && (
              <button onClick={checkIn} className="px-2.5 py-1 bg-emerald-500/20 text-emerald-400 rounded text-xs hover:bg-emerald-500/30">Check In</button>
            )}
          </div>
          {guest.check_in_time && <p className="text-xs text-muted-foreground mt-1">{new Date(guest.check_in_time).toLocaleTimeString()}</p>}
        </div>

        {/* Status row */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-muted/20 rounded-lg p-2 text-center">
            <p className="text-xs text-muted-foreground mb-1">Invite</p>
            <Pill cls={invite.cls}>{invite.label}</Pill>
          </div>
          <div className="bg-muted/20 rounded-lg p-2 text-center">
            <p className="text-xs text-muted-foreground mb-1">RSVP</p>
            <Pill cls={rsvp.cls}>{rsvp.icon}{rsvp.label}</Pill>
          </div>
          <div className="bg-muted/20 rounded-lg p-2 text-center">
            <p className="text-xs text-muted-foreground mb-1">Accommodation</p>
            <span className={cn('text-xs', accom.cls)}>{accom.label}</span>
          </div>
          <div className="bg-muted/20 rounded-lg p-2 text-center">
            <p className="text-xs text-muted-foreground mb-1">Plus Ones</p>
            <span className="text-sm font-bold">{guest.plus_ones ?? 0}</span>
          </div>
        </div>

        {/* Contact */}
        <div className="space-y-2">
          {guest.email && <div className="flex items-center gap-2 text-sm"><Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" /><span className="truncate text-xs">{guest.email}</span></div>}
          {guest.phone && <div className="flex items-center gap-2 text-sm"><Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" /><span className="text-xs">{guest.phone}</span></div>}
          {guest.meal_preference && (
            <div className="flex items-center gap-2 text-sm"><UtensilsCrossed className="w-3.5 h-3.5 text-muted-foreground shrink-0" /><span className="text-xs capitalize">{MEAL_EMOJI[guest.meal_preference.toLowerCase()] ?? ''} {guest.meal_preference}</span></div>
          )}
          {guest.table_number && (
            <div className="flex items-center gap-2 text-sm"><Tag className="w-3.5 h-3.5 text-muted-foreground shrink-0" /><span className="text-xs">{guest.table_number}</span></div>
          )}
        </div>

        {/* Actions */}
        <div className="space-y-2">
          <button className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-border rounded-lg text-xs hover:bg-accent">
            <Send className="w-3.5 h-3.5" />Send Invitation
          </button>
          <button className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-border rounded-lg text-xs hover:bg-accent">
            <Bed className="w-3.5 h-3.5" />Assign Room
          </button>
        </div>

        {guest.notes && <div className="p-3 bg-muted/20 rounded-lg"><p className="text-xs text-muted-foreground whitespace-pre-line">{guest.notes}</p></div>}
      </div>
    </div>
  )
}

// ─── Add Guest Dropdown ───────────────────────────────────────────────────────

function AddGuestDropdown({ onManual, onImport, onRegLink }: {
  onManual: () => void; onImport: () => void; onRegLink: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const items = [
    { icon: <UserPlus className="w-4 h-4" />, label: 'Add Manually', sub: 'Enter details one by one', action: onManual },
    { icon: <Upload className="w-4 h-4" />, label: 'Import CSV / Excel', sub: 'Bulk upload from file', action: onImport },
    { icon: <Link2 className="w-4 h-4" />, label: 'Public Registration Link', sub: 'Let guests register themselves', action: onRegLink },
    { icon: <UserCheck className="w-4 h-4" />, label: 'Add from Team', sub: 'Pick from team profiles', action: () => { setOpen(false) } },
  ]

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(p => !p)}
        className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90"
      >
        <UserPlus className="w-4 h-4" />Add Guest<ChevronDown className="w-3.5 h-3.5" />
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-1 w-64 bg-card border border-border rounded-xl shadow-xl z-20 overflow-hidden">
          {items.map(item => (
            <button
              key={item.label}
              onClick={() => { item.action(); setOpen(false) }}
              className="w-full flex items-start gap-3 px-4 py-3 hover:bg-accent text-left"
            >
              <div className="mt-0.5 text-muted-foreground">{item.icon}</div>
              <div>
                <p className="text-sm font-medium">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.sub}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Cell Renderer ────────────────────────────────────────────────────────────

function cellFor(col: ColumnDef, g: Guest): React.ReactNode {
  switch (col.id) {
    case 'name': {
      const name = g.full_name ?? `${g.first_name} ${g.last_name}`
      return (
        <div className="flex items-center gap-2.5">
          <Avatar name={name} size={7} />
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{name}</p>
            <p className="text-xs text-muted-foreground truncate">{g.email}</p>
          </div>
        </div>
      )
    }
    case 'category':
      return g.category
        ? <Pill cls={CAT_CFG[g.category] ?? CAT_CFG.general}>{g.category}</Pill>
        : <span className="text-xs text-muted-foreground">—</span>

    case 'invite': {
      const cfg = INVITE_CFG[g.invite_status ?? 'not_sent']
      return <Pill cls={cfg.cls}>{cfg.label}</Pill>
    }
    case 'rsvp': {
      const cfg = RSVP_CFG[g.rsvp_status ?? 'pending']
      return <Pill cls={cfg.cls}>{cfg.icon}{cfg.label}</Pill>
    }
    case 'accommodation': {
      const cfg = ACCOM_CFG[g.accommodation_status ?? 'not_required']
      if (g.accommodation_status === 'not_required' || !g.accommodation_status) return <span className="text-xs text-muted-foreground">—</span>
      return <Pill cls={cfg.cls}>{cfg.label}</Pill>
    }
    case 'transport':
      if (!g.transport_status || g.transport_status === 'not_required') return <span className="text-xs text-muted-foreground">—</span>
      return <Pill cls="bg-sky-500/10 text-sky-400 border-sky-500/20"><Car className="w-3 h-3" />{g.transport_status}</Pill>

    case 'meal':
      return g.meal_preference
        ? <span className="text-xs">{MEAL_EMOJI[g.meal_preference.toLowerCase()] ?? ''} {g.meal_preference}</span>
        : <span className="text-xs text-muted-foreground">—</span>

    case 'table':
      return g.table_number
        ? <span className="text-xs font-medium">{g.table_number}</span>
        : <span className="text-xs text-muted-foreground">—</span>

    case 'checkin':
      return g.checked_in
        ? <Pill cls="bg-emerald-500/10 text-emerald-400 border-emerald-500/20"><CheckCircle2 className="w-3 h-3" />In</Pill>
        : <span className="text-xs text-muted-foreground">—</span>

    case 'plus_ones':
      return (g.plus_ones ?? 0) > 0
        ? <span className="text-sm font-medium">+{g.plus_ones}</span>
        : <span className="text-xs text-muted-foreground">0</span>

    case 'actions':
      return (
        <button className="p-1.5 hover:bg-accent rounded-lg opacity-0 group-hover:opacity-100 text-muted-foreground">
          <MoreHorizontal className="w-3.5 h-3.5" />
        </button>
      )
    default:
      return <span className="text-xs text-muted-foreground">—</span>
  }
}

// ─── Badge Modal ──────────────────────────────────────────────────────────────

type BadgeLayout   = '6up' | '8up' | 'avery5160' | '1up'
type BadgePaper    = 'A4' | 'Letter'
type BadgeFont     = 'Helvetica' | 'Times-Roman' | 'Courier'
type BadgeField    = 'guest_name' | 'category' | 'table' | 'company' | 'qr_code' | 'event_name' | 'logo'

interface BadgeConfig {
  layout?: BadgeLayout
  paper_size?: BadgePaper
  orientation?: 'portrait' | 'landscape'
  show_fields?: BadgeField[]
  primary_color?: string
  secondary_color?: string
  text_color?: string
  font_family?: BadgeFont
  logo_url?: string
}

const LAYOUT_INFO: Record<BadgeLayout, { label: string; cols: number; rows: number; desc: string }> = {
  '6up':       { label: '6-up',    cols: 2, rows: 3,  desc: '2×3 grid — A5 badges' },
  '8up':       { label: '8-up',    cols: 2, rows: 4,  desc: '2×4 grid — slim badges' },
  'avery5160': { label: 'Avery 5160', cols: 3, rows: 10, desc: '3×10 label sheet' },
  '1up':       { label: '1-up',    cols: 1, rows: 1,  desc: 'Full-page single badge' },
}

const FIELD_LABELS: Record<BadgeField, string> = {
  guest_name: 'Guest Name',
  category:   'Category / Role',
  table:      'Table Number',
  company:    'Company',
  qr_code:    'QR Code',
  event_name: 'Event Name',
  logo:       'Logo',
}

const ALL_FIELDS: BadgeField[] = ['guest_name', 'event_name', 'category', 'table', 'company', 'qr_code', 'logo']

// Mini badge preview rendered as SVG
function BadgePreview({ cfg }: { cfg: BadgeConfig }) {
  const primary   = cfg.primary_color   ?? '#6366f1'
  const secondary = cfg.secondary_color ?? '#1e1b4b'
  const textCol   = cfg.text_color      ?? '#ffffff'
  const show      = cfg.show_fields     ?? ALL_FIELDS
  const W = 220, H = 140

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg"
      className="rounded-lg shadow-lg border border-white/10">
      {/* Background */}
      <rect width={W} height={H} fill={secondary} rx="6" />
      {/* Header strip */}
      <rect width={W} height={32} fill={primary} rx="6" />
      <rect y={26} width={W} height={6} fill={primary} />
      {/* Event name in header */}
      {show.includes('event_name') && (
        <text x={10} y={20} fill={textCol} fontSize="9" fontWeight="bold" fontFamily="Helvetica">Event Name</text>
      )}
      {/* Logo placeholder in header */}
      {show.includes('logo') && (
        <rect x={W - 30} y={6} width={20} height={20} fill="rgba(255,255,255,0.15)" rx="3" />
      )}
      {/* Guest name */}
      {show.includes('guest_name') && (
        <text x={10} y={52} fill={textCol} fontSize="12" fontWeight="bold" fontFamily="Helvetica">Guest Name</text>
      )}
      {/* Category pill */}
      {show.includes('category') && (
        <g>
          <rect x={10} y={58} width={52} height={14} fill={primary} rx="7" opacity="0.7" />
          <text x={36} y={68.5} fill={textCol} fontSize="7" textAnchor="middle" fontFamily="Helvetica">VIP Guest</text>
        </g>
      )}
      {/* Company */}
      {show.includes('company') && (
        <text x={10} y={83} fill={textCol} fontSize="8" opacity="0.7" fontFamily="Helvetica">Company / Designation</text>
      )}
      {/* Table */}
      {show.includes('table') && (
        <text x={10} y={96} fill={primary} fontSize="8" fontWeight="bold" fontFamily="Helvetica">Table 12</text>
      )}
      {/* QR code placeholder */}
      {show.includes('qr_code') && (
        <g>
          <rect x={W - 52} y={40} width={42} height={42} fill="rgba(255,255,255,0.12)" rx="4" />
          {/* QR pattern hint */}
          {[0,1,2,3,4,5,6].map(r => [0,1,2,3,4,5,6].map(c => {
            const on = (r < 3 && c < 3) || (r < 3 && c > 3) || (r > 3 && c < 3) || (r === 3 && c === 3) || Math.random() > 0.5
            return on ? (
              <rect key={`${r}-${c}`} x={W - 50 + c * 5} y={42 + r * 5} width={4} height={4}
                fill={textCol} opacity="0.6" rx="0.5" />
            ) : null
          }))}
        </g>
      )}
      {/* Cut-line border */}
      <rect width={W} height={H} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1"
        strokeDasharray="4,3" rx="6" />
    </svg>
  )
}

function BadgeModal({ token, eventId, totalGuests, selectedIds, onClose }: {
  token: string
  eventId: string
  totalGuests: number
  selectedIds: string[]
  onClose: () => void
}) {
  const [tab, setTab] = useState<'design' | 'generate'>('design')
  const [cfg, setCfg] = useState<BadgeConfig>({
    layout: '6up',
    paper_size: 'A4',
    orientation: 'portrait',
    show_fields: ALL_FIELDS,
    primary_color: '#6366f1',
    secondary_color: '#1e1b4b',
    text_color: '#ffffff',
    font_family: 'Helvetica',
    logo_url: '',
  })
  const [loadingCfg, setLoadingCfg]   = useState(true)
  const [saving, setSaving]           = useState(false)
  const [generating, setGenerating]   = useState(false)
  const [saved, setSaved]             = useState(false)

  // Load existing config
  useEffect(() => {
    fetch(`${API}/events/${eventId}/badges/config`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setCfg(prev => ({ ...prev, ...data })) })
      .catch(() => {})
      .finally(() => setLoadingCfg(false))
  }, [eventId, token])

  function toggleField(f: BadgeField) {
    setCfg(p => {
      const cur = p.show_fields ?? ALL_FIELDS
      return { ...p, show_fields: cur.includes(f) ? cur.filter(x => x !== f) : [...cur, f] }
    })
  }

  async function saveConfig() {
    setSaving(true)
    try {
      await fetch(`${API}/events/${eventId}/badges/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(cfg),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {}
    setSaving(false)
  }

  async function downloadPdf(ids?: string[]) {
    setGenerating(true)
    try {
      const params = ids?.length
        ? '?guestIds=' + ids.join(',')
        : ''
      const res = await fetch(`${API}/events/${eventId}/badges/export${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `badges-${eventId}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      alert('Badge PDF generation failed. Make sure pdf-lib is installed on the server.')
    }
    setGenerating(false)
  }

  const layoutInfo = LAYOUT_INFO[cfg.layout ?? '6up']
  const perPage    = layoutInfo.cols * layoutInfo.rows
  const count      = selectedIds.length || totalGuests
  const pages      = Math.ceil(count / perPage)

  const inp = "w-full bg-input border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-xl w-full max-w-3xl shadow-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Printer className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-sm">Badge Designer</h2>
              <p className="text-xs text-muted-foreground">Design and export event badges as PDF</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-5 pt-3 shrink-0">
          {([
            { id: 'design',   label: 'Template Design', icon: Palette },
            { id: 'generate', label: 'Generate & Export', icon: FileDown },
          ] as const).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                tab === id ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              )}
            >
              <Icon className="w-3.5 h-3.5" />{label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {loadingCfg ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : tab === 'design' ? (
            <div className="grid grid-cols-2 gap-0 h-full">

              {/* Left: Controls */}
              <div className="p-5 space-y-5 border-r border-border overflow-y-auto">

                {/* Layout */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Layout</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(Object.entries(LAYOUT_INFO) as [BadgeLayout, typeof LAYOUT_INFO[BadgeLayout]][]).map(([key, info]) => (
                      <button
                        key={key}
                        onClick={() => setCfg(p => ({ ...p, layout: key }))}
                        className={cn(
                          'relative p-3 rounded-lg border text-left transition-colors',
                          cfg.layout === key
                            ? 'border-primary bg-primary/5 text-foreground'
                            : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
                        )}
                      >
                        {/* Grid icon */}
                        <div className="grid gap-0.5 mb-2"
                          style={{ gridTemplateColumns: `repeat(${info.cols}, 1fr)`, width: 36 }}>
                          {Array.from({ length: info.cols * Math.min(info.rows, 4) }).map((_, i) => (
                            <div key={i} className={cn('h-2 rounded-sm', cfg.layout === key ? 'bg-primary/40' : 'bg-border')} />
                          ))}
                        </div>
                        <p className="text-xs font-medium">{info.label}</p>
                        <p className="text-[10px] opacity-60 mt-0.5">{info.desc}</p>
                        {cfg.layout === key && (
                          <Check className="absolute top-2 right-2 w-3 h-3 text-primary" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Paper size */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Paper Size</label>
                  <div className="flex gap-2">
                    {(['A4', 'Letter'] as BadgePaper[]).map(s => (
                      <button
                        key={s}
                        onClick={() => setCfg(p => ({ ...p, paper_size: s }))}
                        className={cn(
                          'flex-1 py-2 rounded-lg border text-xs font-medium transition-colors',
                          cfg.paper_size === s ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:border-primary/50'
                        )}
                      >{s}</button>
                    ))}
                  </div>
                </div>

                {/* Font */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Font</label>
                  <select
                    value={cfg.font_family}
                    onChange={e => setCfg(p => ({ ...p, font_family: e.target.value as BadgeFont }))}
                    className={inp}
                  >
                    <option value="Helvetica">Helvetica (Sans-serif)</option>
                    <option value="Times-Roman">Times Roman (Serif)</option>
                    <option value="Courier">Courier (Monospace)</option>
                  </select>
                </div>

                {/* Colors */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Colors</label>
                  <div className="space-y-2">
                    {([
                      { key: 'primary_color',   label: 'Primary (header, accents)' },
                      { key: 'secondary_color', label: 'Background' },
                      { key: 'text_color',      label: 'Text' },
                    ] as { key: keyof BadgeConfig; label: string }[]).map(({ key, label }) => (
                      <div key={key} className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">{label}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-muted-foreground">{cfg[key] as string}</span>
                          <div className="relative">
                            <div
                              className="w-7 h-7 rounded-lg border border-border cursor-pointer shadow-sm"
                              style={{ background: cfg[key] as string }}
                            />
                            <input
                              type="color"
                              value={cfg[key] as string}
                              onChange={e => setCfg(p => ({ ...p, [key]: e.target.value }))}
                              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Logo URL */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Logo URL</label>
                  <input
                    type="url"
                    placeholder="https://example.com/logo.png"
                    className={inp}
                    value={cfg.logo_url ?? ''}
                    onChange={e => setCfg(p => ({ ...p, logo_url: e.target.value }))}
                  />
                  <p className="text-[10px] text-muted-foreground">Must be a public image URL (PNG/JPG)</p>
                </div>
              </div>

              {/* Right: Fields + Preview */}
              <div className="p-5 space-y-5 overflow-y-auto">

                {/* Fields */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Show Fields</label>
                  <div className="space-y-1">
                    {ALL_FIELDS.map(f => (
                      <label key={f} className="flex items-center gap-2.5 py-1.5 px-2 rounded-lg hover:bg-accent cursor-pointer">
                        <div
                          onClick={() => toggleField(f)}
                          className={cn(
                            'w-4 h-4 rounded border flex items-center justify-center shrink-0 cursor-pointer transition-colors',
                            (cfg.show_fields ?? ALL_FIELDS).includes(f)
                              ? 'bg-primary border-primary'
                              : 'border-border'
                          )}
                        >
                          {(cfg.show_fields ?? ALL_FIELDS).includes(f) && <Check className="w-2.5 h-2.5 text-white" />}
                        </div>
                        <span className="text-sm">{FIELD_LABELS[f]}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Live preview */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Preview</label>
                  <div className="flex justify-center p-4 bg-muted/30 rounded-xl border border-border">
                    <BadgePreview cfg={cfg} />
                  </div>
                  <p className="text-[10px] text-muted-foreground text-center">Approximate preview — actual PDF may vary</p>
                </div>
              </div>
            </div>
          ) : (
            /* Generate tab */
            <div className="p-6 space-y-6">

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: 'Layout',    value: LAYOUT_INFO[cfg.layout ?? '6up'].label },
                  { label: 'Per Page',  value: perPage.toString() },
                  { label: 'Pages',     value: pages.toString() },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-muted/30 border border-border rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold">{value}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                  </div>
                ))}
              </div>

              {/* Summary */}
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <Printer className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium">Ready to generate</p>
                    <p className="text-muted-foreground text-xs mt-0.5">
                      {totalGuests} total guests · layout {LAYOUT_INFO[cfg.layout ?? '6up'].label} ·{' '}
                      {cfg.paper_size ?? 'A4'} paper
                      {selectedIds.length > 0 && ` · ${selectedIds.length} selected`}
                    </p>
                    <p className="text-muted-foreground text-xs mt-1">
                      Fields included: {(cfg.show_fields ?? ALL_FIELDS).map(f => FIELD_LABELS[f]).join(', ')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Download buttons */}
              <div className="space-y-3">
                <button
                  onClick={() => downloadPdf()}
                  disabled={generating}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-white rounded-xl font-medium text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                  {generating ? 'Generating PDF…' : `Export All ${totalGuests} Badges`}
                </button>

                {selectedIds.length > 0 && (
                  <button
                    onClick={() => downloadPdf(selectedIds)}
                    disabled={generating}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-card border border-border rounded-xl font-medium text-sm hover:bg-accent disabled:opacity-50 transition-colors"
                  >
                    <Printer className="w-4 h-4" />
                    Export {selectedIds.length} Selected Badges
                  </button>
                )}
              </div>

              {/* Layout preview */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Layout Grid</label>
                <div className="bg-muted/30 border border-border rounded-xl p-4">
                  <div
                    className="grid gap-1 mx-auto"
                    style={{
                      gridTemplateColumns: `repeat(${layoutInfo.cols}, 1fr)`,
                      maxWidth: 240,
                    }}
                  >
                    {Array.from({ length: layoutInfo.cols * Math.min(layoutInfo.rows, 6) }).map((_, i) => (
                      <div
                        key={i}
                        className="rounded-sm border border-primary/20 flex items-center justify-center"
                        style={{
                          height: Math.max(28, 120 / layoutInfo.rows),
                          background: i === 0 ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.05)',
                        }}
                      >
                        {i === 0 && <span className="text-[8px] text-primary opacity-60">badge</span>}
                      </div>
                    ))}
                  </div>
                  {layoutInfo.rows > 6 && (
                    <p className="text-center text-xs text-muted-foreground mt-2 opacity-60">
                      +{layoutInfo.rows - 6} more rows
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-border shrink-0">
          {tab === 'design' ? (
            <>
              <p className="text-xs text-muted-foreground">Changes are saved per event</p>
              <div className="flex items-center gap-2">
                <button onClick={onClose} className="px-3 py-2 text-sm rounded-lg border border-border hover:bg-accent">
                  Cancel
                </button>
                <button
                  onClick={saveConfig}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg bg-primary text-white hover:bg-primary/90 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saved ? <Check className="w-3.5 h-3.5" /> : null}
                  {saving ? 'Saving…' : saved ? 'Saved!' : 'Save Template'}
                </button>
              </div>
            </>
          ) : (
            <>
              <button
                onClick={() => setTab('design')}
                className="px-3 py-2 text-sm rounded-lg border border-border hover:bg-accent"
              >
                ← Edit Template
              </button>
              <button onClick={onClose} className="px-3 py-2 text-sm rounded-lg border border-border hover:bg-accent">
                Close
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function GuestsPage() {
  const { session } = useAuth()
  const token = session?.access_token ?? ''
  // In a real app, eventId comes from URL params. Placeholder here.
  const eventId = 'current-event-id'

  const [search, setSearch] = useState('')
  const [rsvpFilter, setRsvpFilter] = useState('all')
  const [catFilter, setCatFilter] = useState('all')
  const [groupBy, setGroupBy] = useState<'none'|'rsvp_status'|'category'|'accommodation_status'>('none')
  const [sortField, setSortField] = useState<string>('full_name')
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('asc')
  const [selected, setSelected] = useState<Guest | null>(null)
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set())

  const [showAddModal, setShowAddModal] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [showColManager, setShowColManager] = useState(false)
  const [showBadgeModal, setShowBadgeModal] = useState(false)
  const [cols, setCols] = useState<ColumnDef[]>(DEFAULT_COLS)

  const [activeView, setActiveView] = useState<string>('default')
  const [views] = useState<TableView[]>([
    { id: 'default', name: 'All Guests', is_default: true, column_ids: [], sort_by: 'full_name', sort_dir: 'asc', filter_config: {}, group_by: undefined, share_token: '' },
  ])

  const { data: res, loading, refetch } = useApi<{ data: Guest[]; count: number }>(
    `/events/${eventId}/guests`, token
  )
  const guests = res?.data ?? []

  // Filtered + sorted guests
  const filtered = useMemo(() => {
    let list = guests.filter(g => {
      const name = (g.full_name ?? `${g.first_name} ${g.last_name}`).toLowerCase()
      const matchSearch = !search || name.includes(search.toLowerCase()) || (g.email ?? '').toLowerCase().includes(search.toLowerCase())
      const matchRsvp = rsvpFilter === 'all' || g.rsvp_status === rsvpFilter
      const matchCat = catFilter === 'all' || g.category === catFilter
      return matchSearch && matchRsvp && matchCat
    })
    list = [...list].sort((a, b) => {
      const av = (a as any)[sortField] ?? ''
      const bv = (b as any)[sortField] ?? ''
      return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av))
    })
    return list
  }, [guests, search, rsvpFilter, catFilter, sortField, sortDir])

  // Grouped
  const grouped = useMemo(() => {
    if (groupBy === 'none') return { '': filtered }
    return filtered.reduce((acc, g) => {
      const key = String((g as any)[groupBy] ?? 'Unknown')
      if (!acc[key]) acc[key] = []
      acc[key].push(g)
      return acc
    }, {} as Record<string, Guest[]>)
  }, [filtered, groupBy])

  // Stats
  const confirmed  = guests.filter(g => g.rsvp_status === 'confirmed').length
  const pending    = guests.filter(g => g.rsvp_status === 'pending').length
  const checkedIn  = guests.filter(g => g.checked_in).length
  const inviteSent = guests.filter(g => g.invite_status && g.invite_status !== 'not_sent').length

  const visibleCols = cols.filter(c => c.visible).sort((a, b) => a.order - b.order)

  function toggleSort(field: string) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
  }

  function toggleBulk(id: string) {
    setBulkSelected(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  function toggleAllBulk() {
    if (bulkSelected.size === filtered.length) setBulkSelected(new Set())
    else setBulkSelected(new Set(filtered.map(g => g.id)))
  }

  const colWidthClass = (w: ColumnDef['width']) =>
    w === 'wide' ? 'min-w-[200px]' : w === 'narrow' ? 'min-w-[80px]' : 'min-w-[120px]'

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Header */}
        <div className="px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-lg font-semibold">Guests</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                {guests.length} total · {confirmed} confirmed · {checkedIn} checked in
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={async () => {
                  const res = await fetch(`${API}/events/${eventId}/guests/export`, { headers: { Authorization: `Bearer ${token}` } })
                  const blob = await res.blob()
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a'); a.href = url; a.download = 'guests.csv'; a.click()
                }}
                className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent"
              >
                <Download className="w-4 h-4" />Export
              </button>
              <button
                onClick={() => setShowBadgeModal(true)}
                className="flex items-center gap-2 px-3 py-2 border border-primary/30 rounded-lg text-sm text-primary hover:bg-primary/5 hover:border-primary/60 transition-colors"
              >
                <Printer className="w-4 h-4" />Print Badges
              </button>
              <AddGuestDropdown
                onManual={() => setShowAddModal(true)}
                onImport={() => setShowImport(true)}
                onRegLink={() => alert('Public registration link — coming soon')}
              />
            </div>
          </div>

          {/* Stats cards */}
          <div className="grid grid-cols-5 gap-3 mb-4">
            {[
              { label: 'Total',      value: guests.length,  color: 'text-blue-400',    icon: Users },
              { label: 'Confirmed',  value: confirmed,       color: 'text-emerald-400', icon: CheckCircle2 },
              { label: 'Pending',    value: pending,         color: 'text-amber-400',   icon: Clock },
              { label: 'Checked In', value: checkedIn,       color: 'text-violet-400',  icon: QrCode },
              { label: 'Invited',    value: inviteSent,      color: 'text-sky-400',     icon: Send },
            ].map(({ label, value, color, icon: Icon }) => (
              <div key={label} className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <Icon className={cn('w-4 h-4', color)} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-lg font-bold">{value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Views tabs */}
          <div className="flex items-center gap-1 mb-3 overflow-x-auto">
            {views.map(v => (
              <button
                key={v.id}
                onClick={() => setActiveView(v.id)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors',
                  activeView === v.id ? 'bg-primary text-white' : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                )}
              >
                {v.name}
              </button>
            ))}
            <button className="px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-accent flex items-center gap-1 whitespace-nowrap">
              <Plus className="w-3 h-3" />New View
            </button>
          </div>

          {/* Toolbar */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Search */}
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search guests…"
                className="w-full pl-9 pr-3 py-2 bg-input border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* RSVP filter */}
            <div className="flex items-center gap-1">
              {(['all','pending','confirmed','declined','maybe'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setRsvpFilter(s)}
                  className={cn(
                    'px-2.5 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors whitespace-nowrap',
                    rsvpFilter === s ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:text-foreground'
                  )}
                >
                  {s === 'all' ? 'All RSVP' : s}
                  {s !== 'all' && <span className="ml-1.5 opacity-60">{guests.filter(g => g.rsvp_status === s).length}</span>}
                </button>
              ))}
            </div>

            {/* Category filter */}
            <select
              value={catFilter}
              onChange={e => setCatFilter(e.target.value)}
              className="bg-input border border-border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">All Categories</option>
              {['family','friend','colleague','vip','vendor','media','general'].map(c => (
                <option key={c} value={c} className="capitalize">{c}</option>
              ))}
            </select>

            {/* Group by */}
            <select
              value={groupBy}
              onChange={e => setGroupBy(e.target.value as any)}
              className="bg-input border border-border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="none">No grouping</option>
              <option value="rsvp_status">Group by RSVP</option>
              <option value="category">Group by Category</option>
              <option value="accommodation_status">Group by Accommodation</option>
            </select>

            {/* Bulk actions */}
            {bulkSelected.size > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 rounded-lg border border-primary/20">
                <span className="text-xs font-medium text-primary">{bulkSelected.size} selected</span>
                <button className="text-xs text-muted-foreground hover:text-foreground px-2 py-0.5 rounded hover:bg-accent">Send Invite</button>
                <button className="text-xs text-muted-foreground hover:text-foreground px-2 py-0.5 rounded hover:bg-accent">Assign Room</button>
                <button
                  onClick={() => setShowBadgeModal(true)}
                  className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 px-2 py-0.5 rounded hover:bg-primary/10"
                >
                  <Printer className="w-3 h-3" />Print Badges
                </button>
                <button onClick={() => setBulkSelected(new Set())} className="text-xs text-muted-foreground hover:text-red-400">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Column manager trigger */}
            <div className="relative ml-auto">
              <button
                onClick={() => setShowColManager(p => !p)}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-accent"
              >
                <Columns3 className="w-3.5 h-3.5" />Columns
              </button>
              {showColManager && (
                <ColumnManagerPanel cols={cols} onChange={setCols} onClose={() => setShowColManager(false)} />
              )}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">Loading guests…</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center">
              <Users className="w-10 h-10 text-muted-foreground opacity-30 mb-3" />
              <p className="text-sm font-medium">No guests found</p>
              <p className="text-xs text-muted-foreground mt-1">Try adjusting your filters or add guests</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-border bg-muted/30 backdrop-blur-sm">
                  <th className="px-3 py-2.5 w-8">
                    <input
                      type="checkbox"
                      checked={bulkSelected.size === filtered.length && filtered.length > 0}
                      onChange={toggleAllBulk}
                      className="rounded border-border"
                    />
                  </th>
                  {visibleCols.map(col => (
                    <th
                      key={col.id}
                      className={cn('px-3 py-2.5 text-left text-xs font-medium text-muted-foreground select-none', colWidthClass(col.width), col.id !== 'actions' && 'cursor-pointer hover:text-foreground')}
                      onClick={() => col.id !== 'actions' && col.field && toggleSort(col.field)}
                    >
                      <div className="flex items-center gap-1">
                        {col.label}
                        {col.field && sortField === col.field && (
                          sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(grouped).map(([group, guestList]) => (
                  <>
                    {groupBy !== 'none' && group && (
                      <tr key={`group-${group}`} className="border-b border-border bg-muted/10">
                        <td colSpan={visibleCols.length + 1} className="px-4 py-2">
                          <span className="text-xs font-semibold text-muted-foreground capitalize">{group}</span>
                          <span className="ml-2 text-xs text-muted-foreground opacity-60">({guestList.length})</span>
                        </td>
                      </tr>
                    )}
                    {guestList.map(g => (
                      <tr
                        key={g.id}
                        onClick={() => setSelected(p => p?.id === g.id ? null : g)}
                        className={cn(
                          'border-b border-border cursor-pointer hover:bg-accent/30 transition-colors group',
                          selected?.id === g.id && 'bg-primary/5',
                          bulkSelected.has(g.id) && 'bg-primary/5'
                        )}
                      >
                        <td className="px-3 py-2.5 w-8" onClick={e => { e.stopPropagation(); toggleBulk(g.id) }}>
                          <input type="checkbox" checked={bulkSelected.has(g.id)} onChange={() => {}} className="rounded border-border" />
                        </td>
                        {visibleCols.map(col => (
                          <td key={col.id} className={cn('px-3 py-2.5', colWidthClass(col.width))}>
                            {cellFor(col, g)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Detail panel */}
      {selected && (
        <GuestDetailPanel
          guest={selected} token={token} eventId={eventId}
          onClose={() => setSelected(null)}
          onUpdate={() => { refetch(); setSelected(null) }}
        />
      )}

      {/* Modals */}
      {showAddModal && <AddGuestModal token={token} eventId={eventId} onClose={() => setShowAddModal(false)} onSaved={refetch} />}
      {showImport && <ImportModal token={token} eventId={eventId} onClose={() => setShowImport(false)} onSaved={refetch} />}
      {showBadgeModal && (
        <BadgeModal
          token={token}
          eventId={eventId}
          totalGuests={guests.length}
          selectedIds={Array.from(bulkSelected)}
          onClose={() => setShowBadgeModal(false)}
        />
      )}
    </div>
  )
}
