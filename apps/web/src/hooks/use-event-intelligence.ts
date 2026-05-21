'use client'

/**
 * Rule-Based Intelligence Hooks — zero-cost, algorithm-driven, always-on.
 *
 * These hooks are NEVER gated by the AI API toggle.
 * They use PostgreSQL queries, simple arithmetic, and Supabase realtime.
 * No external API calls, no ML models, no cost.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SmartAlertItem {
  id: string
  severity: 'critical' | 'warning' | 'info' | 'success'
  title: string
  message?: string
  module: string
}

// ─── Event Health Score ───────────────────────────────────────────────────────

export interface EventHealthScore {
  score: number       // 0-100
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  color: 'emerald' | 'blue' | 'amber' | 'orange' | 'red'
  components: {
    rsvp: number          // 0-25: RSVP confirmed % × 25
    budget: number        // 0-25: budget utilisation vs plan (25 = on track)
    tasks: number         // 0-25: completed tasks %  × 25
    vendors: number       // 0-25: confirmed vendors % × 25
  }
  alerts: SmartAlertItem[]
}

export function calcEventHealthScore({
  rsvpConfirmedPct,        // 0-1
  budgetUsedPct,           // 0-1 (committed / total budget)
  tasksCompletedPct,       // 0-1
  vendorsConfirmedPct,     // 0-1
  daysToEvent,
}: {
  rsvpConfirmedPct: number
  budgetUsedPct: number
  tasksCompletedPct: number
  vendorsConfirmedPct: number
  daysToEvent: number
}): EventHealthScore {
  // Budget score: 25 if <80% used, drops as it exceeds
  const budgetScore = budgetUsedPct <= 0.8
    ? 25
    : budgetUsedPct <= 1.0
      ? 25 * (1 - (budgetUsedPct - 0.8) / 0.2)
      : 0

  const components = {
    rsvp: Math.round(rsvpConfirmedPct * 25),
    budget: Math.round(budgetScore),
    tasks: Math.round(tasksCompletedPct * 25),
    vendors: Math.round(vendorsConfirmedPct * 25),
  }
  const score = components.rsvp + components.budget + components.tasks + components.vendors

  let grade: EventHealthScore['grade']
  let color: EventHealthScore['color']
  if (score >= 85) { grade = 'A'; color = 'emerald' }
  else if (score >= 70) { grade = 'B'; color = 'blue' }
  else if (score >= 55) { grade = 'C'; color = 'amber' }
  else if (score >= 40) { grade = 'D'; color = 'orange' }
  else { grade = 'F'; color = 'red' }

  const alerts: SmartAlertItem[] = []

  if (daysToEvent < 7 && rsvpConfirmedPct < 0.7)
    alerts.push({ id: 'rsvp-low', severity: 'critical', title: 'RSVP confirmation low', message: `Only ${Math.round(rsvpConfirmedPct * 100)}% confirmed with ${daysToEvent}d to go`, module: 'guests' })
  if (budgetUsedPct > 0.9)
    alerts.push({ id: 'budget-high', severity: budgetUsedPct > 1 ? 'critical' : 'warning', title: budgetUsedPct > 1 ? 'Budget exceeded' : 'Budget near limit', message: `${Math.round(budgetUsedPct * 100)}% of budget committed`, module: 'finance' })
  if (daysToEvent < 14 && vendorsConfirmedPct < 0.8)
    alerts.push({ id: 'vendors-unconfirmed', severity: 'warning', title: 'Key vendors unconfirmed', message: `${Math.round((1 - vendorsConfirmedPct) * 100)}% of vendors haven't confirmed`, module: 'vendors' })

  return { score, grade, color, components, alerts }
}

// ─── Days-to-event urgency ────────────────────────────────────────────────────

export function getDaysUrgency(daysToEvent: number): 'green' | 'amber' | 'red' {
  if (daysToEvent > 30) return 'green'
  if (daysToEvent > 7) return 'amber'
  return 'red'
}

// ─── Budget burn rate predictor ───────────────────────────────────────────────

export function calcBudgetBurnRate({
  totalBudget,
  spentToDate,
  daysElapsed,
  totalDays,
}: {
  totalBudget: number
  spentToDate: number
  daysElapsed: number
  totalDays: number
}): { projectedFinal: number; overrunAmount: number; onTrack: boolean } {
  if (daysElapsed === 0) return { projectedFinal: 0, overrunAmount: 0, onTrack: true }
  const dailyRate = spentToDate / daysElapsed
  const projectedFinal = dailyRate * totalDays
  const overrunAmount = Math.max(0, projectedFinal - totalBudget)
  return { projectedFinal, overrunAmount, onTrack: overrunAmount === 0 }
}

// ─── Fuzzy duplicate detection (Levenshtein-based) ───────────────────────────

export function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)])
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[m][n]
}

export function isFuzzyDuplicate(nameA: string, nameB: string, threshold = 3): boolean {
  const a = nameA.toLowerCase().trim()
  const b = nameB.toLowerCase().trim()
  if (a === b) return true
  return levenshtein(a, b) <= threshold
}

// ─── Guest completeness score ─────────────────────────────────────────────────

export function calcGuestCompleteness(guest: {
  name?: string
  email?: string
  phone?: string
  dietary_requirement?: string
}): { score: number; missing: string[] } {
  const fields: Array<{ key: keyof typeof guest; label: string; weight: number }> = [
    { key: 'name', label: 'Name', weight: 30 },
    { key: 'email', label: 'Email', weight: 30 },
    { key: 'phone', label: 'Phone', weight: 30 },
    { key: 'dietary_requirement', label: 'Dietary info', weight: 10 },
  ]
  const missing: string[] = []
  let score = 0
  for (const f of fields) {
    if (guest[f.key]) score += f.weight
    else missing.push(f.label)
  }
  return { score, missing }
}

// ─── Headcount prediction ─────────────────────────────────────────────────────

export function predictHeadcount({
  confirmed,
  maybe,
  pending,
  declined,
}: { confirmed: number; maybe: number; pending: number; declined: number }): {
  pessimistic: number; realistic: number; optimistic: number
} {
  return {
    pessimistic: confirmed,
    realistic: Math.round(confirmed + maybe * 0.5 + pending * 0.2),
    optimistic: Math.round(confirmed + maybe * 0.8 + pending * 0.4),
  }
}

// ─── F&B auto-quantity ────────────────────────────────────────────────────────

const MEAL_MULTIPLIERS: Record<string, number> = {
  breakfast: 1.0,
  lunch: 1.0,
  dinner: 1.2,
  cocktails: 0.4,
  'hi-tea': 0.6,
  snacks: 0.5,
  buffet: 1.1,
}

export function calcFnbQuantity(guestCount: number, mealType: string, wastageBufferPct = 0.08): number {
  const multiplier = MEAL_MULTIPLIERS[mealType.toLowerCase()] ?? 1.0
  return Math.ceil(guestCount * multiplier * (1 + wastageBufferPct))
}

// ─── NPS calculation ──────────────────────────────────────────────────────────

export function calcNPS(scores: number[]): {
  nps: number; promoters: number; passives: number; detractors: number
} {
  if (!scores.length) return { nps: 0, promoters: 0, passives: 0, detractors: 0 }
  const promoters = scores.filter(s => s >= 9).length
  const passives = scores.filter(s => s >= 7 && s <= 8).length
  const detractors = scores.filter(s => s <= 6).length
  const total = scores.length
  return {
    nps: Math.round(((promoters - detractors) / total) * 100),
    promoters: Math.round((promoters / total) * 100),
    passives: Math.round((passives / total) * 100),
    detractors: Math.round((detractors / total) * 100),
  }
}

// ─── Sentiment scoring (keyword-based) ───────────────────────────────────────

const POSITIVE_WORDS = ['great', 'excellent', 'amazing', 'perfect', 'wonderful', 'fantastic', 'loved', 'brilliant', 'outstanding', 'superb', 'good', 'nice', 'helpful', 'smooth', 'impressed']
const NEGATIVE_WORDS = ['poor', 'bad', 'terrible', 'awful', 'disappointing', 'slow', 'rude', 'unprofessional', 'worst', 'horrible', 'pathetic', 'unacceptable', 'late', 'cold', 'dirty']

export function scoreSentiment(text: string): 'positive' | 'neutral' | 'negative' {
  const lower = text.toLowerCase()
  const pos = POSITIVE_WORDS.filter(w => lower.includes(w)).length
  const neg = NEGATIVE_WORDS.filter(w => lower.includes(w)).length
  if (pos > neg) return 'positive'
  if (neg > pos) return 'negative'
  return 'neutral'
}

// ─── GSTIN validator (India) ──────────────────────────────────────────────────

export function validateGSTIN(gstin: string): boolean {
  // Format: 2 digits state + 10 char PAN + 1 entity + Z + 1 check
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstin)
}

// ─── Vendor double-booking detection ─────────────────────────────────────────

export function hasVendorDoubleBooking(
  vendorId: string,
  eventStart: Date,
  eventEnd: Date,
  otherBookings: Array<{ vendorId: string; start: Date; end: Date }>,
): boolean {
  return otherBookings.some(b =>
    b.vendorId === vendorId &&
    b.start < eventEnd &&
    b.end > eventStart,
  )
}

// ─── Room over-allocation detector ───────────────────────────────────────────

export function detectRoomOverAllocation(
  assignments: Array<{ roomId: string; roomCapacity: number }>,
): string[] {
  const counts = new Map<string, { capacity: number; assigned: number }>()
  for (const a of assignments) {
    const e = counts.get(a.roomId) ?? { capacity: a.roomCapacity, assigned: 0 }
    e.assigned++
    counts.set(a.roomId, e)
  }
  return Array.from(counts.entries())
    .filter(([, { capacity, assigned }]) => assigned > capacity)
    .map(([id]) => id)
}

// ─── Occupancy % ─────────────────────────────────────────────────────────────

export function calcOccupancySeverity(current: number, capacity: number): 'green' | 'amber' | 'red' {
  const pct = current / capacity
  if (pct < 0.8) return 'green'
  if (pct < 1.0) return 'amber'
  return 'red'
}

// ─── Document expiry ──────────────────────────────────────────────────────────

export function docExpiryAlert(expiresAt: string | null): SmartAlertItem | null {
  if (!expiresAt) return null
  const days = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000)
  if (days < 0) return { id: `doc-expired-${expiresAt}`, severity: 'critical', title: 'Document expired', message: `Expired ${Math.abs(days)}d ago`, module: 'documents' }
  if (days <= 7) return { id: `doc-expiring-${expiresAt}`, severity: 'critical', title: 'Document expiring soon', message: `Expires in ${days}d`, module: 'documents' }
  if (days <= 30) return { id: `doc-expiry-30-${expiresAt}`, severity: 'warning', title: 'Document expiring', message: `Expires in ${days}d`, module: 'documents' }
  return null
}

// ─── Payment due alert ────────────────────────────────────────────────────────

export function paymentDueAlert(dueDate: string, amount: number): SmartAlertItem | null {
  const days = Math.ceil((new Date(dueDate).getTime() - Date.now()) / 86400000)
  const fmtAmt = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount)
  if (days < 0) return { id: `pmt-overdue-${dueDate}`, severity: 'critical', title: 'Payment overdue', message: `${fmtAmt} was due ${Math.abs(days)}d ago`, module: 'finance' }
  if (days <= 1) return { id: `pmt-due-1d-${dueDate}`, severity: 'critical', title: 'Payment due tomorrow', message: `${fmtAmt} due`, module: 'finance' }
  if (days <= 3) return { id: `pmt-due-3d-${dueDate}`, severity: 'warning', title: 'Payment due in 3 days', message: `${fmtAmt} due ${new Date(dueDate).toLocaleDateString('en-IN')}`, module: 'finance' }
  if (days <= 7) return { id: `pmt-due-7d-${dueDate}`, severity: 'info', title: 'Payment due this week', message: `${fmtAmt} due ${new Date(dueDate).toLocaleDateString('en-IN')}`, module: 'finance' }
  return null
}
