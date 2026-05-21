import { Injectable } from '@nestjs/common'
import { SupabaseService } from '../../common/supabase/supabase.service'

@Injectable()
export class MediaService {
  constructor(private readonly supabase: SupabaseService) {}

  private ctx(token: string) {
    return this.supabase.forRequest(token)
  }

  // ── Shot Lists ─────────────────────────────────────────────────────────────

  async listShotList(eventId: string, tenantId: string, token: string, category?: string) {
    const db = this.ctx(token)
    let q = db
      .from('event_shot_lists')
      .select('*')
      .eq('event_id', eventId)
      .order('sort_order', { ascending: true })
      .order('priority', { ascending: true })

    if (category) q = q.eq('category', category)
    const { data, error } = await q
    if (error) throw error
    return data
  }

  async createShot(tenantId: string, token: string, body: Record<string, unknown>) {
    const db = this.ctx(token)
    const { data, error } = await db
      .from('event_shot_lists')
      .insert({ ...body, tenant_id: tenantId })
      .select().single()
    if (error) throw error
    return data
  }

  async updateShot(id: string, tenantId: string, token: string, body: Record<string, unknown>) {
    const db = this.ctx(token)
    const { data, error } = await db
      .from('event_shot_lists')
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', id).select().single()
    if (error) throw error
    return data
  }

  async toggleShot(id: string, tenantId: string, token: string, completed: boolean) {
    const db = this.ctx(token)
    const { data, error } = await db
      .from('event_shot_lists')
      .update({
        is_completed: completed,
        completed_at: completed ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id).select().single()
    if (error) throw error
    return data
  }

  async deleteShot(id: string, tenantId: string, token: string) {
    const db = this.ctx(token)
    const { error } = await db.from('event_shot_lists').delete().eq('id', id)
    if (error) throw error
    return { deleted: true }
  }

  // ── Deliverables ───────────────────────────────────────────────────────────

  async listDeliverables(eventId: string, tenantId: string, token: string, opts?: {
    category?: string
    status?: string
  }) {
    const db = this.ctx(token)
    let q = db
      .from('media_deliverables')
      .select('*, vendor:vendors(id,name)')
      .eq('event_id', eventId)
      .order('delivery_deadline', { ascending: true, nullsFirst: false })

    if (opts?.category) q = q.eq('media_category', opts.category)
    if (opts?.status) q = q.eq('status', opts.status)

    const { data, error } = await q
    if (error) throw error
    return data
  }

  async createDeliverable(tenantId: string, token: string, body: Record<string, unknown>) {
    const db = this.ctx(token)
    // Auto-detect WeTransfer
    const url = (body.media_url as string) ?? ''
    const isWT = url.includes('wetransfer.com') || url.includes('we.tl/')
    const { data, error } = await db
      .from('media_deliverables')
      .insert({ ...body, tenant_id: tenantId, is_wetransfer: isWT })
      .select().single()
    if (error) throw error
    return data
  }

  async updateDeliverable(id: string, tenantId: string, token: string, body: Record<string, unknown>) {
    const db = this.ctx(token)
    const url = (body.media_url as string) ?? ''
    const updates: Record<string, unknown> = { ...body, updated_at: new Date().toISOString() }
    if (url) updates.is_wetransfer = url.includes('wetransfer.com') || url.includes('we.tl/')
    const { data, error } = await db
      .from('media_deliverables')
      .update(updates)
      .eq('id', id).select().single()
    if (error) throw error
    return data
  }

  async approveDeliverable(id: string, tenantId: string, token: string, body: {
    status: string
    revision_notes?: string
    approved_by?: string
  }) {
    const db = this.ctx(token)
    const updates: Record<string, unknown> = {
      status: body.status,
      updated_at: new Date().toISOString(),
    }
    if (body.status === 'approved') {
      updates.approved_by = body.approved_by
      updates.approved_at = new Date().toISOString()
    }
    if (body.revision_notes) updates.revision_notes = body.revision_notes
    const { data, error } = await db
      .from('media_deliverables')
      .update(updates)
      .eq('id', id).select().single()
    if (error) throw error
    return data
  }

  async deleteDeliverable(id: string, tenantId: string, token: string) {
    const db = this.ctx(token)
    const { error } = await db.from('media_deliverables').delete().eq('id', id)
    if (error) throw error
    return { deleted: true }
  }

  // ── Smart Stats ────────────────────────────────────────────────────────────

  async getStats(eventId: string, tenantId: string, token: string) {
    const db = this.ctx(token)

    const [{ data: shots }, { data: deliverables }] = await Promise.all([
      db.from('event_shot_lists').select('id,is_completed,priority').eq('event_id', eventId),
      db.from('media_deliverables').select('id,status,is_wetransfer,wetransfer_expiry,delivery_deadline').eq('event_id', eventId),
    ])

    const now = new Date()
    const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)

    const totalShots = shots?.length ?? 0
    const completedShots = shots?.filter(s => s.is_completed).length ?? 0
    const mustHaveRemaining = shots?.filter(s => s.priority === 'must_have' && !s.is_completed).length ?? 0

    const totalDeliverables = deliverables?.length ?? 0
    const approved = deliverables?.filter(d => d.status === 'approved').length ?? 0
    const pending = deliverables?.filter(d => ['pending', 'uploaded_by_vendor', 'under_review'].includes(d.status)).length ?? 0
    const revisionRequested = deliverables?.filter(d => d.status === 'revision_requested').length ?? 0

    // WeTransfer expiry alerts
    const wtExpiring = (deliverables ?? []).filter(d => {
      if (!d.is_wetransfer || !d.wetransfer_expiry) return false
      const exp = new Date(d.wetransfer_expiry)
      return exp >= now && exp <= in3Days
    })
    const wtExpired = (deliverables ?? []).filter(d => {
      if (!d.is_wetransfer || !d.wetransfer_expiry) return false
      return new Date(d.wetransfer_expiry) < now
    })

    // Overdue deliverables
    const overdueDeliverables = (deliverables ?? []).filter(d => {
      if (!d.delivery_deadline || d.status === 'approved' || d.status === 'delivered_to_client') return false
      return new Date(d.delivery_deadline) < now
    })

    const alerts: Array<{ severity: string; message: string }> = []

    if (wtExpired.length > 0) {
      alerts.push({ severity: 'high', message: `${wtExpired.length} WeTransfer link${wtExpired.length > 1 ? 's have' : ' has'} expired — request new links from your photographer/videographer` })
    }
    if (wtExpiring.length > 0) {
      alerts.push({ severity: 'high', message: `${wtExpiring.length} WeTransfer link${wtExpiring.length > 1 ? 's' : ''} expiring within 3 days — download immediately` })
    }
    if (overdueDeliverables.length > 0) {
      alerts.push({ severity: 'medium', message: `${overdueDeliverables.length} deliverable${overdueDeliverables.length > 1 ? 's are' : ' is'} past the delivery deadline` })
    }
    if (mustHaveRemaining > 0) {
      alerts.push({ severity: 'medium', message: `${mustHaveRemaining} must-have shot${mustHaveRemaining > 1 ? 's' : ''} not yet captured` })
    }
    if (revisionRequested > 0) {
      alerts.push({ severity: 'low', message: `${revisionRequested} deliverable${revisionRequested > 1 ? 's have' : ' has'} revision requests pending` })
    }

    return {
      total_shots: totalShots,
      completed_shots: completedShots,
      shot_completion_pct: totalShots > 0 ? Math.round((completedShots / totalShots) * 100) : 0,
      must_have_remaining: mustHaveRemaining,
      total_deliverables: totalDeliverables,
      approved,
      pending,
      revision_requested: revisionRequested,
      wt_expiring: wtExpiring.length,
      wt_expired: wtExpired.length,
      overdue_deliverables: overdueDeliverables.length,
      alerts,
    }
  }
}
