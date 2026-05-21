'use client'
import { useState } from 'react'
import {
  Building2, Palette, Bell, Shield, Globe, Save, Upload,
  CreditCard, Users, Key, Smartphone, LogOut, Trash2,
  ChevronRight, CheckCircle2, AlertCircle, Clock, Plus,
  Eye, EyeOff, RefreshCw, Download, ExternalLink, Crown,
  Check, X, Camera, Mail, Phone, MapPin, Link,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type Tab = 'company' | 'billing' | 'team' | 'security' | 'appearance' | 'danger'

// ─────────── COMPANY TAB ────────────────────────────────────
function CompanyTab() {
  const [form, setForm] = useState({
    name:    'Sharma Events & Productions',
    slug:    'sharma-events',
    email:   'admin@sharmaevents.in',
    phone:   '+91 98765 43210',
    website: 'https://sharmaevents.in',
    address: '14B, Nariman Point, Mumbai, Maharashtra 400021',
    gst:     '27AABCS1429B1ZB',
    pan:     'AABCS1429B',
    logo:    null as string | null,
  })

  const [saved, setSaved] = useState(false)

  return (
    <div className="max-w-2xl space-y-6">
      {/* Logo */}
      <div>
        <label className="block text-sm font-medium text-foreground/80 mb-3">Company Logo</label>
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-xl border-2 border-dashed border-border/60 bg-muted/20 flex items-center justify-center">
            {form.logo
              ? <img src={form.logo} alt="Logo" className="w-full h-full rounded-xl object-cover" />
              : <Camera className="w-6 h-6 text-muted-foreground" />}
          </div>
          <div>
            <button className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/40 hover:bg-muted/60 text-xs text-foreground/80 transition-colors">
              <Upload className="w-3.5 h-3.5" /> Upload Logo
            </button>
            <p className="text-[10px] text-muted-foreground mt-1">PNG, JPG up to 2MB. Recommended: 256×256px</p>
          </div>
        </div>
      </div>

      {/* Fields */}
      {[
        { label: 'Company Name', key: 'name', icon: Building2 },
        { label: 'Subdomain / Slug', key: 'slug', icon: Globe, prefix: 'app.occasionpro.in/', readonly: true },
        { label: 'Business Email', key: 'email', icon: Mail },
        { label: 'Phone', key: 'phone', icon: Phone },
        { label: 'Website', key: 'website', icon: Link },
        { label: 'Business Address', key: 'address', icon: MapPin },
        { label: 'GST Number', key: 'gst', icon: Building2 },
        { label: 'PAN Number', key: 'pan', icon: Building2 },
      ].map(field => (
        <div key={field.key}>
          <label className="block text-sm font-medium text-foreground/80 mb-1.5">{field.label}</label>
          <div className="flex">
            {field.prefix && (
              <span className="flex items-center px-3 rounded-l-lg bg-muted/30 border border-r-0 border-border/60 text-xs text-muted-foreground">{field.prefix}</span>
            )}
            <input
              value={form[field.key as keyof typeof form] ?? ''}
              onChange={e => !field.readonly && setForm({ ...form, [field.key]: e.target.value })}
              readOnly={field.readonly}
              className={cn(
                'flex-1 px-3 py-2.5 border border-border/60 bg-muted/30 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/40 transition-colors',
                field.prefix ? 'rounded-r-lg' : 'rounded-lg',
                field.readonly && 'opacity-50 cursor-not-allowed',
              )}
            />
          </div>
        </div>
      ))}

      <div className="flex items-center gap-3">
        <button
          onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 2000) }}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-foreground text-sm font-medium hover:bg-primary/90 transition-all"
        >
          {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saved ? 'Saved!' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}

// ─────────── BILLING TAB ─────────────────────────────────────
const PLANS = [
  { id: 'starter', name: 'Starter',    price: '₹4,999/mo',  events: '10 events/mo',  users: '5 users',   features: ['Core modules', 'Basic analytics', 'Email support'], current: false },
  { id: 'pro',     name: 'Pro',        price: '₹14,999/mo', events: '50 events/mo',  users: '20 users',  features: ['All modules', 'Advanced AI', 'Webhooks & API', 'Priority support'], current: true },
  { id: 'enterprise', name: 'Enterprise', price: 'Custom',  events: 'Unlimited',      users: 'Unlimited', features: ['Custom modules', 'Dedicated infra', 'SLA guarantee', 'Dedicated CSM'], current: false },
]

function BillingTab() {
  return (
    <div className="space-y-8 max-w-4xl">
      {/* Current plan */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Crown className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">Pro Plan</span>
              <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-medium">Active</span>
            </div>
            <p className="text-xs text-muted-foreground">Next billing date: June 1, 2026 · ₹14,999</p>
          </div>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/40 hover:bg-muted/60 text-xs text-foreground/80 transition-colors">
            <ExternalLink className="w-3.5 h-3.5" /> Manage Billing
          </button>
        </div>
      </div>

      {/* Plan comparison */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-4">Compare Plans</h3>
        <div className="grid grid-cols-3 gap-4">
          {PLANS.map(plan => (
            <div key={plan.id} className={cn('rounded-xl border p-5 flex flex-col', plan.current ? 'border-primary/30 bg-primary/5' : 'border-border/40 bg-muted/20')}>
              {plan.current && <span className="self-start mb-3 px-2 py-0.5 rounded-full bg-primary/20 text-primary text-[10px] font-medium">Current Plan</span>}
              <h4 className="text-sm font-bold text-foreground">{plan.name}</h4>
              <p className="text-2xl font-bold text-foreground mt-1 mb-1">{plan.price}</p>
              <p className="text-xs text-muted-foreground mb-4">{plan.events} · {plan.users}</p>
              <ul className="space-y-2 flex-1">
                {plan.features.map(f => (
                  <li key={f} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <button className={cn('mt-5 py-2 rounded-lg text-sm font-medium transition-colors', plan.current ? 'bg-muted/40 text-muted-foreground cursor-not-allowed' : 'bg-primary/15 text-primary hover:bg-primary/25')}>
                {plan.current ? 'Current' : plan.id === 'enterprise' ? 'Contact Sales' : 'Upgrade'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Usage */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-4">Usage This Month</h3>
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'Events', used: 23, limit: 50 },
            { label: 'Active Users', used: 14, limit: 20 },
            { label: 'API Calls', used: 182430, limit: 500000 },
            { label: 'Storage', used: 4.2, limit: 25, unit: 'GB' },
          ].map(u => {
            const pct = Math.round((u.used / u.limit) * 100)
            return (
              <div key={u.label} className="rounded-xl border border-border/40 bg-muted/20 p-4">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="text-muted-foreground">{u.label}</span>
                  <span className="text-foreground font-medium">{u.used.toLocaleString()}{u.unit ? u.unit : ''} / {u.limit.toLocaleString()}{u.unit ?? ''}</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted/40">
                  <div className={cn('h-full rounded-full', pct >= 80 ? 'bg-red-500' : pct >= 60 ? 'bg-yellow-500' : 'bg-primary')} style={{ width: `${pct}%` }} />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">{pct}% used</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Payment method */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">Payment Method</h3>
        <div className="flex items-center gap-4 p-4 rounded-xl border border-border/40 bg-muted/20">
          <CreditCard className="w-6 h-6 text-muted-foreground" />
          <div className="flex-1">
            <p className="text-sm text-foreground">•••• •••• •••• 4242</p>
            <p className="text-xs text-muted-foreground">Expires 08/27 · Visa</p>
          </div>
          <button className="text-xs text-primary hover:underline">Update</button>
        </div>
      </div>
    </div>
  )
}

// ─────────── TEAM TAB ─────────────────────────────────────────
const ROLES = [
  { id: 'super_admin', label: 'Super Admin', description: 'Full platform access including billing and tenant management', color: 'text-red-400' },
  { id: 'admin',       label: 'Admin',       description: 'Full access to all modules within the tenant', color: 'text-orange-400' },
  { id: 'manager',     label: 'Manager',     description: 'Manage events, team, vendors and clients', color: 'text-yellow-400' },
  { id: 'coordinator', label: 'Coordinator', description: 'Execute events, update tasks and coordinate teams', color: 'text-blue-400' },
  { id: 'staff',       label: 'Staff',       description: 'View assigned tasks and events only', color: 'text-muted-foreground' },
  { id: 'finance',     label: 'Finance',     description: 'Access to financial modules only', color: 'text-emerald-400' },
  { id: 'support',     label: 'Support',     description: 'Access to support and ticketing only', color: 'text-violet-400' },
]

const TEAM_MEMBERS = [
  { id: '1', name: 'Rohan Kapoor',    email: 'rohan@sharmaevents.in',   role: 'admin',       last_active: '2 min ago',  avatar: 'RK' },
  { id: '2', name: 'Priya Venkat',    email: 'priya@sharmaevents.in',   role: 'manager',     last_active: '1 hour ago', avatar: 'PV' },
  { id: '3', name: 'Arjun Mehta',     email: 'arjun@sharmaevents.in',   role: 'coordinator', last_active: '3 hours ago',avatar: 'AM' },
  { id: '4', name: 'Sneha Iyer',      email: 'sneha@sharmaevents.in',   role: 'finance',     last_active: '1 day ago',  avatar: 'SI' },
  { id: '5', name: 'Vikram Sharma',   email: 'vikram@sharmaevents.in',  role: 'coordinator', last_active: '2 days ago', avatar: 'VS' },
]

function TeamTab() {
  const [showInvite, setShowInvite] = useState(false)

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Invite */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{TEAM_MEMBERS.length} team members · 20 seat limit</p>
        <button onClick={() => setShowInvite(!showInvite)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-foreground text-xs font-medium">
          <Plus className="w-3.5 h-3.5" /> Invite Member
        </button>
      </div>

      {showInvite && (
        <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-3">
          <h4 className="text-sm font-semibold">Invite Team Member</h4>
          <div className="flex gap-3">
            <input placeholder="Email address" className="flex-1 px-3 py-2 rounded-lg bg-muted/40 border border-border/60 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none" />
            <select className="px-3 py-2 rounded-lg bg-muted/40 border border-border/60 text-sm text-foreground/80 focus:outline-none">
              {ROLES.filter(r => r.id !== 'super_admin').map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-foreground text-xs font-medium"><Mail className="w-3.5 h-3.5" /> Send Invite</button>
            <button onClick={() => setShowInvite(false)} className="px-4 py-2 rounded-lg bg-muted/40 text-foreground/80 text-xs">Cancel</button>
          </div>
        </div>
      )}

      {/* Members list */}
      <div className="rounded-xl border border-border/40 overflow-hidden">
        {TEAM_MEMBERS.map((member, i) => (
          <div key={member.id} className={cn('flex items-center gap-4 px-4 py-3.5 hover:bg-muted/20 transition-colors', i < TEAM_MEMBERS.length - 1 && 'border-b border-border/25')}>
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0">{member.avatar}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{member.name}</p>
              <p className="text-xs text-muted-foreground">{member.email}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-muted-foreground">{member.last_active}</span>
              <select
                defaultValue={member.role}
                className="px-2 py-1 rounded bg-muted/40 border border-border/60 text-xs text-foreground/80 focus:outline-none"
              >
                {ROLES.filter(r => r.id !== 'super_admin').map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
              <button className="p-1 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Role reference */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">Role Permissions Reference</h3>
        <div className="space-y-2">
          {ROLES.map(role => (
            <div key={role.id} className="flex items-start gap-3 px-4 py-2.5 rounded-xl bg-muted/20 border border-border/25">
              <span className={cn('text-xs font-bold w-24 shrink-0 pt-0.5', role.color)}>{role.label}</span>
              <span className="text-xs text-muted-foreground">{role.description}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─────────── SECURITY TAB ─────────────────────────────────────
const SESSIONS = [
  { id: '1', device: 'MacBook Pro 16"', location: 'Mumbai, India', ip: '117.204.xxx.xxx', browser: 'Chrome 124', last_active: 'Active now', current: true },
  { id: '2', device: 'iPhone 15 Pro',   location: 'Mumbai, India', ip: '117.204.xxx.xxx', browser: 'Safari iOS', last_active: '2 hours ago', current: false },
  { id: '3', device: 'Windows Desktop', location: 'Hyderabad, India', ip: '122.167.xxx.xxx', browser: 'Edge 123', last_active: '1 day ago', current: false },
]

const AUDIT_LOG = [
  { id: '1', action: 'Login',               user: 'Rohan Kapoor',    ip: '117.204.xxx.xxx', ts: '2 min ago' },
  { id: '2', action: 'API Key Created',      user: 'Rohan Kapoor',    ip: '117.204.xxx.xxx', ts: '1 hour ago' },
  { id: '3', action: 'Team Member Invited',  user: 'Priya Venkat',    ip: '117.204.xxx.xxx', ts: '3 hours ago' },
  { id: '4', action: 'Webhook Created',      user: 'Rohan Kapoor',    ip: '117.204.xxx.xxx', ts: '1 day ago' },
  { id: '5', action: 'Role Changed',         user: 'Arjun Mehta',     ip: '122.167.xxx.xxx', ts: '2 days ago' },
  { id: '6', action: 'Password Changed',     user: 'Rohan Kapoor',    ip: '117.204.xxx.xxx', ts: '3 days ago' },
]

function SecurityTab() {
  const [twoFA, setTwoFA] = useState(false)

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Password */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-4">Change Password</h3>
        <div className="space-y-3">
          <input type="password" placeholder="Current password" className="w-full px-3 py-2.5 rounded-lg bg-muted/30 border border-border/60 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/40" />
          <input type="password" placeholder="New password" className="w-full px-3 py-2.5 rounded-lg bg-muted/30 border border-border/60 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/40" />
          <input type="password" placeholder="Confirm new password" className="w-full px-3 py-2.5 rounded-lg bg-muted/30 border border-border/60 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/40" />
          <button className="px-5 py-2.5 rounded-lg bg-primary text-foreground text-sm font-medium hover:bg-primary/90 transition-colors">Update Password</button>
        </div>
      </div>

      {/* 2FA */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-4">Two-Factor Authentication</h3>
        <div className="flex items-center justify-between p-4 rounded-xl border border-border/40 bg-muted/20">
       