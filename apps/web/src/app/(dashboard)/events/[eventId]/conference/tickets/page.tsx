'use client'
import { use, useState } from 'react'
import { useConferenceTickets, useCreateTicket, useUpdateTicket, useDeleteTicket } from '@/hooks/use-conference'
import { useTenant } from '@/hooks/use-tenant'
import { formatCurrency, cn } from '@/lib/utils'
import { Ticket, Plus, Pencil, Trash2, Tag, Users, X, Check } from 'lucide-react'

const TICKET_COLORS: Record<string, string> = {
  general: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  vip: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  speaker: 'bg-green-500/10 text-green-400 border-green-500/20',
  sponsor: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  student: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  virtual: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
  group: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
}

function TicketForm({ initial, onSave, onCancel }: { initial?: any; onSave: (d: any) => void; onCancel: () => void }) {
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    description: initial?.description ?? '',
    ticket_type: initial?.ticket_type ?? 'general',
    price: initial?.price ?? 0,
    early_bird_price: initial?.early_bird_price ?? '',
    currency_code: initial?.currency_code ?? 'INR',
    quantity_total: initial?.quantity_total ?? '',
    is_active: initial?.is_active ?? true,
    includes_meal: initial?.includes_meal ?? false,
    includes_kit: initial?.includes_kit ?? false,
    includes_recording: initial?.includes_recording ?? false,
    color: initial?.color ?? '#6366f1',
  })

  return (
    <div className="bg-background border border-violet-500/30 rounded-xl p-5 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Ticket Name *</label>
          <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
            placeholder="General Admission"
            className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500/50" />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Ticket Type</label>
          <select value={form.ticket_type} onChange={e => setForm(p => ({ ...p, ticket_type: e.target.value }))}
            className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500/50">
            {['general','vip','speaker','sponsor','exhibitor','student','group','virtual','press','staff'].map(t => (
              <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Price (₹)</label>
          <input type="number" value={form.price} onChange={e => setForm(p => ({ ...p, price: parseFloat(e.target.value) || 0 }))}
            className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500/50" />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Early Bird Price (₹)</label>
          <input type="number" value={form.early_bird_price} onChange={e => setForm(p => ({ ...p, early_bird_price: e.target.value }))}
            placeholder="Optional"
            className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500/50" />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Total Quantity</label>
          <input type="number" value={form.quantity_total} onChange={e => setForm(p => ({ ...p, quantity_total: e.target.value }))}
            placeholder="Unlimited"
            className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500/50" />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Color</label>
          <div className="flex items-center gap-2">
            <input type="color" value={form.color} onChange={e => setForm(p => ({ ...p, color: e.target.value }))}
              className="w-10 h-9 rounded-lg border border-border bg-card cursor-pointer" />
            <input value={form.color} onChange={e => setForm(p => ({ ...p, color: e.target.value }))}
              className="flex-1 bg-card border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500/50" />
          </div>
        </div>
      </div>
      <div>
        <label className="block text-xs text-muted-foreground mb-1">Description</label>
        <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
          rows={2} placeholder="What's included..."
          className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500/50 resize-none" />
      </div>
      <div className="flex gap-4">
        {[
          { key: 'includes_meal', label: 'Meal Included' },
          { key: 'includes_kit', label: 'Kit Included' },
          { key: 'includes_recording', label: 'Recording Access' },
          { key: 'is_active', label: 'Active' },
        ].map(({ key, label }) => (
          <label key={key} className="flex items-center gap-1.5 text-xs cursor-pointer">
            <input type="checkbox" checked={form[key as keyof typeof form] as boolean}
              onChange={e => setForm(p => ({ ...p, [key]: e.target.checked }))}
              className="rounded border-border" />
            {label}
          </label>
        ))}
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="px-4 py-1.5 border border-border rounded-lg text-xs text-muted-foreground hover:text-foreground transition-colors">
          Cancel
        </button>
        <button onClick={() => onSave({ ...form, quantity_total: form.quantity_total ? parseInt(String(form.quantity_total)) : null, early_bird_price: form.early_bird_price ? parseFloat(String(form.early_bird_price)) : null })}
          className="px-4 py-1.5 bg-violet-500 hover:bg-violet-600 text-white text-xs font-semibold rounded-lg transition-colors">
          {initial ? 'Update Ticket' : 'Create Ticket'}
        </button>
      </div>
    </div>
  )
}

export default function ConferenceTicketsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params)
  const { tenant } = useTenant()
  const { data: tickets = [], isLoading } = useConferenceTickets(tenant, eventId)
  const createTicket = useCreateTicket(tenant, eventId)
  const updateTicket = useUpdateTicket(tenant, eventId)
  const deleteTicket = useDeleteTicket(tenant, eventId)

  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)

  const totalRevenue = tickets.reduce((s: number, t: any) => s + (t.quantity_sold * t.price), 0)
  const totalSold = tickets.reduce((s: number, t: any) => s + t.quantity_sold, 0)

  if (isLoading) {
    return <div className="animate-pulse space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-card border border-border rounded-xl" />)}</div>
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2"><Ticket className="w-5 h-5 text-violet-400" /> Tickets</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{tickets.length} ticket types · {totalSold} sold · {formatCurrency(totalRevenue)} revenue</p>
        </div>
        {!showForm && (
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-500 hover:bg-violet-600 text-white text-xs font-semibold rounded-lg transition-colors">
            <Plus className="w-3.5 h-3.5" /> Add Ticket
          </button>
        )}
      </div>

      {showForm && (
        <TicketForm
          onSave={async d => { await createTicket.mutateAsync(d); setShowForm(false) }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Tickets list */}
      <div className="space-y-3">
        {tickets.length === 0 && !showForm && (
          <div className="text-center py-16 bg-card border border-dashed border-border rounded-xl">
            <Ticket className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No tickets yet</p>
            <button onClick={() => setShowForm(true)} className="mt-3 text-xs text-violet-400 hover:underline">Create your first ticket</button>
          </div>
        )}

        {tickets.map((ticket: any) => (
          <div key={ticket.id}>
            {editId === ticket.id ? (
              <TicketForm
                initial={ticket}
                onSave={async d => { await updateTicket.mutateAsync({ ticketId: ticket.id, ...d }); setEditId(null) }}
                onCancel={() => setEditId(null)}
              />
            ) : (
              <div className="bg-card border border-border rounded-xl p-5 hover:border-violet-500/30 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-3 h-3 rounded-full mt-1 shrink-0" style={{ backgroundColor: ticket.color ?? '#6366f1' }} />
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold">{ticket.name}</p>
                        <span className={cn('text-[10px] px-2 py-0.5 rounded-full border font-medium capitalize', TICKET_COLORS[ticket.ticket_type] ?? 'bg-card border-border text-muted-foreground')}>
                          {ticket.ticket_type}
                        </span>
                        {!ticket.is_active && <span className="text-[10px] px-2 py-0.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-full">Inactive</span>}
                      </div>
                      {ticket.description && <p className="text-xs text-muted-foreground mt-1">{ticket.description}</p>}
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Tag className="w-3 h-3" /> {formatCurrency(ticket.price)}</span>
                        {ticket.early_bird_price && <span className="text-green-400">Early bird: {formatCurrency(ticket.early_bird_price)}</span>}
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {ticket.quantity_sold}{ticket.quantity_total ? `/${ticket.quantity_total}` : ''} sold
                        </span>
                        {ticket.includes_meal && <span className="text-green-400/70">🍽 Meal</span>}
                        {ticket.includes_kit && <span className="text-blue-400/70">🎒 Kit</span>}
                        {ticket.includes_recording && <span className="text-violet-400/70">📹 Recording</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {ticket.quantity_total && (
                      <div className="hidden sm:block">
                        <div className="text-[10px] text-muted-foreground text-right mb-0.5">
                          {Math.round((ticket.quantity_sold / ticket.quantity_total) * 100)}% sold
                        </div>
                        <div className="w-24 h-1.5 bg-background rounded-full overflow-hidden">
                          <div className="h-full bg-violet-500 rounded-full"
                            style={{ width: `${Math.min((ticket.quantity_sold / ticket.quantity_total) * 100, 100)}%` }} />
                        </div>
                      </div>
                    )}
                    <button onClick={() => setEditId(ticket.id)}
                      className="p-1.5 hover:bg-accent rounded-lg transition-colors text-muted-foreground hover:text-foreground">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => { if (confirm('Delete this ticket?')) deleteTicket.mutate(ticket.id) }}
                      className="p-1.5 hover:bg-red-500/10 rounded-lg transition-colors text-muted-foreground hover:text-red-400">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
