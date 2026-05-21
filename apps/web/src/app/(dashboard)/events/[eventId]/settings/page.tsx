'use client'

import { use, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useEvent, useUpdateEvent } from '@/hooks/use-events'
import {
  ArrowLeft,
  Settings,
  Smartphone,
  Users,
  Zap,
  Trash2,
  ChevronRight,
  Globe,
  Calendar,
  MapPin,
  DollarSign,
  FileText,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  ExternalLink,
  Building2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Section cards ─────────────────────────────────────────────────────────

interface SettingsSectionProps {
  icon: React.ElementType
  iconColor: string
  iconBg: string
  title: string
  description: string
  href?: string
  onClick?: () => void
  badge?: string
  badgeColor?: string
  external?: boolean
}

function SettingsSection({
  icon: Icon,
  iconColor,
  iconBg,
  title,
  description,
  href,
  onClick,
  badge,
  badgeColor = 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  external,
}: SettingsSectionProps) {
  const inner = (
    <div className="flex items-center gap-4 p-5 bg-card border border-border rounded-xl hover:border-primary/30 hover:bg-accent/40 transition-all group cursor-pointer">
      <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center shrink-0', iconBg)}>
        <Icon className={cn('w-5 h-5', iconColor)} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-semibold text-sm">{title}</span>
          {badge && (
            <span className={cn('text-xs px-2 py-0.5 rounded-full border font-medium', badgeColor)}>
              {badge}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
      </div>
      <div className="shrink-0 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors">
        {external ? <ExternalLink className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </div>
    </div>
  )

  if (href) {
    return external ? (
      <a href={href} target="_blank" rel="noopener noreferrer">{inner}</a>
    ) : (
      <Link href={href}>{inner}</Link>
    )
  }

  return <div onClick={onClick}>{inner}</div>
}

// ─── Inline general settings form ──────────────────────────────────────────

function GeneralSettingsForm({ event, eventId }: { event: any; eventId: string }) {
  const update = useUpdateEvent(eventId)
  const [form, setForm] = useState({
    name: event.name ?? '',
    description: event.description ?? '',
    status: event.status ?? 'draft',
    start_date: event.start_date?.slice(0, 16) ?? '',
    end_date: event.end_date?.slice(0, 16) ?? '',
    venue_name: event.venue_name ?? '',
    city: event.city ?? '',
    total_budget: event.total_budget ?? '',
    currency_code: event.currency_code ?? 'INR',
    timezone: event.timezone ?? 'Asia/Kolkata',
  })
  const [saved, setSaved] = useState(false)

  const handleSave = async () => {
    await update.mutateAsync(form)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const field = (label: string, key: keyof typeof form, type = 'text', opts?: string[]) => (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1.5">{label}</label>
      {opts ? (
        <select
          value={form[key] as string}
          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
          className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        >
          {opts.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input
          type={type}
          value={form[key] as string}
          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
          className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        />
      )}
    </div>
  )

  return (
    <div className="bg-card border border-border rounded-xl p-6 space-y-5">
      <h3 className="font-semibold text-sm">General Information</h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {field('Event Name', 'name')}
        {field('Status', 'status', 'text', ['draft', 'confirmed', 'in_progress', 'completed', 'cancelled'])}
        {field('Start Date & Time', 'start_date', 'datetime-local')}
        {field('End Date & Time', 'end_date', 'datetime-local')}
        {field('Venue Name', 'venue_name')}
        {field('City', 'city')}
        {field('Total Budget', 'total_budget', 'number')}
        {field('Currency', 'currency_code', 'text', ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD'])}
        {field('Timezone', 'timezone', 'text', [
          'Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Asia/Tokyo',
          'Europe/London', 'Europe/Paris', 'America/New_York', 'America/Los_Angeles', 'UTC',
        ])}
      </div>

      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Description</label>
        <textarea
          value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          rows={3}
          className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none"
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={update.isPending}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {update.isPending
            ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</>
            : saved
            ? <><CheckCircle2 className="w-3.5 h-3.5" /> Saved!</>
            : 'Save Changes'
          }
        </button>
      </div>
    </div>
  )
}

// ─── Danger zone ───────────────────────────────────────────────────────────

function DangerZone({ eventId }: { eventId: string }) {
  const router = useRouter()

  // ── Soft-delete (move to trash) ──────────────────────────────────────────
  const [confirmingTrash, setConfirmingTrash] = useState(false)
  const [trashing, setTrashing]               = useState(false)
  const [trashInput, setTrashInput]           = useState('')
  const [trashResult, setTrashResult]         = useState<{ purge_at: string; days_remaining: number } | null>(null)

  const handleSoftDelete = async () => {
    if (trashInput !== 'TRASH') return
    setTrashing(true)
    try {
      const token    = localStorage.getItem('op_token')
      const tenantId = localStorage.getItem('op_tenant')
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1'}/events/${eventId}`,
        {
          method:  'DELETE',
          headers: {
            ...(token    ? { Authorization: `Bearer ${token}` }    : {}),
            ...(tenantId ? { 'x-tenant-id': tenantId }             : {}),
          },
        },
      )
      const data = await res.json()
      if (res.ok) {
        setTrashResult({ purge_at: data.purge_at, days_remaining: data.days_remaining ?? 30 })
        setTimeout(() => router.push('/events'), 3500)
      }
    } catch {
      setTrashing(false)
    }
  }

  // ── Permanent delete ─────────────────────────────────────────────────────
  const [confirmingPerm, setConfirmingPerm] = useState(false)
  const [permInput, setPermInput]           = useState('')
  const [destroying, setDestroying]         = useState(false)

  const handlePermanentDelete = async () => {
    if (permInput !== 'DELETE PERMANENTLY') return
    setDestroying(true)
    try {
      const token    = localStorage.getItem('op_token')
      const tenantId = localStorage.getItem('op_tenant')
      // Must be soft-deleted first — this goes via the /permanent endpoint
      await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1'}/events/${eventId}/permanent`,
        {
          method:  'DELETE',
          headers: {
            ...(token    ? { Authorization: `Bearer ${token}` }    : {}),
            ...(tenantId ? { 'x-tenant-id': tenantId }             : {}),
            'x-confirm-delete': 'true',
          },
        },
      )
      router.push('/events')
    } catch {
      setDestroying(false)
    }
  }

  // ── Trash success screen ─────────────────────────────────────────────────
  if (trashResult) {
    const purgeDate = new Date(trashResult.purge_at).toLocaleDateString('en-IN', {
      year: 'numeric', month: 'long', day: 'numeric',
    })
    return (
      <div className="bg-card border border-amber-500/20 rounded-xl p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
            <Trash2 className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <p className="font-semibold text-sm">Event moved to trash</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              This event will be permanently deleted on <strong className="text-foreground">{purgeDate}</strong>{' '}
              ({trashResult.days_remaining} days remaining). You can restore it from the Events page before then.
            </p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Redirecting you to Events…</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* ── Move to Trash ──────────────────────────────────────────────────── */}
      <div className="bg-card border border-amber-500/20 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Trash2 className="w-4 h-4 text-amber-400" />
          <h3 className="font-semibold text-sm text-amber-400">Move to Trash</h3>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Move this event to trash</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              The event will be recoverable for 30 days before automatic permanent deletion.
              Vendor assignments will be cancelled and team access suspended.
            </p>
          </div>
          <button
            onClick={() => setConfirmingTrash(true)}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 border border-amber-500/30 text-amber-400 rounded-lg text-xs hover:bg-amber-500/10 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" /> Move to Trash
          </button>
        </div>

        {confirmingTrash && (
          <div className="border border-amber-500/30 rounded-lg p-4 space-y-3 bg-amber-500/5">
            <p className="text-xs text-amber-400">
              Type <strong>TRASH</strong> to confirm. The event will be recoverable for 30 days.
            </p>
            <input
              value={trashInput}
              onChange={e => setTrashInput(e.target.value)}
              placeholder="Type TRASH"
              className="w-full bg-background border border-amber-500/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
            <div className="flex gap-2">
              <button
                onClick={handleSoftDelete}
                disabled={trashInput !== 'TRASH' || trashing}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-medium disabled:opacity-40 hover:bg-amber-700 transition-colors"
              >
                {trashing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Move to Trash
              </button>
              <button
                onClick={() => { setConfirmingTrash(false); setTrashInput('') }}
                className="px-3 py-1.5 border border-border rounded-lg text-xs hover:bg-accent transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Permanent Delete ───────────────────────────────────────────────── */}
      <div className="bg-card border border-red-500/20 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400" />
          <h3 className="font-semibold text-sm text-red-400">Danger Zone</h3>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Permanently delete this event</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Requires the event to be in trash first. Permanently removes all data — this cannot be undone.
            </p>
          </div>
          <button
            onClick={() => setConfirmingPerm(true)}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 border border-red-500/30 text-red-400 rounded-lg text-xs hover:bg-red-500/10 transition-colors"
          >
            <AlertTriangle className="w-3.5 h-3.5" /> Delete Permanently
          </button>
        </div>

        {confirmingPerm && (
          <div className="border border-red-500/30 rounded-lg p-4 space-y-3 bg-red-500/5">
            <p className="text-xs text-red-400">
              Type <strong>DELETE PERMANENTLY</strong> to confirm. This removes all event data forever.
            </p>
            <input
              value={permInput}
              onChange={e => setPermInput(e.target.value)}
              placeholder="Type DELETE PERMANENTLY"
              className="w-full bg-background border border-red-500/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-red-500"
            />
            <div className="flex gap-2">
              <button
                onClick={handlePermanentDelete}
                disabled={permInput !== 'DELETE PERMANENTLY' || destroying}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium disabled:opacity-40 hover:bg-red-700 transition-colors"
              >
                {destroying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                Delete Forever
              </button>
              <button
                onClick={() => { setConfirmingPerm(false); setPermInput('') }}
                className="px-3 py-1.5 border border-border rounded-lg text-xs hover:bg-accent transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Tab definitions ────────────────────────────────────────────────────────

const TABS = [
  { id: 'general',  label: 'General' },
  { id: 'sections', label: 'Sections' },
  { id: 'danger',   label: 'Danger Zone', color: 'text-red-400' },
] as const

type TabId = typeof TABS[number]['id']

// ─── Main page ──────────────────────────────────────────────────────────────

export default function EventSettingsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params)
  const { data: event, isLoading } = useEvent(eventId)
  const [activeTab, setActiveTab] = useState<TabId>('general')

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!event) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <p className="text-muted-foreground text-sm">Event not found</p>
        <Link href="/events" className="text-primary hover:underline text-sm">← Back to events</Link>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/events" className="hover:text-foreground transition-colors">Events</Link>
        <span>/</span>
        <Link href={`/events/${eventId}`} className="hover:text-foreground transition-colors truncate max-w-[160px]">
          {event.name}
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">Settings</span>
      </div>

      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href={`/events/${eventId}`}
          className="p-2 rounded-lg border border-border hover:bg-accent transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Settings className="w-5 h-5 text-muted-foreground" /> Event Settings
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{event.name}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === tab.id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
              (tab as any).color && activeTab !== tab.id && (tab as any).color,
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* General tab */}
      {activeTab === 'general' && (
        <GeneralSettingsForm event={event} eventId={eventId} />
      )}

      {/* Sections tab */}
      {activeTab === 'sections' && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Configure each section of this event. Click a section to open its settings.
          </p>

          <SettingsSection
            icon={Smartphone}
            iconColor="text-violet-400"
            iconBg="bg-violet-500/10"
            title="Guest Portal"
            description="Configure the mobile-first portal guests access via their invitation link — RSVP, itinerary, venue, food menu, announcements, and more."
            href={`/events/${eventId}/settings/portal`}
            badge="Active"
            badgeColor="bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
          />

          <SettingsSection
            icon={Users}
            iconColor="text-blue-400"
            iconBg="bg-blue-500/10"
            title="Team Access"
            description="Manage which workspace members have access to this event and configure per-module permission overrides."
            href={`/events/${eventId}/team`}
          />

          <SettingsSection
            icon={Users}
            iconColor="text-indigo-400"
            iconBg="bg-indigo-500/10"
            title="Client Portal"
            description="Invite clients to view their event portal — share real-time updates, documents, budget summaries, and approval requests."
            href={`/events/${eventId}/clients`}
            badge="Clients"
            badgeColor="bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
          />

          <SettingsSection
            icon={Building2}
            iconColor="text-cyan-400"
            iconBg="bg-cyan-500/10"
            title="Vendors"
            description="Assign and manage vendors for this event — photographers, caterers, decorators, AV teams, and more. Track status, amounts, and message threads."
            href={`/events/${eventId}/vendors`}
            badge="Vendor Portal"
            badgeColor="bg-cyan-500/10 text-cyan-400 border-cyan-500/20"
          />

          <SettingsSection
            icon={Globe}
            iconColor="text-pink-400"
            iconBg="bg-pink-500/10"
            title="Microsite & Registration"
            description="Manage public event page, online registration form, and ticketing for this event."
            href={`/microsites`}
          />

          <SettingsSection
            icon={Zap}
            iconColor="text-amber-400"
            iconBg="bg-amber-500/10"
            title="Short Links"
            description="Create and manage short links for this event — track clicks, set expiry dates, and redirect visitors."
            href={`/events/${eventId}/links`}
          />

          <SettingsSection
            icon={FileText}
            iconColor="text-indigo-400"
            iconBg="bg-indigo-500/10"
            title="Documents & Contracts"
            description="Generate and manage proposals, contracts, and other documents for this event."
            href={`/events/${eventId}/documents`}
          />
        </div>
      )}

      {/* Danger zone tab */}
      {activeTab === 'danger' && (
        <DangerZone eventId={eventId} />
      )}
    </div>
  )
}
