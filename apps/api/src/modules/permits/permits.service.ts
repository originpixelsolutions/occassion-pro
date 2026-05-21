import { Injectable } from '@nestjs/common'
import { SupabaseService } from '../../common/supabase/supabase.service'

@Injectable()
export class PermitsService {
  constructor(private readonly supabase: SupabaseService) {}

  // ── Permits ────────────────────────────────────────────────────────────────

  async listPermits(eventId: string, tenantId: string, token: string, opts?: {
    status?: string
    type?: string
    critical_only?: boolean
  }) {
    const db = this.supabase.forRequest(token)

    let q = db
      .from('event_permits')
      .select('*, assigned_to_profile:profiles!assigned_to(id,full_name,avatar_url)')
      .eq('event_id', eventId)
      .order('is_critical', { ascending: false })
      .order('expiry_date', { ascending: true, nullsFirst: false })

    if (opts?.status) q = q.eq('status', opts.status)
    if (opts?.type) q = q.eq('permit_type', opts.type)
    if (opts?.critical_only) q = q.eq('is_critical', true)

    const { data, error } = await q
    if (error) throw error
    return data
  }

  async getPermit(id: string, tenantId: string, token: string) {
    const db = this.supabase.forRequest(token)

    const { data, error } = await db
      .from('event_permits')
      .select('*, assigned_to_profile:profiles!assigned_to(id,full_name,avatar_url), created_by_profile:profiles!created_by(id,full_name)')
      .eq('id', id)
      .single()

    if (error) throw error
    return data
  }

  async createPermit(tenantId: string, token: string, body: {
    event_id: string
    permit_name: string
    permit_type: string
    permit_number?: string
    issuing_authority?: string
    jurisdiction?: string
    applied_date?: string
    issued_date?: string
    expiry_date?: string
    status?: string
    storage_type?: string
    document_url?: string
    file_name?: string
    file_size?: number
    is_critical?: boolean
    cost?: number
    currency?: string
    notes?: string
    assigned_to?: string
    created_by?: string
  }) {
    const db = this.supabase.forRequest(token)

    const { data, error } = await db
      .from('event_permits')
      .insert({ ...body, tenant_id: tenantId })
      .select()
      .single()

    if (error) throw error
    return data
  }

  async updatePermit(id: string, tenantId: string, token: string, body: Partial<{
    permit_name: string
    permit_type: string
    permit_number: string
    issuing_authority: string
    jurisdiction: string
    applied_date: string
    issued_date: string
    expiry_date: string
    status: string
    rejection_reason: string
    storage_type: string
    document_url: string
    file_name: string
    file_size: number
    is_critical: boolean
    cost: number
    currency: string
    notes: string
    assigned_to: string
    auto_reminder_days: number[]
  }>) {
    const db = this.supabase.forRequest(token)

    const { data, error } = await db
      .from('event_permits')
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  }

  async deletePermit(id: string, tenantId: string, token: string) {
    const db = this.supabase.forRequest(token)

    const { error } = await db.from('event_permits').delete().eq('id', id)
    if (error) throw error
    return { deleted: true }
  }

  // ── Smart Intelligence ─────────────────────────────────────────────────────

  async getPermitStats(eventId: string, tenantId: string, token: string) {
    const db = this.supabase.forRequest(token)

    const { data: permits, error } = await db
      .from('event_permits')
      .select('id,status,is_critical,expiry_date,permit_type')
      .eq('event_id', eventId)

    if (error) throw error

    const now = new Date()
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

    const total = permits.length
    const approved = permits.filter(p => p.status === 'approved').length
    const pending = permits.filter(p =>
      ['not_started', 'applied', 'under_review'].includes(p.status)
    ).length
    const expired = permits.filter(p => p.status === 'expired').length
    const rejected = permits.filter(p => p.status === 'rejected').length
    const criticalMissing = permits.filter(p =>
      p.is_critical && !['approved', 'not_required'].includes(p.status)
    ).length
    const expiringSoon = permits.filter(p => {
      if (!p.expiry_date) return false
      const exp = new Date(p.expiry_date)
      return exp >= now && exp <= in30Days
    }).length
    const expiringCritical = permits.filter(p => {
      if (!p.expiry_date || !p.is_critical) return false
      const exp = new Date(p.expiry_date)
      return exp >= now && exp <= in7Days
    }).length

    // Health score: starts at 100, deduct for issues
    let healthScore = 100
    if (total > 0) {
      healthScore -= (pending / total) * 30
      healthScore -= (expired / total) * 40
      healthScore -= criticalMissing * 15
      healthScore -= expiringSoon * 5
      healthScore = Math.max(0, Math.min(100, Math.round(healthScore)))
    }

    // Smart alerts
    const alerts: Array<{ type: string; severity: string; message: string }> = []

    if (criticalMissing > 0) {
      alerts.push({
        type: 'critical_missing',
        severity: 'high',
        message: `${criticalMissing} critical permit${criticalMissing > 1 ? 's' : ''} not yet approved — event cannot proceed without them`,
      })
    }
    if (expiringCritical > 0) {
      alerts.push({
        type: 'expiring_critical',
        severity: 'high',
        message: `${expiringCritical} critical permit${expiringCritical > 1 ? 's' : ''} expiring within 7 days — renew immediately`,
      })
    }
    if (expiringSoon > expiringCritical) {
      alerts.push({
        type: 'expiring_soon',
        severity: 'medium',
        message: `${expiringSoon} permit${expiringSoon > 1 ? 's' : ''} expiring within 30 days`,
      })
    }
    if (rejected > 0) {
      alerts.push({
        type: 'rejected',
        severity: 'medium',
        message: `${rejected} permit${rejected > 1 ? 's' : ''} rejected — review and re-apply`,
      })
    }

    return {
      total,
      approved,
      pending,
      expired,
      rejected,
      critical_missing: criticalMissing,
      expiring_soon: expiringSoon,
      expiring_critical: expiringCritical,
      health_score: healthScore,
      alerts,
    }
  }

  async getExpiryTimeline(eventId: string, tenantId: string, token: string) {
    const db = this.supabase.forRequest(token)

    const { data, error } = await db
      .from('event_permits')
      .select('id,permit_name,permit_type,expiry_date,status,is_critical')
      .eq('event_id', eventId)
      .not('expiry_date', 'is', null)
      .order('expiry_date', { ascending: true })

    if (error) throw error

    const now = new Date()
    return (data ?? []).map(p => {
      const exp = new Date(p.expiry_date)
      const daysUntil = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      return {
        ...p,
        days_until_expiry: daysUntil,
        urgency: daysUntil < 0 ? 'expired' : daysUntil <= 7 ? 'critical' : daysUntil <= 30 ? 'warning' : 'ok',
      }
    })
  }

  // ── Legal Documents ────────────────────────────────────────────────────────

  async listLegalDocs(eventId: string, tenantId: string, token: string) {
    const db = this.supabase.forRequest(token)

    const { data, error } = await db
      .from('event_legal_documents')
      .select('*')
      .eq('event_id', eventId)
      .order('is_critical', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) throw error
    return data
  }

  async createLegalDoc(tenantId: string, token: string, body: {
    event_id: string
    doc_type: string
    doc_name: string
    parties?: string[]
    storage_type?: string
    document_url?: string
    file_name?: string
    file_size?: number
    signature_status?: string
    signed_date?: string
    expiry_date?: string
    is_critical?: boolean
    notes?: string
    created_by?: string
  }) {
    const db = this.supabase.forRequest(token)

    const { data, error } = await db
      .from('event_legal_documents')
      .insert({ ...body, tenant_id: tenantId })
      .select()
      .single()

    if (error) throw error
    return data
  }

  async updateLegalDoc(id: string, tenantId: string, token: string, body: Record<string, unknown>) {
    const db = this.supabase.forRequest(token)

    const { data, error } = await db
      .from('event_legal_documents')
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  }

  async deleteLegalDoc(id: string, tenantId: string, token: string) {
    const db = this.supabase.forRequest(token)

    const { error } = await db.from('event_legal_documents').delete().eq('id', id)
    if (error) throw error
    return { deleted: true }
  }
}
