'use client'
import { useState, useCallback, useEffect } from 'react'
import { useAuth } from '@/hooks/use-auth'
import {
  Plus, Search, X, TrendingUp, TrendingDown, DollarSign,
  FileText, CheckCircle2, Clock, AlertCircle, Loader2,
  Send, Eye, Trash2, Edit2, Download, Filter,
  CreditCard, Receipt, BarChart2, Calendar
} from 'lucide-react'
import { cn } from '@/lib/utils'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1'

function formatINR(n: number) {
  if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(1)}Cr`
  if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(1)}L`
  if (n >= 1_000) return `₹${(n / 1_000).toFixed(0)}K`
  return `₹${n}`
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function useApi<T>(path: string, token: string) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const refetch = useCallback(() => {
    if (!token) return
    setLoading(true)
    fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [path, token])
  useEffect(() => { refetch() }, [refetch])
  return { data, loading, refetch }
}

type Invoice = {
  id: string
  invoice_number: string
  client_name: string
  client_email?: string
  amount: number
  tax_amount: number
  total_amount: number
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'
  issue_date: string
  due_date: string
  event_id?: string
  notes?: string
}

type Expense = {
  id: string
  title: string
  amount: number
  category: string
  vendor_name?: string
  date: string
  status: 'pending' | 'approved' | 'rejected'
  receipt_url?: string
  notes?: string
}

type FinanceSummary = {
  total_revenue: number
  total_expenses: number
  net_profit: number
  outstanding_invoices: number
  overdue_invoices: number
  paid_invoices: number
}

const INVOICE_STATUSES: Record<string, { label: string; color: string; icon: any }> = {
  draft: { label: 'Draft', color: 'bg-slate-500/10 text-slate-400', icon: FileText },
  sent: { label: 'Sent', color: 'bg-blue-500/10 text-blue-400', icon: Send },
  paid: { label: 'Paid', color: 'bg-emerald-500/10 text-emerald-400', icon: CheckCircle2 },
  overdue: { label: 'Overdue', color: 'bg-red-500/10 text-red-400', icon: AlertCircle },
  cancelled: { label: 'Cancelled', color: 'bg-slate-500/10 text-slate-500', icon: X },
}

const EXPENSE_CATEGORIES = [
  'Venue', 'Catering', 'Decor', 'Entertainment', 'Photography', 'Transport',
  'Accommodation', 'Equipment', 'Marketing', 'Staff', 'Miscellaneous'
]

// ── Create Invoice Modal ────────────────────────────────────────────────────
function CreateInvoiceModal({ token, onClose, onSaved }: {
  token: string; onClose: () => void; onSaved: () => void
}) {
  const [form, setForm] = useState({
    client_name: '', client_email: '', amount: '', tax_rate: '18',
    issue_date: new Date().toISOString().slice(0, 10),
    due_date: '', notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const amount = Number(form.amount) || 0
  const tax = (amount * Number(form.tax_rate)) / 100
  const total = amount + tax

  const save = async () => {
    if (!form.client_name || !form.amount) { setError('Client name and amount are required'); return }
    setSaving(true)
    try {
      const r = await fetch(`${API}/finance/invoices`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, amount, tax_amount: tax, total_amount: total }),
      })
      if (!r.ok) throw new Error('Failed')
      onSaved(); onClose()
    } catch (e: any) { setError(e.message) } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="font-semibold">Create Invoice</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-3 max-h-[65vh] overflow-y-auto">
          {error && <p className="text-xs text-red-400 bg-red-500/10 rounded p-2">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground mb-1 block">Client Name *</label>
              <input value={form.client_name} onChange={e => set('client_name', e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground mb-1 block">Client Email</label>
              <input type="email" value={form.client_email} onChange={e => set('client_email', e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Amount (INR) *</label>
              <input type="number" value={form.amount} onChange={e => set('amount', e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" placeholder="0" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">GST Rate (%)</label>
              <select value={form.tax_rate} onChange={e => set('tax_rate', e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary">
                {['0', '5', '12', '18', '28'].map(r => <option key={r} value={r}>{r}%</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Issue Date</label>
              <input type="date" value={form.issue_date} onChange={e => set('issue_date', e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Due Date</label>
              <input type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground mb-1 block">Notes</label>
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
            </div>
          </div>
          {/* Summary */}
          <div className="bg-background border border-border rounded-lg p-3 space-y-1.5 text-sm">
            <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{formatINR(amount)}</span></div>
            <div className="flex justify-between text-muted-foreground"><span>GST ({form.tax_rate}%)</span><span>{formatINR(tax)}</span></div>
            <div className="flex justify-between font-bold border-t border-border pt-1.5"><span>Total</span><span className="text-primary">{formatINR(total)}</span></div>
          </div>
        </div>
        <div className="p-4 border-t border-border flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-accent">Cancel</button>
          <button onClick={save} disabled={saving}
            className="px-4 py-2 text-sm rounded-lg bg-primary text-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2">
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}Create Invoice
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Add Expense Modal ────────────────────────────────────────────────────────
function AddExpenseModal({ token, onClose, onSaved }: {
  token: string; onClose: () => void; onSaved: () => void
}) {
  const [form, setForm] = useState({
    title: '', amount: '', category: '', vendor_name: '',
    date: new Date().toISOString().slice(0, 10), notes: '',
  })
  const [saving, setSaving] = useState(false)
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const save = async () => {
    setSaving(true)
    try {
      await fetch(`${API}/finance/expenses`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, amount: Number(form.amount) }),
      })
      onSaved(); onClose()
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="font-semibold">Add Expense</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground mb-1 block">Title *</label>
              <input value={form.title} onChange={e => set('title', e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Amount (INR) *</label>
              <input type="number" value={form.amount} onChange={e => set('amount', e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Category</label>
              <select value={form.category} onChange={e => set('category', e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none">
                <option value="">Select</option>
                {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Vendor</label>
              <input value={form.vendor_name} onChange={e => set('vendor_name', e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Date</label>
              <input type="date" value={form.date} onChange={e => set('date', e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
          </div>
        </div>
        <div className="p-4 border-t border-border flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-accent">Cancel</button>
          <button onClick={save} disabled={saving}
            className="px-4 py-2 text-sm rounded-lg bg-primary text-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2">
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}Add Expense
          </button>
        </div>
      </div>
    </div>
  )
}

export default function FinancePage() {
  const { token } = useAuth()
  const [tab, setTab] = useState<'invoices' | 'expenses' | 'overview'>('overview')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showCreateInvoice, setShowCreateInvoice] = useState(false)
  const [showAddExpense, setShowAddExpense] = useState(false)

  const { data: invoicesData, loading: invLoading, refetch: refetchInv } =
    useApi<{ data: Invoice[] }>('/finance/invoices', token ?? '')
  const { data: expensesData, loading: expLoading, refetch: refetchExp } =
    useApi<{ data: Expense[] }>('/finance/expenses', token ?? '')

  const invoices: Invoice[] = invoicesData?.data ?? []
  const expenses: Expense[] = expensesData?.data ?? []

  const totalRevenue = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.total_amount, 0)
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0)
  const outstanding = invoices.filter(i => i.status === 'sent').reduce((s, i) => s + i.total_amount, 0)
  const overdue = invoices.filter(i => i.status === 'overdue').reduce((s, i) => s + i.total_amount, 0)
  const netProfit = totalRevenue - totalExpenses

  const filteredInvoices = invoices.filter(i => {
    const q = search.toLowerCase()
    return (!q || i.client_name.toLowerCase().includes(q) || i.invoice_number?.toLowerCase().includes(q))
      && (statusFilter === 'all' || i.status === statusFilter)
  })

  const markInvoice = async (id: string, status: string) => {
    await fetch(`${API}/finance/invoices/${id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    refetchInv()
  }

  const deleteInvoice = async (id: string) => {
    if (!confirm('Delete this invoice?')) return
    await fetch(`${API}/finance/invoices/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    refetchInv()
  }

  const deleteExpense = async (id: string) => {
    if (!confirm('Delete this expense?')) return
    await fetch(`${API}/finance/expenses/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    refetchExp()
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="h-14 flex items-center gap-3 px-5 border-b border-border shrink-0">
        <div>
          <h1 className="font-semibold text-sm">Finance</h1>
          <p className="text-[10px] text-muted-foreground">{invoices.length} invoices · {expenses.length} expenses</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {tab === 'invoices' && (
            <>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  className="h-8 pl-8 pr-3 bg-background border border-border rounded-lg text-xs w-44 focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="Search invoices..." />
              </div>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                className="h-8 px-2 bg-background border border-border rounded-lg text-xs focus:outline-none">
                <option value="all">All Status</option>
                {Object.entries(INVOICE_STATUSES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <button onClick={() => setShowCreateInvoice(true)}
                className="h-8 px-3 bg-primary text-foreground text-xs font-medium rounded-lg flex items-center gap-1.5 hover:bg-primary/90">
                <Plus className="w-3.5 h-3.5" /> New Invoice
              </button>
            </>
          )}
          {tab === 'expenses' && (
            <button onClick={() => setShowAddExpense(true)}
              className="h-8 px-3 bg-primary text-foreground text-xs font-medium rounded-lg flex items-center gap-1.5 hover:bg-primary/90">
              <Plus className="w-3.5 h-3.5" /> Add Expense
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-5 gap-px bg-border border-b border-border shrink-0">
        {[
          { label: 'Revenue', value: formatINR(totalRevenue), icon: TrendingUp, color: 'text-emerald-400', change: '+12%' },
          { label: 'Expenses', value: formatINR(totalExpenses), icon: TrendingDown, color: 'text-red-400', change: '+5%' },
          { label: 'Net Profit', value: formatINR(netProfit), icon: BarChart2, color: netProfit >= 0 ? 'text-emerald-400' : 'text-red-400' },
          { label: 'Outstanding', value: formatINR(outstanding), icon: Clock, color: 'text-amber-400' },
          { label: 'Overdue', value: formatINR(overdue), icon: AlertCircle, color: 'text-red-400' },
        ].map(card => (
          <div key={card.label} className="bg-card px-4 py-3 flex items-center gap-3">
            <card.icon className={cn('w-4 h-4', card.color)} />
            <div>
              <p className="text-xs text-muted-foreground">{card.label}</p>
              <p className="text-sm font-bold">{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border px-5 shrink-0">
        {([['overview', 'Overview'], ['invoices', 'Invoices'], ['expenses', 'Expenses']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={cn('py-3 px-4 text-xs font-medium border-b-2 transition-colors',
              tab === id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground')}>
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {tab === 'overview' && (
          <div className="p-5 grid grid-cols-2 gap-5">
            {/* Revenue vs Expenses chart placeholder */}
            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="text-sm font-semibold mb-3">Revenue vs Expenses</h3>
              <div className="space-y-3">
                {[
                  { label: 'Revenue', value: totalRevenue, color: 'bg-emerald-500', max: Math.max(totalRevenue, totalExpenses) || 1 },
                  { label: 'Expenses', value: totalExpenses, color: 'bg-red-500', max: Math.max(totalRevenue, totalExpenses) || 1 },
                  { label: 'Profit', value: Math.max(0, netProfit), color: 'bg-primary', max: Math.max(totalRevenue, totalExpenses) || 1 },
                ].map(bar => (
                  <div key={bar.label} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{bar.label}</span>
                      <span className="font-medium">{formatINR(bar.value)}</span>
                    </div>
                    <div className="h-2 bg-border rounded-full overflow-hidden">
                      <div className={cn('h-full rounded-full', bar.color)} style={{ width: `${Math.min(100, (bar.value / bar.max) * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Invoice breakdown */}
            <div className="bg-card border border-border rounded-xl p-4">
              <h3 className="text-sm font-semibold mb-3">Invoice Breakdown</h3>
              <div className="space-y-2.5">
                {Object.entries(INVOICE_STATUSES).map(([status, cfg]) => {
                  const count = invoices.filter(i => i.status === status).length
                  const value = invoices.filter(i => i.status === status).reduce((s, i) => s + i.total_amount, 0)
                  return (
                    <div key={status} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={cn('text-xs px-1.5 py-0.5 rounded', cfg.color)}>{cfg.label}</span>
                        <span className="text-xs text-muted-foreground">{count} invoices</span>
                      </div>
                      <span className="text-xs font-medium">{formatINR(value)}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Recent invoices */}
            <div className="bg-card border border-border rounded-xl p-4 col-span-2">
              <h3 className="text-sm font-semibold mb-3">Recent Invoices</h3>
              <div className="space-y-2">
                {invoices.slice(0, 5).map(inv => {
                  const cfg = INVOICE_STATUSES[inv.status]
                  return (
                    <div key={inv.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{inv.client_name}</p>
                        <p className="text-xs text-muted-foreground">{inv.invoice_number} · Due {fmtDate(inv.due_date)}</p>
                      </div>
                      <span className={cn('text-xs px-1.5 py-0.5 rounded', cfg.color)}>{cfg.label}</span>
                      <span className="text-sm font-semibold">{formatINR(inv.total_amount)}</span>
                    </div>
                  )
                })}
                {invoices.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No invoices yet</p>}
              </div>
            </div>
          </div>
        )}

        {tab === 'invoices' && (
          <table className="w-full">
            <thead className="sticky top-0 bg-card border-b border-border">
              <tr>
                {['Invoice #', 'Client', 'Amount', 'Tax', 'Total', 'Issue Date', 'Due Date', 'Status', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.map(inv => {
                const cfg = INVOICE_STATUSES[inv.status]
                return (
                  <tr key={inv.id} className="border-b border-border hover:bg-accent/30">
                    <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{inv.invoice_number ?? '—'}</td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium">{inv.client_name}</p>
                      {inv.client_email && <p className="text-xs text-muted-foreground">{inv.client_email}</p>}
                    </td>
                    <td className="px-4 py-3 text-xs">{formatINR(inv.amount)}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{formatINR(inv.tax_amount)}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-primary">{formatINR(inv.total_amount)}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{fmtDate(inv.issue_date)}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{inv.due_date ? fmtDate(inv.due_date) : '—'}</td>
                    <td className="px-4 py-3">
                      <span className={cn('text-xs px-1.5 py-0.5 rounded', cfg.color)}>{cfg.label}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {inv.status === 'draft' && (
                          <button onClick={() => markInvoice(inv.id, 'sent')} title="Send"
                            className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-blue-400">
                            <Send className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {(inv.status === 'sent' || inv.status === 'overdue') && (
                          <button onClick={() => markInvoice(inv.id, 'paid')} title="Mark Paid"
                            className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-emerald-400">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button onClick={() => deleteInvoice(inv.id)} title="Delete"
                          className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-red-400">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filteredInvoices.length === 0 && (
                <tr><td colSpan={9} className="text-center py-12 text-sm text-muted-foreground">No invoices found</td></tr>
              )}
            </tbody>
          </table>
        )}

        {tab === 'expenses' && (
          <table className="w-full">
            <thead className="sticky top-0 bg-card border-b border-border">
              <tr>
                {['Title', 'Category', 'Vendor', 'Amount', 'Date', 'Status', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {expenses.map(exp => {
                const statusColor: Record<string, string> = {
                  pending: 'bg-amber-500/10 text-amber-400',
                  approved: 'bg-emerald-500/10 text-emerald-400',
                  rejected: 'bg-red-500/10 text-red-400',
                }
                return (
                  <tr key={exp.id} className="border-b border-border hover:bg-accent/30">
                    <td className="px-4 py-3 text-sm font-medium">{exp.title}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{exp.category ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{exp.vendor_name ?? '—'}</td>
                    <td className="px-4 py-3 text-xs font-semibold">{formatINR(exp.amount)}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{fmtDate(exp.date)}</td>
                    <td className="px-4 py-3">
                      <span className={cn('text-xs px-1.5 py-0.5 rounded capitalize', statusColor[exp.status])}>{exp.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => deleteExpense(exp.id)}
                        className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-red-400">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                )
              })}
              {expenses.length === 0 && (
                <tr><td colSpan={7} className="text-center py-12 text-sm text-muted-foreground">No expenses yet</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {showCreateInvoice && <CreateInvoiceModal token={token ?? ''} onClose={() => setShowCreateInvoice(false)} onSaved={refetchInv} />}
      {showAddExpense && <AddExpenseModal token={token ?? ''} onClose={() => setShowAddExpense(false)} onSaved={refetchExp} />}
    </div>
  )
}
