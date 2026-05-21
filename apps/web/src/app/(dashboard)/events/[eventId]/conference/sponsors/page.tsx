'use client'
import { use, useState } from 'react'
import { useConferenceSponsors, useCreateSponsor, useUpdateSponsor } from '@/hooks/use-conference'
import { useTenant } from '@/hooks/use-tenant'
import { formatCurrency, cn } from '@/lib/utils'
import { Award, Plus, Pencil, X, Globe, Mail, Phone, Star } from 'lucide-react'

const TIER_CONFIG: Record<string, { color: string; bg: string; order: number }> = {
  title:     { color: 'text-violet-300', bg: 'bg-violet-500/20 border-violet-500/40', order: 0 },
  platinum:  { color: 'text-gray-200',   bg: 'bg-gray-500/10 border-gray-500/30',     order: 1 },
  gold:      { color: 'text-yellow-300', bg: 'bg-yellow-500/10 border-yellow-500/30', order: 2 },
  silver:    { color: 'text-gray-300',   bg: 'bg-gray-500/10 border-gray-500/20',     order: 3 },
  bronze:    { color: 'text-amber-400',  bg: 'bg-amber-500/10 border-amber-500/20',   order: 4 },
  partner:   { color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/20',     order: 5 },
  media:     { color: 'text-cyan-400',   bg: 'bg-cyan-500/10 border-cyan-500/20',     order: 6 },
  community: { color: 'text-green-400',  bg: 'bg-green-500/10 border-green-500/20',   order: 7 },
}

function SponsorModal({ initial, onSave, onClose }: { initial?: any; onSave: (d: any) => void; onClose: () => void }) {
  const [form, setForm] = useState({
    company_name: initial?.company_name ?? '',
    tier: initial?.tier ?? 'bronze',
    logo_url: initial?.logo_url ?? '',
    website_url: initial?.website_url ?? '',
    tagline: initial?.tagline ?? '',
    description: initial?.description ?? '',
    contact_name: initial?.contact_name ?? '',
    contact_email: initial?.contact_email ?? '',
    contact_phone: initial?.contact_phone ?? '',
    booth_number: initial?.booth_number ?? '',
    sponsorship_amount: initial?.sponsorship_amount ?? '',
    is_featured: initial?.is_featured ?? false,
    notes: initial?.notes ?? '',
  })

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">{initial ? 'Edit Sponsor' : 'Add Sponsor'}</h3>
          <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-xs text-muted-foreground mb-1">Company Name *</label>
            <input value={form.company_name} onChange={e => setForm(p => ({ ...p, company_name: e.target.value }))}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500/50" />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Tier</label>
            <select value={form.tier} onChange={e => setForm(p => ({ ...p, tier: e.target.value }))}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500/50">
              {Object.keys(TIER_CONFIG).map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Sponsorship Amount (₹)</label>
            <input type="number" value={form.sponsorship_amount} onChange={e => setForm(p => ({ ...p, sponsorship_amount: e.target.value }))}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500/50" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-muted-foreground mb-1">Logo URL</label>
            <input value={form.logo_url} onChange={e => setForm(p => ({ ...p, logo_url: e.target.value }))}
              placeholder="https://..."
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500/50" />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Website</label>
            <input value={form.website_url} onChange={e => setForm(p => ({ ...p, website_url: e.target.value }))}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500/50" />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Tagline</label>
            <input value={form.tagline} onChange={e => setForm(p => ({ ...p, tagline: e.target.value }))}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500/50" />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Contact Name</label>
            <input value={form.contact_name} onChange={e => setForm(p => ({ ...p, contact_name: e.target.value }))}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500/50" />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Contact Email</label>
            <input type="email" value={form.contact_email} onChange={e => setForm(p => ({ ...p, contact_email: e.target.value }))}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500/50" />
          </div>
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Notes</label>
          <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2}
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500/50 resize-none" />
        </div>
        <label className="flex items-center gap-2 text-xs cursor-pointer">
          <input type="checkbox" checked={form.is_featured} onChange={e => setForm(p => ({ ...p, is_featured: e.target.checked }))} />
          Featured sponsor (show prominently)
        </label>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-1.5 border border-border rounded-lg text-xs text-muted-foreground">Cancel</button>
          <button onClick={() => onSave({ ...form, sponsorship_amount: form.sponsorship_amount ? parseFloat(String(form.sponsorship_amount)) : null })}
            className="px-4 py-1.5 bg-yellow-500 hover:bg-yellow-600 text-black text-xs font-bold rounded-lg">
            {initial ? 'Update Sponsor' : 'Add Sponsor'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ConferenceSponsorsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params)
  const { tenant } = useTenant()
  const { data: sponsorsData, isLoading } = useConferenceSponsors(tenant, eventId)
  const sponsors: any[] = sponsorsData?.sponsors ?? []
  const byTier: Record<string, any[]> = sponsorsData?.byTier ?? {}
  const createSponsor = useCreateSponsor(tenant, eventId)
  const updateSponsor = useUpdateSponsor(tenant, eventId)

  const [showModal, setShowModal] = useState(false)
  const [editSponsor, setEditSponsor] = useState<any>(null)

  const totalRevenue = sponsors.reduce((s: number, sp: any) => s + (sp.sponsorship_amount ?? 0), 0)
  const tierOrder = Object.keys(TIER_CONFIG).sort((a, b) => TIER_CONFIG[a].order - TIER_CONFIG[b].order)
  const activeTiers = tierOrder.filter(t => byTier[t]?.length > 0)

  if (isLoading) return <div className="animate-pulse space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-card border border-border rounded-xl" />)}</div>

  return (
    <div className="space-y-6">
      {(showModal || editSponsor) && (
        <SponsorModal
          initial={editSponsor}
          onClose={() => { setShowModal(false); setEditSponsor(null) }}
          onSave={async d => {
            if (editSponsor) await updateSponsor.mutateAsync({ sponsorId: editSponsor.id, ...d })
            else await createSponsor.mutateAsync(d)
            setShowModal(false); setEditSponsor(null)
          }}
        />
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2"><Award className="w-5 h-5 text-yellow-400" /> Sponsors</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{sponsors.length} sponsors · {formatCurrency(totalRevenue)} total</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 rounded-lg text-xs font-semibold hover:bg-yellow-500/20 transition-colors">
          <Plus className="w-3.5 h-3.5" /> Add Sponsor
        </button>
      </div>

      {sponsors.length === 0 ? (
        <div className="text-center py-16 bg-card border border-dashed border-border rounded-xl">
          <Award className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No sponsors yet</p>
          <button onClick={() => setShowModal(true)} className="mt-3 text-xs text-yellow-400 hover:underline">Add first sponsor</button>
        </div>
      ) : activeTiers.map(tier => (
        <div key={tier}>
          <div className="flex items-center gap-2 mb-3">
            <span className={cn('px-3 py-1 text-xs font-bold rounded-full border uppercase tracking-wide', TIER_CONFIG[tier].bg, TIER_CONFIG[tier].color)}>
              {tier} Sponsor
            </span>
            <span className="text-xs text-muted-foreground">{byTier[tier].length} sponsor{byTier[tier].length !== 1 ? 's' : ''}</span>
          </div>
          <div className={cn('grid gap-3', tier === 'title' ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3')}>
            {byTier[tier].map((s: any) => (
              <div key={s.id} className={cn('bg-card border rounded-xl p-4 hover:border-yellow-500/30 transition-colors', tier === 'title' ? 'p-6' : 'p-4')}>
                <div className="flex items-start gap-3">
                  {s.logo_url ? (
                    <img src={s.logo_url} alt={s.company_name} className={cn('rounded-lg object-contain bg-white/5', tier === 'title' ? 'w-16 h-16' : 'w-12 h-12')} />
                  ) : (
                    <div className={cn('rounded-xl flex items-center justify-center text-lg font-bold text-yellow-400 bg-yellow-500/10 shrink-0', tier === 'title' ? 'w-16 h-16 text-2xl' : 'w-12 h-12')}>
                      {s.company_name[0]}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={cn('font-semibold', tier === 'title' ? 'text-base' : 'text-sm')}>{s.company_name}</p>
                      {s.is_featured && <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />}
                    </div>
                    {s.tagline && <p className="text-xs text-muted-foreground mt-0.5">{s.tagline}</p>}
                    {s.sponsorship_amount && <p className="text-xs text-green-400 mt-1 font-medium">{formatCurrency(s.sponsorship_amount)}</p>}
                    <div className="flex items-center gap-3 mt-2">
                      {s.website_url && <a href={s.website_url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground"><Globe className="w-3.5 h-3.5" /></a>}
                      {s.contact_email && <a href={`mailto:${s.contact_email}`} className="text-muted-foreground hover:text-foreground"><Mail className="w-3.5 h-3.5" /></a>}
                    </div>
                  </div>
                  <button onClick={() => setEditSponsor(s)} className="p-1 hover:bg-accent rounded text-muted-foreground hover:text-foreground">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
