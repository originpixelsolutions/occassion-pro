'use client'

import { useState, useRef, useCallback } from 'react'
import { api } from '@/lib/api'
import { ScanLine, CheckCircle2, XCircle, Loader2, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

interface RedemptionResult {
  id: string
  token_code: string
  status: string
  redeemed_at: string
  guest?: { id: string; name: string; phone?: string }
}

type ScanState = 'idle' | 'scanning' | 'success' | 'error'

export function RedemptionScanner({ eventId }: { eventId: string }) {
  const [tokenCode, setTokenCode] = useState('')
  const [station, setStation] = useState('')
  const [scanState, setScanState] = useState<ScanState>('idle')
  const [result, setResult] = useState<RedemptionResult | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [history, setHistory] = useState<Array<{ code: string; status: 'success' | 'error'; name?: string; time: Date }>>([])
  const inputRef = useRef<HTMLInputElement>(null)

  const redeem = useCallback(async (code: string) => {
    if (!code.trim()) return
    setScanState('scanning')
    setResult(null)
    setErrorMsg('')

    try {
      const data = await api.post<RedemptionResult>('/fnb/tokens/redeem', {
        token_code: code.trim(),
        serving_station: station || undefined,
      })
      setResult(data)
      setScanState('success')
      setHistory(prev => [{ code: data.token_code, status: 'success', name: data.guest?.name, time: new Date() }, ...prev.slice(0, 19)])
      setTimeout(() => {
        setScanState('idle')
        setTokenCode('')
        inputRef.current?.focus()
      }, 2500)
    } catch (err: any) {
      setScanState('error')
      setErrorMsg(err?.message ?? 'Redemption failed')
      setHistory(prev => [{ code: code.trim(), status: 'error', time: new Date() }, ...prev.slice(0, 19)])
      setTimeout(() => {
        setScanState('idle')
        setTokenCode('')
        inputRef.current?.focus()
      }, 3000)
    }
  }, [station])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') redeem(tokenCode)
  }

  return (
    <div className="max-w-lg mx-auto space-y-5">
      {/* Scanner card */}
      <div className={cn(
        'border-2 rounded-2xl p-6 text-center transition-all duration-300',
        scanState === 'idle'     && 'border-border bg-background',
        scanState === 'scanning' && 'border-blue-500/50 bg-blue-500/5',
        scanState === 'success'  && 'border-emerald-500/50 bg-emerald-500/5',
        scanState === 'error'    && 'border-red-500/50 bg-red-500/5',
      )}>
        <div className="flex justify-center mb-4">
          {scanState === 'scanning' && <Loader2 className="w-10 h-10 text-blue-400 animate-spin" />}
          {scanState === 'success'  && <CheckCircle2 className="w-10 h-10 text-emerald-400" />}
          {scanState === 'error'    && <XCircle className="w-10 h-10 text-red-400" />}
          {scanState === 'idle'     && <ScanLine className="w-10 h-10 text-muted-foreground/50" />}
        </div>

        {scanState === 'idle' && <p className="text-sm text-muted-foreground">Ready to scan</p>}
        {scanState === 'scanning' && <p className="text-sm text-blue-400">Validating token…</p>}

        {scanState === 'success' && result && (
          <div>
            <p className="text-base font-bold text-emerald-400">Token Redeemed ✓</p>
            <p className="text-sm font-mono text-muted-foreground mt-1">{result.token_code}</p>
            {result.guest && (
              <p className="text-sm text-foreground mt-2 font-medium">{result.guest.name}</p>
            )}
          </div>
        )}

        {scanState === 'error' && (
          <div>
            <p className="text-base font-bold text-red-400">Redemption Failed</p>
            <p className="text-sm text-muted-foreground mt-1">{errorMsg}</p>
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="space-y-3">
        <input
          ref={inputRef}
          type="text"
          placeholder="Serving station (optional)"
          className="w-full bg-card border border-border rounded-xl px-4 py-2.5 text-sm"
          value={station}
          onChange={e => setStation(e.target.value)}
          autoFocus={false}
        />
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            placeholder="Scan or type token code + Enter"
            className="flex-1 bg-card border border-border rounded-xl px-4 py-2.5 text-sm font-mono"
            value={tokenCode}
            onChange={e => setTokenCode(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
            disabled={scanState === 'scanning'}
          />
          <button
            onClick={() => redeem(tokenCode)}
            disabled={!tokenCode.trim() || scanState === 'scanning'}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
          >
            {scanState === 'scanning' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanLine className="w-4 h-4" />}
            Redeem
          </button>
        </div>
      </div>

      {/* Scan history */}
      {history.length > 0 && (
        <div className="bg-background border border-border rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
            <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground">Recent Scans</span>
          </div>
          <div className="divide-y divide-border">
            {history.map((h, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                {h.status === 'success'
                  ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  : <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                }
                <code className="text-xs font-mono text-muted-foreground flex-1">{h.code}</code>
                {h.name && <span className="text-xs text-foreground truncate max-w-[100px]">{h.name}</span>}
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {h.time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
