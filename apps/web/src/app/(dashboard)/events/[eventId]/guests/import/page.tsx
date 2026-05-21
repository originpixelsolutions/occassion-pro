'use client'

import { use, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/hooks/use-auth'
import { cn } from '@/lib/utils'
import {
  ArrowLeft, Upload, Download, CheckCircle2, AlertCircle,
  FileText, X, ChevronRight, Loader2, RefreshCw,
  Users, Clock, AlertTriangle, Table2,
} from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1'

// ── Guest field definitions ────────────────────────────────────────────────────

const GUEST_FIELDS = [
  { key: 'name',                label: 'Full Name',           required: true },
  { key: 'mobile',              label: 'Mobile Number',       required: false },
  { key: 'email',               label: 'Email Address',       required: false },
  { key: 'category',            label: 'Category',            required: false },
  { key: 'rsvp_status',         label: 'RSVP Status',         required: false },
  { key: 'dietary_requirement', label: 'Dietary Requirement', required: false },
  { key: 'table_number',        label: 'Table Number',        required: false },
  { key: 'accommodation_type',  label: 'Accommodation Type',  required: false },
  { key: 'is_vip',              label: 'VIP (true/false)',    required: false },
  { key: 'notes',               label: 'Notes',               required: false },
  { key: 'skip',                label: '— Skip this column —', required: false },
]

// ── Types ──────────────────────────────────────────────────────────────────────

interface PreviewRow {
  row_index: number
  mapped: Record<string, string>
  raw: Record<string, string>
  errors: string[]
  warnings: string[]
}

interface PreviewResult {
  total_rows: number
  valid_rows: number
  error_rows: number
  preview_sample: PreviewRow[]
  detected_mapping: Record<string, string>
}

interface ImportResult {
  imported: number
  skipped: number
  errors: { row: number; message: string }[]
  batch_id: string
}

interface ImportBatch {
  id: string
  filename: string
  total_rows: number
  imported_count: number
  error_count: number
  status: 'completed' | 'partial' | 'failed'
  created_at: string
  created_by_profile?: { full_name: string }
}

type Step = 'upload' | 'map' | 'result'

// ── Helpers ────────────────────────────────────────────────────────────────────

function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.trim().split('\n').map(l => l.replace(/\r$/, ''))
  if (lines.length < 2) return { headers: [], rows: [] }

  const parseRow = (line: string): string[] => {
    const result: string[] = []
    let inQuote = false
    let current = ''
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { current += '"'; i++ }
        else inQuote = !inQuote
      } else if (ch === ',' && !inQuote) {
        result.push(current.trim()); current = ''
      } else {
        current += ch
      }
    }
    result.push(current.trim())
    return result
  }

  const headers = parseRow(lines[0])
  const rows = lines.slice(1).filter(l => l.trim()).map(l => {
    const vals = parseRow(l)
    return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? '']))
  })
  return { headers, rows }
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: Step }) {
  const steps: { id: Step; label: string }[] = [
    { id: 'upload', label: 'Upload' },
    { id: 'map',    label: 'Map Columns' },
    { id: 'result', label: 'Result' },
  ]
  const idx = steps.findIndex(s => s.id === current)
  return (
    <div className="flex items-center gap-0">
      {steps.map((s, i) => (
        <div key={s.id} className="flex items-center">
          <div className="flex items-center gap-2">
            <div className={cn(
              'w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border',
              i < idx  ? 'bg-green-500 border-green-500 text-white'
                       : i === idx ? 'bg-violet-500 border-violet-500 text-white'
                       : 'border-zinc-700 text-zinc-500',
            )}>
              {i < idx ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
            </div>
            <span className={cn('text-sm', i === idx ? 'text-white font-medium' : 'text-zinc-500')}>
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <ChevronRight className="w-4 h-4 text-zinc-700 mx-3" />
          )}
        </div>
      ))}
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function GuestImportPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = use(params)
  const router = useRouter()
  const { session } = useAuth()
  const token = session?.access_token ?? ''

  // ── State ──────────────────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>('upload')
  const [dragging, setDragging] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [parsed, setParsed] = useState<{ headers: string[]; rows: Record<string, string>[] } | null>(null)
  const [mapping, setMapping] = useState<Record<string, string>>({}) // csvHeader → guestField
  const [preview, setPreview] = useState<PreviewResult | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [importLoading, setImportLoading] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [batches, setBatches] = useState<ImportBatch[]>([])
  const [batchesLoading, setBatchesLoading] = useState(true)
  const fileRef = useRef<HTMLInputElement>(null)

  // ── Load import history ────────────────────────────────────────────────────
  const loadBatches = useCallback(() => {
    if (!token) return
    setBatchesLoading(true)
    fetch(`${API}/events/${eventId}/guests/import/batches`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => setBatches(Array.isArray(d) ? d : d.batches ?? []))
      .catch(() => {})
      .finally(() => setBatchesLoading(false))
  }, [eventId, token])

  useState(() => { loadBatches() })

  // ── File handling ──────────────────────────────────────────────────────────
  const handleFile = useCallback((f: File) => {
    if (!f.name.endsWith('.csv')) {
      setPreviewError('Please upload a .csv file')
      return
    }
    setFile(f)
    setPreviewError(null)
    const reader = new FileReader()
    reader.onload = e => {
      const text = e.target?.result as string
      const data = parseCSV(text)
      if (!data.headers.length) {
        setPreviewError('Could not parse CSV — make sure it has a header row')
        return
      }
      setParsed(data)
      // Auto-detect mapping based on header names
      const autoMap: Record<string, string> = {}
      data.headers.forEach(h => {
        const lower = h.toLowerCase().replace(/[\s_-]/g, '')
        if (lower.includes('name'))    autoMap[h] = 'name'
        else if (lower.includes('mobile') || lower.includes('phone')) autoMap[h] = 'mobile'
        else if (lower.includes('email')) autoMap[h] = 'email'
        else if (lower.includes('category') || lower.includes('group')) autoMap[h] = 'category'
        else if (lower.includes('rsvp') || lower.includes('status')) autoMap[h] = 'rsvp_status'
        else if (lower.includes('dietary') || lower.includes('food') || lower.includes('meal')) autoMap[h] = 'dietary_requirement'
        else if (lower.includes('table') || lower.includes('seat')) autoMap[h] = 'table_number'
        else if (lower.includes('accommodation') || lower.includes('room') || lower.includes('hotel')) autoMap[h] = 'accommodation_type'
        else if (lower.includes('vip')) autoMap[h] = 'is_vip'
        else if (lower.includes('note') || lower.includes('remark')) autoMap[h] = 'notes'
        else autoMap[h] = 'skip'
      })
      setMapping(autoMap)
    }
    reader.readAsText(f)
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }, [handleFile])

  // ── Download template ──────────────────────────────────────────────────────
  const downloadTemplate = () => {
    const link = document.createElement('a')
    link.href = `${API}/events/${eventId}/guests/import/template`
    link.download = 'guest_import_template.csv'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // ── Step 2: Preview ────────────────────────────────────────────────────────
  const runPreview = async () => {
    if (!parsed) return
    setPreviewLoading(true)
    setPreviewError(null)
    try {
      const res = await fetch(`${API}/events/${eventId}/guests/import/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ headers: parsed.headers, rows: parsed.rows, columnMapping: mapping }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message ?? 'Preview failed')
      setPreview(data)
      setStep('map')
    } catch (e: any) {
      setPreviewError(e.message)
    } finally {
      setPreviewLoading(false)
    }
  }

  // ── Step 3: Execute import ─────────────────────────────────────────────────
  const executeImport = async () => {
    if (!parsed || !file) return
    setImportLoading(true)
    try {
      const res = await fetch(`${API}/events/${eventId}/guests/import/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          filename: file.name,
          headers: parsed.headers,
          rows: parsed.rows,
          columnMapping: mapping,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message ?? 'Import failed')
      setImportResult(data)
      setStep('result')
      loadBatches()
    } catch (e: any) {
      setPreviewError(e.message)
    } finally {
      setImportLoading(false)
    }
  }

  // ── Reset wizard ───────────────────────────────────────────────────────────
  const reset = () => {
    setStep('upload')
    setFile(null)
    setParsed(null)
    setMapping({})
    setPreview(null)
    setPreviewError(null)
    setImportResult(null)
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-10">

      {/* Header */}
      <div>
        <Link
          href={`/events/${eventId}/guests`}
          className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 mb-4 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Guests
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-white">Import Guests</h1>
            <p className="text-zinc-400 text-sm mt-0.5">Upload a CSV file to bulk-import guests into this event</p>
          </div>
          <button
            onClick={downloadTemplate}
            className="flex items-center gap-1.5 px-3 py-2 border border-zinc-700 rounded-lg text-xs text-zinc-300 hover:border-zinc-500 hover:text-white transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> Download Template
          </button>
        </div>
      </div>

      {/* Step indicator */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4">
        <StepIndicator current={step} />
      </div>

      {/* ── Step 1: Upload ── */}
      {step === 'upload' && (
        <div className="space-y-4">
          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
            className={cn(
              'border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all',
              dragging
                ? 'border-violet-500 bg-violet-500/5'
                : file
                ? 'border-green-500/50 bg-green-500/5'
                : 'border-zinc-700 hover:border-zinc-500 bg-zinc-900/40',
            )}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
            />
            {file ? (
              <div className="space-y-2">
                <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto" />
                <p className="text-white font-medium">{file.name}</p>
                <p className="text-zinc-400 text-sm">
                  {parsed ? `${parsed.rows.length} rows · ${parsed.headers.length} columns` : 'Parsing…'}
                </p>
                <button
                  onClick={e => { e.stopPropagation(); reset() }}
                  className="text-xs text-zinc-500 hover:text-zinc-300 underline"
                >
                  Remove file
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <Upload className="w-10 h-10 text-zinc-600 mx-auto" />
                <div>
                  <p className="text-white font-medium">Drop your CSV file here</p>
                  <p className="text-zinc-500 text-sm mt-1">or click to browse · .csv files only</p>
                </div>
              </div>
            )}
          </div>

          {previewError && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {previewError}
            </div>
          )}

          {/* Column preview table */}
          {parsed && parsed.rows.length > 0 && (
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-2">
                <Table2 className="w-4 h-4 text-zinc-400" />
                <span className="text-sm font-medium text-zinc-200">CSV Preview</span>
                <span className="text-xs text-zinc-500 ml-auto">{parsed.rows.length} rows detected</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-zinc-800">
                      {parsed.headers.map(h => (
                        <th key={h} className="px-3 py-2 text-left text-zinc-400 font-medium whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.rows.slice(0, 5).map((row, i) => (
                      <tr key={i} className="border-b border-zinc-800/50 last:border-0">
                        {parsed.headers.map(h => (
                          <td key={h} className="px-3 py-2 text-zinc-300 whitespace-nowrap max-w-[160px] truncate">
                            {row[h] || <span className="text-zinc-600">—</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsed.rows.length > 5 && (
                <div className="px-4 py-2 text-xs text-zinc-600">
                  + {parsed.rows.length - 5} more rows not shown
                </div>
              )}
            </div>
          )}

          {/* Proceed button */}
          <div className="flex justify-end">
            <button
              disabled={!parsed || previewLoading}
              onClick={runPreview}
              className={cn(
                'flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all',
                parsed && !previewLoading
                  ? 'bg-violet-500 hover:bg-violet-600 text-white'
                  : 'bg-zinc-800 text-zinc-500 cursor-not-allowed',
              )}
            >
              {previewLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              Map Columns <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Column Mapping ── */}
      {step === 'map' && parsed && (
        <div className="space-y-4">
          {/* Mapping table */}
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-800">
              <h2 className="text-sm font-semibold text-zinc-200">Map Your CSV Columns</h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                We've auto-detected the mapping based on your column names. Adjust as needed.
              </p>
            </div>
            <div className="divide-y divide-zinc-800/60">
              {parsed.headers.map(header => (
                <div key={header} className="flex items-center justify-between gap-4 px-5 py-3">
                  <div className="min-w-0">
                    <p className="text-sm text-zinc-200 font-medium truncate">{header}</p>
                    <p className="text-xs text-zinc-600 mt-0.5 truncate">
                      Sample: {parsed.rows.slice(0, 3).map(r => r[header]).filter(Boolean).join(', ') || '—'}
                    </p>
                  </div>
                  <select
                    value={mapping[header] ?? 'skip'}
                    onChange={e => setMapping(prev => ({ ...prev, [header]: e.target.value }))}
                    className="shrink-0 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 px-3 py-1.5 focus:outline-none focus:border-violet-500 min-w-[200px]"
                  >
                    {GUEST_FIELDS.map(f => (
                      <option key={f.key} value={f.key}>
                        {f.label}{f.required ? ' *' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Preview summary */}
          {preview && (
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Total Rows',   value: preview.total_rows,  color: 'text-zinc-300' },
                { label: 'Valid Rows',   value: preview.valid_rows,  color: 'text-green-400' },
                { label: 'Rows with Errors', value: preview.error_rows, color: preview.error_rows > 0 ? 'text-red-400' : 'text-zinc-500' },
              ].map(s => (
                <div key={s.label} className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 text-center">
                  <p className={cn('text-2xl font-bold tabular-nums', s.color)}>{s.value}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Sample errors */}
          {preview && preview.preview_sample.some(r => r.errors.length > 0) && (
            <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4">
              <p className="text-xs font-medium text-red-400 mb-2 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> Some rows have validation errors (will be skipped)
              </p>
              <div className="space-y-1">
                {preview.preview_sample.filter(r => r.errors.length > 0).slice(0, 5).map(r => (
                  <p key={r.row_index} className="text-xs text-red-300/70">
                    Row {r.row_index + 2}: {r.errors.join(', ')}
                  </p>
                ))}
              </div>
            </div>
          )}

          {previewError && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {previewError}
            </div>
          )}

          {/* Nav buttons */}
          <div className="flex items-center justify-between">
            <button
              onClick={reset}
              className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              ← Back
            </button>
            <button
              disabled={importLoading || !preview || preview.valid_rows === 0}
              onClick={executeImport}
              className={cn(
                'flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all',
                !importLoading && preview && preview.valid_rows > 0
                  ? 'bg-violet-500 hover:bg-violet-600 text-white'
                  : 'bg-zinc-800 text-zinc-500 cursor-not-allowed',
              )}
            >
              {importLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              Import {preview?.valid_rows ?? 0} Guests
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Result ── */}
      {step === 'result' && importResult && (
        <div className="space-y-4">
          {/* Success banner */}
          <div className={cn(
            'border rounded-xl p-6 text-center',
            importResult.errors.length === 0
              ? 'bg-green-500/10 border-green-500/30'
              : 'bg-amber-500/10 border-amber-500/30',
          )}>
            <CheckCircle2 className={cn('w-10 h-10 mx-auto mb-3',
              importResult.errors.length === 0 ? 'text-green-400' : 'text-amber-400')} />
            <p className="text-lg font-semibold text-white">
              Import Complete
            </p>
            <p className={cn('text-sm mt-1', importResult.errors.length === 0 ? 'text-green-300' : 'text-amber-300')}>
              {importResult.imported} guests imported successfully
              {importResult.skipped > 0 && `, ${importResult.skipped} skipped`}
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Imported',  value: importResult.imported, color: 'text-green-400' },
              { label: 'Skipped',   value: importResult.skipped,  color: 'text-zinc-400' },
              { label: 'Errors',    value: importResult.errors.length, color: importResult.errors.length > 0 ? 'text-red-400' : 'text-zinc-500' },
            ].map(s => (
              <div key={s.label} className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 text-center">
                <p className={cn('text-2xl font-bold tabular-nums', s.color)}>{s.value}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Error details */}
          {importResult.errors.length > 0 && (
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-800">
                <p className="text-sm font-medium text-zinc-200">Rows that failed</p>
              </div>
              <div className="divide-y divide-zinc-800/50 max-h-48 overflow-y-auto">
                {importResult.errors.map(e => (
                  <div key={e.row} className="flex items-start gap-3 px-4 py-2.5">
                    <span className="text-xs text-zinc-500 w-12 shrink-0">Row {e.row}</span>
                    <span className="text-xs text-red-300">{e.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={reset}
              className="flex items-center gap-1.5 px-4 py-2 border border-zinc-700 rounded-lg text-sm text-zinc-300 hover:border-zinc-500 hover:text-white transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Import Another File
            </button>
            <Link
              href={`/events/${eventId}/guests`}
              className="flex items-center gap-1.5 px-4 py-2 bg-violet-500 hover:bg-violet-600 rounded-lg text-sm text-white font-medium transition-colors"
            >
              <Users className="w-3.5 h-3.5" /> View Guests
            </Link>
          </div>
        </div>
      )}

      {/* ── Import History ── */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-zinc-400" />
            <h2 className="text-sm font-semibold text-zinc-200">Import History</h2>
          </div>
          <button
            onClick={loadBatches}
            className="text-zinc-500 hover:text-zinc-300 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {batchesLoading ? (
          <div className="p-8 text-center">
            <Loader2 className="w-5 h-5 animate-spin text-zinc-600 mx-auto" />
          </div>
        ) : batches.length === 0 ? (
          <div className="p-8 text-center">
            <FileText className="w-7 h-7 text-zinc-700 mx-auto mb-2" />
            <p className="text-zinc-500 text-sm">No imports yet</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/50">
            {batches.map(b => (
              <div key={b.id} className="flex items-center justify-between gap-4 px-5 py-3.5">
                <div className="min-w-0">
                  <p className="text-sm text-zinc-200 font-medium truncate">{b.filename}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {fmtDate(b.created_at)}
                    {b.created_by_profile && ` · ${b.created_by_profile.full_name}`}
                  </p>
                </div>
                <div className="flex items-center gap-4 shrink-0 text-xs">
                  <span className="text-green-400">{b.imported_count} imported</span>
                  {b.error_count > 0 && <span className="text-red-400">{b.error_count} errors</span>}
                  <span className={cn(
                    'px-2 py-0.5 rounded-full font-medium capitalize',
                    b.status === 'completed' ? 'bg-green-500/15 text-green-400'
                    : b.status === 'partial' ? 'bg-amber-500/15 text-amber-400'
                    : 'bg-red-500/15 text-red-400',
                  )}>
                    {b.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
