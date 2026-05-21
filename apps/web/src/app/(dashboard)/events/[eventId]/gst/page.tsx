'use client'
import { use, useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTenant } from '@/hooks/use-tenant'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import {
  Receipt, Settings, FileText, TrendingUp, BadgePercent,
  PlusCircle, ChevronDown, ChevronRight, CheckCircle2,
  Clock, AlertTriangle, XCircle, IndianRupee, BarChart3,
  Download, Send, Edit2, X, Check, RefreshCcw, Shield,
  CreditCard, Wallet, BookOpen, Calculator, FileCog,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface GstSettings {
  gstin?: string; legal_name?: string; trade_name?: string
  address_line1?: string; city?: string; state?: string
  state_code?: string; pincode?: string
  default_gst_type?: string
  e_invoicing_enabled?: boolean; auto_calculate_gst?: boolean
  invoice_prefix?: string
}

interface TaxRate {
  id: string; name: string; description?: string
  hsn_sac_code?: string; is_service: boolean
  cgst_rate: number; sgst_rate: number; igst_rate: number
  total_rate: number; is_exempt: boolean; is_default: boolean; is_active: boolean
}

interface TaxInvoice {
  id: string; invoice_number: string; invoice_type: string
  invoice_date: string; buyer_name: string; buyer_gstin?: string
  supply_type: string; status: string; payment_status: string
  taxable_amount: number; total_tax: number; grand_total: number
  cgst_amount: number; sgst_amount: number; igst_amount: number
}

interface GstFiling {
  id: string; return_type: string; tax_period: string
  frequency: string; status: string; due_date?: string
  filing_date?: string; arn?: string
  total_outward_supplies?: number; total_igst_payable?: number
  total_cgst_payable?: number; total_sgst_payable?: number
}

interface Dashboard {
  summary: {
    taxable_revenue: number; total_gst: number; net_gst_payable: number
    collected: number; outstanding: number; invoice_count: number
    cgst_collected: number; sgst_collected: number; igst_collected: number
  }
  itc: { igst: number; cgst: number; sgst: number; cess: number }
  pending_filings: GstFiling[]
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function gstFetch(path: string, options?: RequestInit) {
  const supabase  = getSupabaseBrowserClient()
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token}`,
      ...(options?.headers ?? {}),
    },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message ?? 'Request failed')
  }
  if (res.status === 204) return null
  return res.json()
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

function useApiBase(tenant: string | undefined | null) {
  return tenant ? `/api/${tenant}/gst` : null
}

function useGstDashboard(tenant: string | null | undefined, eventId: string) {
  const base = useApiBase(tenant)
  return useQuery<Dashboard>({
    queryKey: ['gst-dashboard', tenant, eventId],
    queryFn:  () => gstFetch(`${base}/dashboard?event_id=${eventId}`),
    enabled:  !!base,
    refetchInterval: 60_000,
  })
}

function useGstSettings(tenant: string | null | undefined) {
  const base = useApiBase(tenant)
  return useQuery<GstSettings | null>({
    queryKey: ['gst-settings', tenant],
    queryFn:  () => gstFetch(`${base}/settings`),
    enabled:  !!base,
  })
}

function useGstRates(tenant: string | null | undefined) {
  const base = useApiBase(tenant)
  return useQuery<TaxRate[]>({
    queryKey: ['gst-rates', tenant],
    queryFn:  () => gstFetch(`${base}/rates`),
    enabled:  !!base,
    select:   d => d ?? [],
  })
}

function useGstInvoices(tenant: string | null | undefined, eventId: string, status?: string) {
  const base = useApiBase(tenant)
  return useQuery<{ data: TaxInvoice[]; total: number }>({
    queryKey: ['gst-invoices', tenant, eventId, status],
    queryFn:  () => gstFetch(`${base}/invoices?event_id=${eventId}${status ? `&status=${status}` : ''}`),
    enabled:  !!base,
  })
}

function useGstFilings(tenant: string | null | undefined) {
  const base = useApiBase(tenant)
  return useQuery<GstFiling[]>({
    queryKey: ['gst-filings', tenant],
    queryFn:  () => gstFetch(`${base}/filings`),
    enabled:  !!base,
    select:   d => d ?? [],
  })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

const STATUS_COLORS: Record<string, string> = {
  draft:     'text-slate-400 bg-slate-500/10',
  finalized: 'text-blue-400 bg-blue-500/10',
  sent:      'text-amber-400 bg-amber-500/10',
  paid:      'text-green-400 bg-green-500/10',
  cancelled: 'text-red-400 bg-red-500/10',
  void:      'text-slate-500 bg-slate-700/30',
  pending:   'text-amber-400 bg-amber-500/10',
  filed:     'text-green-400 bg-green-500/10',
  in_progress: 'text-blue-400 bg-blue-500/10',
  nil_filed: 'text-slate-400 bg-slate-500/10',
  error:     'text-red-400 bg-red-500/10',
}

const RETURN_DUE: Record<string, string> = {
  'GSTR-1':  '11th of following month',
  'GSTR-3B': '20th of following month',
  'GSTR-9':  '31 Dec (annual)',
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon: Icon, color }:
  { label: string; value: string; sub?: string; icon: React.ElementType; color: string }) {
  return (
    <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs text-slate-400">{label}</p>
        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', color)}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="text-xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  )
}

function GstSummaryPanel({ dashboard }: { dashboard: Dashboard }) {
  const s = dashboard.summary
  const itc = dashboard.itc
  const total_itc = itc.igst + itc.cgst + itc.sgst + itc.cess

  return (
    <div className="space-y-4">
      {/* Top stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Taxable Revenue" value={fmt(s.taxable_revenue)} sub={`${s.invoice_count} invoices`} icon={IndianRupee} color="bg-violet-500/10 text-violet-400" />
        <StatCard label="GST Collected" value={fmt(s.total_gst)} sub={`CGST ${fmt(s.cgst_collected)} + SGST ${fmt(s.sgst_collected)}`} icon={Receipt} color="bg-blue-500/10 text-blue-400" />
        <StatCard label="ITC Available" value={fmt(total_itc)} sub="Input Tax Credit" icon={CreditCard} color="bg-amber-500/10 text-amber-400" />
        <StatCard label="Net GST Payable" value={fmt(s.net_gst_payable)} sub="After ITC set-off" icon={Wallet} color="bg-green-500/10 text-green-400" />
      </div>

      {/* GST breakdown */}
      <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4">
        <p className="text-sm font-medium text-slate-300 mb-3">GST Breakdown</p>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'CGST', value: s.cgst_collected, color: 'bg-blue-500' },
            { label: 'SGST', value: s.sgst_collected, color: 'bg-violet-500' },
            { label: 'IGST', value: s.igst_collected, color: 'bg-amber-500' },
          ].map(item => (
            <div key={item.label} className="text-center">
              <p className="text-xs text-slate-500 mb-1">{item.label}</p>
              <p className="text-base font-semibold text-white">{fmt(item.value)}</p>
              <div className="h-1 rounded-full mt-2" style={{
                background: `linear-gradient(to right, ${item.color}60, ${item.color})`,
                width: s.total_gst > 0 ? `${Math.round(item.value / s.total_gst * 100)}%` : '0%',
                margin: '0 auto',
              }} />
            </div>
          ))}
        </div>
      </div>

      {/* Pending filings */}
      {dashboard.pending_filings.length > 0 && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <p className="text-sm font-medium text-amber-300">Pending GST Returns</p>
          </div>
          <div className="space-y-2">
            {dashboard.pending_filings.map(f => (
              <div key={f.id} className="flex items-center justify-between">
                <div>
                  <span className="text-sm text-white">{f.return_type}</span>
                  <span className="text-xs text-slate-400 ml-2">{f.tax_period}</span>
                </div>
                {f.due_date && (
                  <span className="text-xs text-amber-400">Due {new Date(f.due_date).toLocaleDateString('en-IN')}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Settings Form ────────────────────────────────────────────────────────────

function SettingsTab({ tenant }: { tenant: string }) {
  const qc = useQueryClient()
  const { data: settings, isLoading } = useGstSettings(tenant)
  const [form, setForm] = useState<GstSettings>({})
  const [saved, setSaved] = useState(false)

  useEffect(() => { if (settings) setForm(settings) }, [settings])

  const update = useMutation({
    mutationFn: (data: GstSettings) => gstFetch(`/api/${tenant}/gst/settings`, {
      method: 'PATCH', body: JSON.stringify(data),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gst-settings', tenant] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    },
  })

  if (isLoading) return <div className="text-slate-500 text-sm py-8 text-center">Loading settings…</div>

  const F = ({ label, name, placeholder, maxLength }: { label: string; name: keyof GstSettings; placeholder?: string; maxLength?: number }) => (
    <div>
      <label className="block text-xs text-slate-400 mb-1">{label}</label>
      <input
        value={(form[name] as string) ?? ''}
        onChange={e => setForm(p => ({ ...p, [name]: e.target.value }))}
        placeholder={placeholder}
        maxLength={maxLength}
        className="w-full bg-white/[0.04] border border-white/[0.1] rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-violet-500/50"
      />
    </div>
  )

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-white mb-4">GST Registration</h3>
        <div className="grid grid-cols-2 gap-4">
          <F label="GSTIN" name="gstin" placeholder="22AAAAA0000A1Z5" maxLength={15} />
          <F label="PAN (auto from GSTIN)" name="trade_name" placeholder="AAAAA0000A" />
          <F label="Legal Name (as per GST portal)" name="legal_name" placeholder="ABC Events Pvt Ltd" />
          <F label="Trade Name" name="trade_name" placeholder="ABC Events" />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-white mb-4">Registered Address</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2"><F label="Address Line 1" name="address_line1" /></div>
          <F label="City" name="city" />
          <F label="State" name="state" placeholder="Karnataka" />
          <F label="State Code" name="state_code" placeholder="29" maxLength={2} />
          <F label="Pincode" name="pincode" maxLength={6} />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-white mb-4">Invoice Settings</h3>
        <div className="grid grid-cols-2 gap-4">
          <F label="Invoice Prefix" name="invoice_prefix" placeholder="INV" />
          <div>
            <label className="block text-xs text-slate-400 mb-1">GST Registration Type</label>
            <select
              value={form.default_gst_type ?? 'regular'}
              onChange={e => setForm(p => ({ ...p, default_gst_type: e.target.value }))}
              className="w-full bg-white/[0.04] border border-white/[0.1] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/50"
            >
              <option value="regular">Regular</option>
              <option value="composition">Composition</option>
              <option value="exempt">Exempt</option>
              <option value="unregistered">Unregistered</option>
            </select>
          </div>
        </div>
        <div className="flex items-center gap-6 mt-4">
          {[
            { key: 'e_invoicing_enabled', label: 'E-Invoicing (IRN)' },
            { key: 'auto_calculate_gst',  label: 'Auto-calculate GST' },
          ].map(toggle => (
            <label key={toggle.key} className="flex items-center gap-2 cursor-pointer">
              <div
                onClick={() => setForm(p => ({ ...p, [toggle.key]: !(p as Record<string, unknown>)[toggle.key] }))}
                className={cn('w-9 h-5 rounded-full transition-colors relative',
                  (form as Record<string, unknown>)[toggle.key] ? 'bg-violet-600' : 'bg-white/10')}
              >
                <div className={cn('absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform',
                  (form as Record<string, unknown>)[toggle.key] ? 'left-[18px]' : 'left-0.5')} />
              </div>
              <span className="text-sm text-slate-300">{toggle.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => update.mutate(form)}
          disabled={update.isPending}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 rounded-lg text-sm font-medium text-white transition-colors"
        >
          {update.isPending ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          Save Settings
        </button>
        {saved && <span className="text-xs text-green-400 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Saved</span>}
        {update.isError && <span className="text-xs text-red-400">Failed to save</span>}
      </div>
    </div>
  )
}

// ─── Tax Rates Tab ────────────────────────────────────────────────────────────

function TaxRatesTab({ tenant }: { tenant: string }) {
  const qc = useQueryClient()
  const { data: rates = [], isLoading } = useGstRates(tenant)
  const [adding, setAdding] = useState(false)
  const [newRate, setNewRate] = useState({ name: '', cgst_rate: 9, sgst_rate: 9, igst_rate: 0, hsn_sac_code: '', is_default: false })

  const create = useMutation({
    mutationFn: (data: typeof newRate) => gstFetch(`/api/${tenant}/gst/rates`, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['gst-rates', tenant] }); setAdding(false) },
  })

  const del = useMutation({
    mutationFn: (id: string) => gstFetch(`/api/${tenant}/gst/rates/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gst-rates', tenant] }),
  })

  const DEFAULT_RATES = [
    { name: 'GST 5%',  cgst_rate: 2.5, sgst_rate: 2.5, igst_rate: 5,  total_rate: 5,  label: 'Food, small events' },
    { name: 'GST 12%', cgst_rate: 6,   sgst_rate: 6,   igst_rate: 12, total_rate: 12, label: 'Event tickets < ₹7500' },
    { name: 'GST 18%', cgst_rate: 9,   sgst_rate: 9,   igst_rate: 18, total_rate: 18, label: 'Event management services' },
    { name: 'GST 28%', cgst_rate: 14,  sgst_rate: 14,  igst_rate: 28, total_rate: 28, label: 'Entertainment, luxury' },
    { name: 'Exempt',  cgst_rate: 0,   sgst_rate: 0,   igst_rate: 0,  total_rate: 0,  label: 'Nil-rated / exempt items' },
  ]

  return (
    <div className="space-y-4">
      {/* Existing rates */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">{rates.length} tax rate{rates.length !== 1 ? 's' : ''} configured</p>
        <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600/20 hover:bg-violet-600/30 rounded-lg text-sm text-violet-300 transition-colors">
          <PlusCircle className="w-3.5 h-3.5" /> Add Rate
        </button>
      </div>

      {isLoading && <div className="text-slate-500 text-sm py-4">Loading…</div>}

      {rates.length === 0 && !isLoading && (
        <div>
          <p className="text-sm text-slate-400 mb-3">No rates yet. Add from common Indian GST slabs:</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {DEFAULT_RATES.map(r => (
              <button key={r.name}
                onClick={() => create.mutate({ name: r.name, cgst_rate: r.cgst_rate, sgst_rate: r.sgst_rate, igst_rate: r.igst_rate, hsn_sac_code: '', is_default: r.name === 'GST 18%' })}
                className="p-3 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] rounded-lg text-left transition-colors"
              >
                <p className="text-sm font-medium text-white">{r.name}</p>
                <p className="text-xs text-slate-500">{r.label}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {rates.map(rate => (
        <div key={rate.id} className="flex items-center justify-between p-3 bg-white/[0.03] border border-white/[0.07] rounded-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
              <span className="text-xs font-bold text-violet-400">{rate.total_rate}%</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-white">{rate.name}</span>
                {rate.is_default && <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-400">Default</span>}
                {rate.is_exempt && <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-500/20 text-slate-400">Exempt</span>}
              </div>
              <p className="text-xs text-slate-500">
                CGST {rate.cgst_rate}% + SGST {rate.sgst_rate}%
                {rate.igst_rate > 0 && ` / IGST ${rate.igst_rate}%`}
                {rate.hsn_sac_code && ` · HSN/SAC ${rate.hsn_sac_code}`}
              </p>
            </div>
          </div>
          <button onClick={() => del.mutate(rate.id)} className="w-7 h-7 rounded-lg hover:bg-red-500/10 flex items-center justify-center text-slate-500 hover:text-red-400 transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}

      {/* Add rate form */}
      {adding && (
        <div className="p-4 bg-white/[0.04] border border-violet-500/20 rounded-xl space-y-3">
          <p className="text-sm font-medium text-white">New Tax Rate</p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Rate Name', key: 'name', placeholder: 'GST 18%' },
              { label: 'HSN/SAC Code', key: 'hsn_sac_code', placeholder: '998596' },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-xs text-slate-400 mb-1">{f.label}</label>
                <input value={(newRate as Record<string, unknown>)[f.key] as string ?? ''}
                  onChange={e => setNewRate(p => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  className="w-full bg-white/[0.04] border border-white/[0.1] rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-violet-500/50"
                />
              </div>
            ))}
            {['cgst_rate', 'sgst_rate', 'igst_rate'].map(k => (
              <div key={k}>
                <label className="block text-xs text-slate-400 mb-1">{k.replace('_rate', '').toUpperCase()} %</label>
                <input type="number" min={0} max={28} step={0.5}
                  value={(newRate as Record<string, unknown>)[k] as number ?? 0}
                  onChange={e => setNewRate(p => ({ ...p, [k]: Number(e.target.value) }))}
                  className="w-full bg-white/[0.04] border border-white/[0.1] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/50"
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={() => create.mutate(newRate)} disabled={create.isPending || !newRate.name}
              className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 rounded-lg text-sm text-white transition-colors">
              {create.isPending ? 'Saving…' : 'Save Rate'}
            </button>
            <button onClick={() => setAdding(false)} className="px-4 py-2 bg-white/[0.05] hover:bg-white/[0.08] rounded-lg text-sm text-slate-300">Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Invoices Tab ─────────────────────────────────────────────────────────────

function InvoicesTab({ tenant, eventId }: { tenant: string; eventId: string }) {
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<string>('')
  const { data, isLoading } = useGstInvoices(tenant, eventId, statusFilter || undefined)
  const invoices = data?.data ?? []

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      gstFetch(`/api/${tenant}/gst/invoices/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gst-invoices'] }),
  })

  const FILTERS = ['', 'draft', 'finalized', 'sent', 'paid', 'cancelled']

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1.5">
          {FILTERS.map(f => (
            <button key={f}
              onClick={() => setStatusFilter(f)}
              className={cn('px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors',
                statusFilter === f ? 'bg-violet-600 text-white' : 'bg-white/[0.04] text-slate-400 hover:bg-white/[0.07]')}
            >
              {f || 'All'}
            </button>
          ))}
        </div>
        <span className="text-xs text-slate-500">{data?.total ?? 0} total</span>
      </div>

      {isLoading && <div className="text-slate-500 text-sm py-8 text-center">Loading invoices…</div>}

      {!isLoading && invoices.length === 0 && (
        <div className="py-12 text-center">
          <Receipt className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">No invoices found</p>
          <p className="text-slate-600 text-xs mt-1">Create invoices from the event's payments or manually below</p>
        </div>
      )}

      {invoices.map(inv => (
        <div key={inv.id} className="flex items-center justify-between p-4 bg-white/[0.03] border border-white/[0.07] rounded-xl hover:bg-white/[0.04] transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Receipt className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-white">{inv.invoice_number}</span>
                <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full capitalize', STATUS_COLORS[inv.status] ?? 'text-slate-400 bg-slate-500/10')}>
                  {inv.status}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {inv.buyer_name} · {new Date(inv.invoice_date).toLocaleDateString('en-IN')} · {inv.supply_type}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-white">{fmt(Number(inv.grand_total))}</p>
            <p className="text-xs text-slate-500">Tax: {fmt(Number(inv.total_tax))}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Filings Tab ──────────────────────────────────────────────────────────────

function FilingsTab({ tenant }: { tenant: string }) {
  const qc = useQueryClient()
  const { data: filings = [], isLoading } = useGstFilings(tenant)
  const [adding, setAdding] = useState(false)
  const [newFiling, setNewFiling] = useState({ return_type: 'GSTR-3B', tax_period: '', frequency: 'monthly', due_date: '' })

  const create = useMutation({
    mutationFn: (data: typeof newFiling) => gstFetch(`/api/${tenant}/gst/filings`, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['gst-filings', tenant] }); setAdding(false) },
  })

  const update = useMutation({
    mutationFn: ({ id, status, arn }: { id: string; status: string; arn?: string }) =>
      gstFetch(`/api/${tenant}/gst/filings/${id}`, { method: 'PATCH', body: JSON.stringify({ status, arn }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gst-filings', tenant] }),
  })

  const RETURN_TYPES = ['GSTR-1', 'GSTR-3B', 'GSTR-9', 'GSTR-9C', 'IFF', 'CMP-08']

  const FilingIcon = ({ status }: { status: string }) => {
    if (status === 'filed' || status === 'nil_filed') return <CheckCircle2 className="w-4 h-4 text-green-400" />
    if (status === 'error') return <XCircle className="w-4 h-4 text-red-400" />
    if (status === 'in_progress') return <RefreshCcw className="w-4 h-4 text-blue-400 animate-spin" />
    return <Clock className="w-4 h-4 text-amber-400" />
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">{filings.length} filing record{filings.length !== 1 ? 's' : ''}</p>
        <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600/20 hover:bg-violet-600/30 rounded-lg text-sm text-violet-300 transition-colors">
          <PlusCircle className="w-3.5 h-3.5" /> Add Filing
        </button>
      </div>

      {isLoading && <div className="text-slate-500 text-sm py-4">Loading…</div>}

      {/* Info bar */}
      <div className="bg-blue-500/5 border border-blue-500/15 rounded-xl p-3">
        <p className="text-xs text-blue-300/80 font-medium mb-1.5 flex items-center gap-1.5"><BookOpen className="w-3.5 h-3.5" /> Key Filing Deadlines</p>
        <div className="grid grid-cols-3 gap-2">
          {Object.entries(RETURN_DUE).map(([ret, due]) => (
            <div key={ret}>
              <span className="text-xs text-slate-300 font-medium">{ret}:</span>
              <span className="text-xs text-slate-500 ml-1">{due}</span>
            </div>
          ))}
        </div>
      </div>

      {filings.map(filing => (
        <div key={filing.id} className="flex items-start justify-between p-4 bg-white/[0.03] border border-white/[0.07] rounded-xl">
          <div className="flex items-start gap-3">
            <div className="mt-0.5"><FilingIcon status={filing.status} /></div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-white">{filing.return_type}</span>
                <span className="text-xs text-slate-400">{filing.tax_period}</span>
                <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full capitalize', STATUS_COLORS[filing.status] ?? '')}>
                  {filing.status.replace('_', ' ')}
                </span>
              </div>
              {filing.arn && <p className="text-xs text-green-400 mt-0.5">ARN: {filing.arn}</p>}
              {filing.due_date && (
                <p className="text-xs text-slate-500 mt-0.5">Due: {new Date(filing.due_date).toLocaleDateString('en-IN')}</p>
              )}
            </div>
          </div>

          {/* Quick status update */}
          {(filing.status === 'pending' || filing.status === 'in_progress') && (
            <button
              onClick={() => update.mutate({ id: filing.id, status: 'filed' })}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-green-500/10 hover:bg-green-500/20 rounded-lg text-xs text-green-400 transition-colors"
            >
              <CheckCircle2 className="w-3 h-3" /> Mark Filed
            </button>
          )}
        </div>
      ))}

      {/* Add filing form */}
      {adding && (
        <div className="p-4 bg-white/[0.04] border border-violet-500/20 rounded-xl space-y-3">
          <p className="text-sm font-medium text-white">New Filing Record</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Return Type</label>
              <select value={newFiling.return_type}
                onChange={e => setNewFiling(p => ({ ...p, return_type: e.target.value }))}
                className="w-full bg-white/[0.04] border border-white/[0.1] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/50">
                {RETURN_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Tax Period (MM-YYYY)</label>
              <input value={newFiling.tax_period}
                onChange={e => setNewFiling(p => ({ ...p, tax_period: e.target.value }))}
                placeholder="04-2026"
                className="w-full bg-white/[0.04] border border-white/[0.1] rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-violet-500/50"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Due Date</label>
              <input type="date" value={newFiling.due_date}
                onChange={e => setNewFiling(p => ({ ...p, due_date: e.target.value }))}
                className="w-full bg-white/[0.04] border border-white/[0.1] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/50"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Frequency</label>
              <select value={newFiling.frequency}
                onChange={e => setNewFiling(p => ({ ...p, frequency: e.target.value }))}
                className="w-full bg-white/[0.04] border border-white/[0.1] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/50">
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="annual">Annual</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => create.mutate(newFiling)} disabled={create.isPending || !newFiling.tax_period}
              className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 rounded-lg text-sm text-white transition-colors">
              {create.isPending ? 'Creating…' : 'Create Record'}
            </button>
            <button onClick={() => setAdding(false)} className="px-4 py-2 bg-white/[0.05] hover:bg-white/[0.08] rounded-lg text-sm text-slate-300">Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'overview',  label: 'Overview',   icon: BarChart3   },
  { id: 'invoices',  label: 'Invoices',   icon: FileText    },
  { id: 'rates',     label: 'Tax Rates',  icon: BadgePercent },
  { id: 'filings',   label: 'Filings',    icon: FileCog     },
  { id: 'settings',  label: 'Settings',   icon: Settings    },
]

export default function GstPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params)
  const { tenant } = useTenant()
  const [activeTab, setActiveTab] = useState('overview')

  const { data: dashboard, isLoading: dashLoading } = useGstDashboard(tenant, eventId)
  const { data: settings } = useGstSettings(tenant)

  const isSetup = !!settings?.gstin

  if (!tenant) return null

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-violet-500/15 flex items-center justify-center">
              <Receipt className="w-4 h-4 text-violet-400" />
            </div>
            <h1 className="text-xl font-bold text-white">GST & Tax Compliance</h1>
          </div>
          <p className="text-sm text-slate-400 ml-10">
            Manage GST invoices, tax rates, input tax credits and filing schedules
          </p>
        </div>
        {isSetup && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 border border-green-500/20 rounded-lg">
            <Shield className="w-3.5 h-3.5 text-green-400" />
            <span className="text-xs text-green-300">{settings.gstin}</span>
          </div>
        )}
      </div>

      {/* Setup banner */}
      {!isSetup && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-300">GST Setup Required</p>
            <p className="text-xs text-amber-400/70 mt-0.5">
              Configure your GSTIN and business details in Settings to start generating tax-compliant invoices.
            </p>
            <button onClick={() => setActiveTab('settings')} className="mt-2 text-xs text-amber-400 hover:text-amber-300 underline">
              Go to Settings →
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/[0.06] pb-0">
        {TABS.map(tab => {
          const Icon = tab.icon
          return (
            <button key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                activeTab === tab.id
                  ? 'border-violet-500 text-violet-400'
                  : 'border-transparent text-slate-500 hover:text-slate-300',
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'overview' && (
          dashLoading
            ? <div className="py-8 text-center text-slate-500 text-sm">Loading dashboard…</div>
            : dashboard
              ? <GstSummaryPanel dashboard={dashboard} />
              : <div className="py-8 text-center text-slate-500 text-sm">No data yet</div>
        )}

        {activeTab === 'invoices'  && <InvoicesTab tenant={tenant} eventId={eventId} />}
        {activeTab === 'rates'     && <TaxRatesTab tenant={tenant} />}
        {activeTab === 'filings'   && <FilingsTab  tenant={tenant} />}
        {activeTab === 'settings'  && <SettingsTab tenant={tenant} />}
      </div>
    </div>
  )
}
