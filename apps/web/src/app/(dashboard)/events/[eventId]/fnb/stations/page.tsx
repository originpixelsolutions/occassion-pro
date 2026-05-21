'use client'
import { use, useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { cn } from '@/lib/utils'
import { ChefHat, Plus, Pencil, Trash2, X, MapPin, Clock, Users } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1'

const STATION_TYPES = ['food','beverage','dessert','live-cooking','display']
const STATION_ICONS: Record<string, string> = {
  food: '🍽️', beverage: '🥤', dessert: '🍰', 'live-cooking': '🔥', display: '🌸',
}
const STATION_COLORS: Record<string, string> = {
  food: 'bg-orange-500/10 text-orange-400',
  beverage: 'bg-blue-500/10 text-blue-400',
  dessert: 'bg-pink-500/10 text-pink-400',
  'live-cooking': 'bg-red-500/10 text-red-400',
  display: 'bg-purple-500/10 text-purple-400',
}

interface StationFormProps {
  initial?: any
  onSave: (d: any) => void
  onClose: () => void
  loading: boolean
}

function StationForm({ initial, onSave, onClose, loading }: StationFormProps) {
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    station_type: initial?.station_type ?? 'food',
    location_in_venue: initial?.location_in_venue ?? '',
    assigned_staff_count: initial?.assigned_staff_count ?? 2,
    setup_time: initial?.setup_time ?? '',
    breakdown_time: initial?.breakdown_time ?? '',
    equipment_needed: (initial?.equipment_needed ?? []).join(', '),
    notes: initial?.notes ?? '',
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-card border border-border rounded-xl w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold">{initial ? 'Edit Station' : 'New Service Station'}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Station Name *</label>
            <input className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
              placeholder="e.g. Live Pasta Counter" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Station Type</label>
              <select className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                value={form.station_type} onChange={e => setForm(p => ({ ...p, station_type: e.target.value }))}>
                {STATION_TYPES.map(t => <option key={t} value={t}>{t.replace(/-/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Staff Required</label>
              <input type="number" className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                placeholder="2" value={form.assigned_staff_count} onChange={e => setForm(p => ({ ...p, assigned_staff_count: Number(e.target.value) }))} />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Location in Venue</label>
            <input className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
              placeholder="e.g. Near the main stage, Hall B entrance" value={form.location_in_venue}
              onChange={e => setForm(p => ({ ...p, location_in_venue: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Setup Time</label>
              <input type="time" className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                value={form.setup_time} onChange={e => setForm(p => ({ ...p, setup_time: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Breakdown Time</label>
              <input type="time" className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                value={form.breakdown_time} onChange={e => setForm(p => ({ ...p, breakdown_time: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Equipment Needed (comma-separated)</label>
            <input className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
              placeholder="Chafing dishes, Induction cooktop, Display stands"
              value={form.equipment_needed} onChange={e => setForm(p => ({ ...p, equipment_needed: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Notes</label>
            <textarea className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary resize-none"
              rows={2} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-border rounded-lg text-sm hover:bg-accent transition-colors">Cancel</button>
          <button
            onClick={() => {
              const equipment_needed = form.equipment_needed.split(',').map(e => e.trim()).filter(Boolean)
              onSave({ ...form, equipment_needed })
            }}
            disabled={!form.name || loading}
            className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'Saving...' : (initial ? 'Update' : 'Create Station')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function FnbStationsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params)
  const { session, tenantId } = useAuth()
  const [stations, setStations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [modal, setModal] = useState<{ open: boolean; editing?: any }>({ open: false })

  const headers = useCallback(() => ({
    Authorization: `Bearer ${session?.access_token}`, 'x-tenant-id': tenantId ?? '', 'Content-Type': 'application/json',
  }), [session, tenantId])

  const load = useCallback(async () => {
    if (!session?.access_token || !tenantId) return
    const r = await fetch(`${API}/fnb/events/${eventId}/stations`, { headers: headers() })
    setStations(await r.json())
    setLoading(false)
  }, [eventId, session, tenantId, headers])

  useEffect(() => { load() }, [load])

  const save = async (form: any) => {
    setSaving(true)
    try {
      const url = modal.editing ? `${API}/fnb/stations/${modal.editing.id}` : `${API}/fnb/events/${eventId}/stations`
      await fetch(url, { method: modal.editing ? 'PATCH' : 'POST', headers: headers(), body: JSON.stringify(form) })
      await load()
      setModal({ open: false })
    } finally { setSaving(false) }
  }

  const del = async (id: string) => {
    if (!confirm('Delete this station?')) return
    await fetch(`${API}/fnb/stations/${id}`, { method: 'DELETE', headers: headers() })
    await load()
  }

  const totalStaff = stations.reduce((s, st) => s + (st.assigned_staff_count ?? 0), 0)

  if (loading) return <div className="space-y-3 animate-pulse">{[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-card border border-border rounded-xl" />)}</div>

  const byType = STATION_TYPES.reduce((acc, type) => {
    const matching = stations.filter(s => s.station_type === type)
    if (matching.length > 0) acc[type] = matching
    return acc
  }, {} as Record<string, any[]>)

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ChefHat className="w-5 h-5 text-blue-400" />
          <h2 className="text-lg font-bold">Service Stations</h2>
          {stations.length > 0 && (
            <span className="text-sm text-muted-foreground">· {stations.length} stations · {totalStaff} staff</span>
          )}
        </div>
        <button onClick={() => setModal({ open: true })}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
          <Plus className="w-3.5 h-3.5" /> Add Station
        </button>
      </div>

      {stations.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <ChefHat className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-medium mb-1">No stations configured</p>
          <p className="text-sm text-muted-foreground mb-4">Set up live counters, carving stations, dessert bars, and more</p>
          <button onClick={() => setModal({ open: true })} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
            Add Station
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          {Object.entries(byType).map(([type, sts]) => (
            <div key={type}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">{STATION_ICONS[type]}</span>
                <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium capitalize', STATION_COLORS[type])}>
                  {type.replace(/-/g, ' ')}
                </span>
                <span className="text-xs text-muted-foreground">{sts.length} station{sts.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {sts.map(station => (
                  <div key={station.id} className="bg-card border border-border rounded-xl p-4">
                    <div className="flex items-start justify-between mb-3">
                      <p className="font-medium">{station.name}</p>
                      <div className="flex gap-1.5">
                        <button onClick={() => setModal({ open: true, editing: station })}
                          className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent transition-colors">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => del(station.id)}
                          className="p-1.5 text-muted-foreground hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1.5 text-xs text-muted-foreground">
                      {station.location_in_venue && (
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3 h-3 shrink-0" /> {station.location_in_venue}
                        </div>
                      )}
                      <div className="flex items-center gap-3">
                        {station.setup_time && (
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Setup {station.setup_time}</span>
                        )}
                        {station.breakdown_time && (
                          <span>Breakdown {station.breakdown_time}</span>
                        )}
                        <span className="flex items-center gap-1 ml-auto">
                          <Users className="w-3 h-3" /> {station.assigned_staff_count} staff
                        </span>
                      </div>
                    </div>
                    {station.equipment_needed?.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {station.equipment_needed.map((eq: string) => (
                          <span key={eq} className="text-xs bg-accent/50 px-2 py-0.5 rounded-full">{eq}</span>
                        ))}
                      </div>
                    )}
                    {station.notes && (
                      <p className="mt-2 text-xs text-muted-foreground italic">{station.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {modal.open && (
        <StationForm initial={modal.editing} onSave={save} onClose={() => setModal({ open: false })} loading={saving} />
      )}
    </div>
  )
}
