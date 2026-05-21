'use client'

import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api'
import { Ticket, Plus, Loader2, CheckCircle2, Clock, XCircle, RefreshCw, Download } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TokenBatch {
  id: string
  batch_name: string
  token_prefix: string
  total_tokens: number
  tokens_issued: number
  tokens_redeemed: number
  valid_from?: string
  valid_until?: string
  created_at: string
  menu?: { name: string; meal_type: string }
}

interface Token {
  id: string
  token_code: string
  status: 'unissued' | 'issued' | 'redeemed' | 'expired' | 'void'
  issued_at?: string
  redeemed_at?: string
  guest?: { id: string; name: string; phone?: string }
}

interface PaginatedTokens {
  data: Token[]
  total: number
  page: number
  limit: number
}

const STATUS_CONFIG = {
  unissued: { label: 'Unissued', color: 'text-zinc-400 bg-zinc-500/10',    icon: Clock },
  issued:   { label: 'Issued',   color: 'text-blue-400 bg-blue-500/10',   icon: Ticket },
  redeemed: { label: 'Redeemed', color: 'text-emerald-400 bg-emerald-500/10', icon: CheckCircle2 },
  expired:  { label: 'Expired',  color: 'text-amber-400 bg-amber-500/10', icon: Clock },
  void:     { label: 'Void',     color: 'text-red-400 bg-red-500/10',     icon: XCircle },
}

function StatusBadge({ status }: { status: Token['status'] }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.unissued
  const Icon = cfg.icon
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium', cfg.color)}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  )
}

export function TokenManager({ eventId }: { eventId: string }) {
  const [batches, setBatches] = useState<TokenBatch[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedBatch, setSelectedBatch] = useState<TokenBatch | null>(null)
  const [tokens, setTokens] = useState<PaginatedTokens | null>(null)
  const [tokenPage, setTokenPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    batch_name: '',
    token_prefix: 'TKN',
    total_tokens: '100',
    menu_id: '',
    valid_from: '',
    valid_until: '',
  })

  const loadBatches = useCallback(async () => {
    setLoading(true)
    const data = await api.get<TokenBatch[]>(`/fnb/events/${eventId}/token-batches`).catch(() => [])
    setBatches(data)
    setLoading(false)
  }, [eventId])

  useEffect(() => { loadBatches() }, [loadBatches])

  const loadTokens = useCallback(async (batch: TokenBatch, page = 1) => {
    const params = new URLSearchParams({ page: String(page), limit: '50' })
    if (statusFilter) params.set('status', statusFilter)
    const data = await api.get<PaginatedTokens>(`/fnb/token-batches/${batch.id}/tokens?${params}`).catch(() => null)
    setTokens(data)
    setTokenPage(page)
  }, [statusFilter])

  const openBatch = async (batch: TokenBatch) => {
    setSelectedBatch(batch)
    await loadTokens(batch, 1)
  }

  const createBatch = async () => {
    setSaving(true)
    try {
      await api.post(`/fnb/events/${eventId}/token-batches`, {
        ...form,
        total_tokens: Number(form.total_tokens),
        menu_id: form.menu_id || undefined,
        valid_from: form.valid_from || undefined,
        valid_until: form.valid_until || undefined,
      })
      setShowForm(false)
      setForm({ batch_name: '', token_prefix: 'TKN', total_tokens: '100', menu_id: '', valid_from: '', valid_until: '' })
      await loadBatches()
    } catch (e) { console.error(e) } finally { setSaving(false) }
  }

  const downloadCsv = (batch: TokenBatch) => {
    // trigger download of the batch's tokens as CSV via a direct fetch
    api.get<Token[]>(`/fnb/token-batches/${batch.id}/tokens?limit=10000`)
      .then(res => {
        const rows = (res as any)?.data ?? res
        const csv = ['token_code,status,guest_name,issued_at,redeemed_at',
          ...rows.map((t: Token) => `${t.token_code},${t.status},${t.guest?.name ?? ''},${t.issued_at ?? ''},${t.redeemed_at ?? ''}`),
        ].join('\n')
        const blob = new Blob([csv], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url; a.download = `${batch.batch_name}.csv`; a.click()
        URL.revokeObjectURL(url)
      })
  }

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>

  if (selectedBatch) return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => setSelectedBatch(null)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">← Back</button>
        <h2 className="text-sm font-semibold">{selectedBatch.batch_name}</h2>
        <div className="flex items-center gap-3 ml-auto text-xs text-muted-foreground">
          <span>{selectedBatch.total_tokens} total</span>
          <span className="text-blue-400">{selectedBatch.tokens_issued} issued</span>
          <span className="text-emerald-400">{selectedBatch.tokens_redeemed} redeemed</span>
          <button onClick={() => downloadCsv(selectedBatch)} className="flex items-center gap-1 px-2.5 py-1 border border-border rounded-lg hover:bg-accent transition-colors">
            <Download className="w-3 h-3" /> CSV
          </button>
          <button onClick={() => loadTokens(selectedBatch, tokenPage)} className="p-1.5 border border-border rounded-lg hover:bg-accent transition-colors">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {['', 'unissued', 'issued', 'redeemed', 'expired', 'void'].map(s => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); loadTokens(selectedBatch, 1) }}
            className={cn(
              'px-3 py-1 text-xs rounded-full border transition-colors',
              statusFilter === s ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:text-foreground',
            )}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      {/* Token list */}
      {!tokens ? (
        <div className="flex justify-center py-8"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          <div className="space-y-1">
            {tokens.data.map(token => (
              <div key={token.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-background border border-border">
                <code className="text-xs font-mono text-muted-foreground flex-1">{token.token_code}</code>
                {token.guest && <span className="text-xs text-foreground truncate max-w-[120px]">{token.guest.name}</span>}
                <StatusBadge status={token.status} />
              </div>
            ))}
          </div>
          {tokens.total > tokens.limit && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <button disabled={tokenPage <= 1} onClick={() => loadTokens(selectedBatch, tokenPage - 1)} className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-30">← Prev</button>
              <span className="text-xs text-muted-foreground">Page {tokenPage} of {Math.ceil(tokens.total / tokens.limit)}</span>
              <button disabled={tokenPage >= Math.ceil(tokens.total / tokens.limit)} onClick={() => loadTokens(selectedBatch, tokenPage + 1)} className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-30">Next →</button>
            </div>
          )}
        </>
      )}
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground">{batches.length} batch{batches.length !== 1 ? 'es' : ''}</h2>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:opacity-90 transition-opacity"
        >
          <Plus className="w-3.5 h-3.5" /> New Batch
        </button>
      </div>

      {showForm && (
        <div className="bg-background border border-border rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-semibold">Create Token Batch</h3>
          <div className="grid grid-cols-2 gap-3">
            <input className="bg-card border border-border rounded-lg px-3 py-2 text-sm col-span-2" placeholder="Batch name *" value={form.batch_name} onChange={e => setForm(p => ({ ...p, batch_name: e.target.value }))} />
            <input className="bg-card border border-border rounded-lg px-3 py-2 text-sm" placeholder="Token prefix (TKN)" value={form.token_prefix} onChange={e => setForm(p => ({ ...p, token_prefix: e.target.value }))} />
            <input type="number" className="bg-card border border-border rounded-lg px-3 py-2 text-sm" placeholder="Total tokens *" value={form.total_tokens} onChange={e => setForm(p => ({ ...p, total_tokens: e.target.value }))} />
            <input type="datetime-local" className="bg-card border border-border rounded-lg px-3 py-2 text-sm" placeholder="Valid from" value={form.valid_from} onChange={e => setForm(p => ({ ...p, valid_from: e.target.value }))} />
            <input type="datetime-local" className="bg-card border border-border rounded-lg px-3 py-2 text-sm" placeholder="Valid until" value={form.valid_until} onChange={e => setForm(p => ({ ...p, valid_until: e.target.value }))} />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="px-3 py-1.5 border border-border rounded-lg text-xs hover:bg-accent transition-colors">Cancel</button>
            <button
              onClick={createBatch}
              disabled={!form.batch_name || !form.total_tokens || saving}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Ticket className="w-3.5 h-3.5" />}
              {saving ? 'Generating…' : 'Create'}
            </button>
          </div>
        </div>
      )}

      {batches.length === 0 ? (
        <div className="flex flex-col items-center py-16 gap-3">
          <Ticket className="w-8 h-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No token batches yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {batches.map(batch => {
            const issuedPct = batch.total_tokens > 0 ? Math.round((batch.tokens_issued / batch.total_tokens) * 100) : 0
            const redeemedPct = batch.tokens_issued > 0 ? Math.round((batch.tokens_redeemed / batch.tokens_issued) * 100) : 0
            return (
              <div key={batch.id} className="bg-background border border-border rounded-xl p-4 hover:border-primary/30 transition-colors cursor-pointer" onClick={() => openBatch(batch)}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{batch.batch_name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Prefix: <code className="font-mono">{batch.token_prefix}</code>
                      {batch.menu && ` · ${batch.menu.name}`}
                    </p>
                  </div>
                  <div className="text-right text-xs text-muted-foreground shrink-0">
                    <p className="text-foreground font-bold">{batch.total_tokens} tokens</p>
                    <p>{issuedPct}% issued · {redeemedPct}% redeemed</p>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <div className="flex-1">
                    <div className="h-1.5 bg-border rounded-full overflow-hidden">
                      <div className="h-full bg-blue-400 rounded-full" style={{ width: `${issuedPct}%` }} />
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">{batch.tokens_issued} issued</p>
                  </div>
                  <div className="flex-1">
                    <div className="h-1.5 bg-border rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${redeemedPct}%` }} />
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">{batch.tokens_redeemed} redeemed</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
