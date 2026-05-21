'use client'

import { use, useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/hooks/use-auth'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { formatCurrency, cn } from '@/lib/utils'
import {
  ArrowLeft, Plus, Wallet, TrendingUp, TrendingDown,
  DollarSign, PieChart, BarChart3, Edit2, Trash2,
  CheckCircle2, AlertCircle, Clock, RefreshCw,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────────

type BudgetCategory = {
  id: string
  name: string
  allocated: number
  spent: number
  paid: number
  color: string
}

type BudgetItem = {
  id: string
  category_id: string
  category_name: string
  description: string
  estimated_amount: number
  actual_amount: number | null
  status: 'pending' | 'approved' | 'paid' | 'overbudget'
  vendor_name: string | null
  notes: string | null
  created_at: string
}

const STATUS_CONFIG = {
  pending:    { label: 'Pending',    color: 'text-yellow-600 bg-yellow-50 border-yellow-200' },
  approved:   { label: 'Approved',   color: 'text-blue-600 bg-blue-50 border-blue-200' },
  paid:       { label: 'Paid',       color: 'text-green-600 bg-green-50 border-green-200' },
  overbudget: { label: 'Over Budget',color: 'text-red-600 bg-red-50 border-red-200' },
}

const CATEGORY_COLORS = [
  '#7c3aed', '#2563eb', '#059669', '#d97706',
  '#dc2626', '#db2777', '#0891b2', '#65a30d',
]

// ── Helpers ────────────────────────────────────────────────────────────────────

function ProgressBar({ value, max, color = '#7c3aed' }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  const isOver = value > max
  return (
    <div className="w-full bg-muted rounded-full h-2">
      <div
        className="h-2 rounded-full transition-all"
        style={{ width: `${pct}%`, backgroundColor: isOver ? '#dc2626' : color }}
      />
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function EventBudgetPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params)
  const { profile } = useAuth()
  const router = useRouter()
  const supabase = getSupabaseBrowserClient()

  const [totalBudget, setTotalBudget] = useState(0)
  const [categories, setCategories] = useState<BudgetCategory[]>([])
  const [items, setItems] = useState<BudgetItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'items'>('overview')

  // Modal state
  const [showAddItem, setShowAddItem] = useState(false)
  const [newItem, setNewItem] = useState({
    category_id: '',
    description: '',
    estimated_amount: '',
    vendor_name: '',
    notes: '',
  })

  // ── Load data ──────────────────────────────────────────────────────────────

  const loadBudget = useCallback(async () => {
    if (!profile?.tenant_id) return
    setLoading(true)
    try {
      // Load event budget total
      const { data: event } = await supabase
        .from('events')
        .select('budget')
        .eq('id', eventId)
        .single()
      if (event?.budget) setTotalBudget(event.budget)

      // Load budget items
      const { data: budgetItems } = await supabase
        .from('event_budget_items')
        .select('*')
        .eq('event_id', eventId)
        .eq('tenant_id', profile.tenant_id)
        .order('category_name')

      if (budgetItems) {
        setItems(budgetItems)

        // Build categories from items
        const catMap = new Map<string, BudgetCategory>()
        budgetItems.forEach((item, idx) => {
          const key = item.category_name || 'Uncategorized'
          if (!catMap.has(key)) {
            catMap.set(key, {
              id: item.category_id || key,
              name: key,
              allocated: 0,
              spent: 0,
              paid: 0,
              color: CATEGORY_COLORS[catMap.size % CATEGORY_COLORS.length],
            })
          }
          const cat = catMap.get(key)!
          cat.allocated += item.estimated_amount || 0
          cat.spent += item.actual_amount || item.estimated_amount || 0
          if (item.status === 'paid') cat.paid += item.actual_amount || item.estimated_amount || 0
        })
        setCategories(Array.from(catMap.values()))
      }
    } finally {
      setLoading(false)
    }
  }, [eventId, profile?.tenant_id, supabase])

  useEffect(() => { loadBudget() }, [loadBudget])

  // ── Derived totals ─────────────────────────────────────────────────────────

  const totalAllocated = categories.reduce((s, c) => s + c.allocated, 0)
  const totalSpent     = categories.reduce((s, c) => s + c.spent, 0)
  const totalPaid      = categories.reduce((s, c) => s + c.paid, 0)
  const remaining      = totalBudget - totalSpent
  const overBudget     = totalSpent > totalBudget

  // ── Add item ───────────────────────────────────────────────────────────────

  const handleAddItem = async () => {
    if (!newItem.description || !newItem.estimated_amount) return
    await supabase.from('event_budget_items').insert({
      event_id: eventId,
      tenant_id: profile!.tenant_id,
      category_id: newItem.category_id || 'general',
      category_name: newItem.category_id || 'General',
      description: newItem.description,
      estimated_amount: parseFloat(newItem.estimated_amount),
      vendor_name: newItem.vendor_name || null,
      notes: newItem.notes || null,
      status: 'pending',
    })
    setShowAddItem(false)
    setNewItem({ category_id: '', description: '', estimated_amount: '', vendor_name: '', notes: '' })
    loadBudget()
  }

  const handleDeleteItem = async (id: string) => {
    await supabase.from('event_budget_items').delete().eq('id', id)
    loadBudget()
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-24 bg-card border border-border rounded-xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Back */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href={`/events/${eventId}`} className="hover:text-foreground flex items-center gap-1.5 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Event Overview
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">Budget</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Event Budget</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Track allocated budget, actuals, and payments</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadBudget}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card hover:bg-muted text-sm transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button
            onClick={() => setShowAddItem(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Item
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Budget',  value: totalBudget,     icon: Wallet,       color: 'text-violet-600 bg-violet-50' },
          { label: 'Allocated',     value: totalAllocated,  icon: PieChart,     color: 'text-blue-600 bg-blue-50' },
          { label: 'Spent/Actuals', value: totalSpent,      icon: TrendingUp,   color: overBudget ? 'text-red-600 bg-red-50' : 'text-orange-600 bg-orange-50' },
          { label: 'Remaining',     value: remaining,       icon: DollarSign,   color: remaining < 0 ? 'text-red-600 bg-red-50' : 'text-green-600 bg-green-50' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-4">
            <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center mb-3', color)}>
              <Icon className="w-4.5 h-4.5" />
            </div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={cn('text-xl font-bold', value < 0 && 'text-red-600')}>
              {formatCurrency(Math.abs(value))}
              {value < 0 && <span className="text-sm font-normal text-red-500 ml-1">over</span>}
            </p>
          </div>
        ))}
      </div>

      {/* Budget utilisation bar */}
      {totalBudget > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium">Budget Utilisation</span>
            <span className={cn('text-sm font-bold', overBudget ? 'text-red-600' : 'text-foreground')}>
              {totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0}%
            </span>
          </div>
          <ProgressBar value={totalSpent} max={totalBudget} color={overBudget ? '#dc2626' : '#7c3aed'} />
          <div className="flex justify-between text-xs text-muted-foreground mt-2">
            <span>{formatCurrency(totalSpent)} spent</span>
            <span>{formatCurrency(totalBudget)} total</span>
          </div>
          {overBudget && (
            <div className="flex items-center gap-1.5 mt-3 text-xs text-red-600">
              <AlertCircle className="w-3.5 h-3.5" />
              Budget exceeded by {formatCurrency(Math.abs(remaining))}
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {(['overview', 'items'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize',
              activeTab === tab
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {tab === 'overview' ? 'By Category' : 'All Items'}
          </button>
        ))}
      </div>

      {/* Category overview */}
      {activeTab === 'overview' && (
        <div className="space-y-3">
          {categories.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-12 text-center">
              <BarChart3 className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="text-muted-foreground">No budget items yet</p>
              <button
                onClick={() => setShowAddItem(true)}
                className="mt-3 text-sm text-primary hover:underline"
              >
                Add your first budget item
              </button>
            </div>
          ) : (
            categories.map(cat => (
              <div key={cat.id} className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                    <span className="font-medium">{cat.name}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">{formatCurrency(cat.spent)}</p>
                    <p className="text-xs text-muted-foreground">of {formatCurrency(cat.allocated)}</p>
                  </div>
                </div>
                <ProgressBar value={cat.spent} max={cat.allocated} color={cat.color} />
                <div className="flex justify-between text-xs text-muted-foreground mt-1.5">
                  <span className="flex items-center gap-1 text-green-600">
                    <CheckCircle2 className="w-3 h-3" /> Paid: {formatCurrency(cat.paid)}
                  </span>
                  <span>{cat.spent > cat.allocated ? '⚠️ Over budget' : `${formatCurrency(cat.allocated - cat.spent)} remaining`}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Items list */}
      {activeTab === 'items' && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {items.length === 0 ? (
            <div className="p-12 text-center">
              <Wallet className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="text-muted-foreground">No budget items</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/30">
                <tr>
                  {['Description', 'Category', 'Estimated', 'Actual', 'Status', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map(item => (
                  <tr key={item.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium">{item.description}</p>
                      {item.vendor_name && <p className="text-xs text-muted-foreground">{item.vendor_name}</p>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{item.category_name}</td>
                    <td className="px-4 py-3 font-medium">{formatCurrency(item.estimated_amount)}</td>
                    <td className="px-4 py-3">
                      {item.actual_amount != null ? (
                        <span className={cn('font-medium', item.actual_amount > item.estimated_amount && 'text-red-600')}>
                          {formatCurrency(item.actual_amount)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('text-xs px-2 py-0.5 rounded-full border font-medium', STATUS_CONFIG[item.status]?.color)}>
                        {STATUS_CONFIG[item.status]?.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        className="text-muted-foreground hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Add Item Modal */}
      {showAddItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold mb-4">Add Budget Item</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Description *</label>
                <input
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-sm"
                  value={newItem.description}
                  onChange={e => setNewItem(p => ({ ...p, description: e.target.value }))}
                  placeholder="e.g. Catering service"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Category</label>
                  <input
                    className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-sm"
                    value={newItem.category_id}
                    onChange={e => setNewItem(p => ({ ...p, category_id: e.target.value }))}
                    placeholder="e.g. F&B"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Estimated (₹) *</label>
                  <input
                    type="number"
                    className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-sm"
                    value={newItem.estimated_amount}
                    onChange={e => setNewItem(p => ({ ...p, estimated_amount: e.target.value }))}
                    placeholder="0"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Vendor</label>
                <input
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-sm"
                  value={newItem.vendor_name}
                  onChange={e => setNewItem(p => ({ ...p, vendor_name: e.target.value }))}
                  placeholder="Vendor name (optional)"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Notes</label>
                <textarea
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-background text-sm"
                  rows={2}
                  value={newItem.notes}
                  onChange={e => setNewItem(p => ({ ...p, notes: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setShowAddItem(false)}
                className="flex-1 px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddItem}
                className="flex-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                Add Item
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
