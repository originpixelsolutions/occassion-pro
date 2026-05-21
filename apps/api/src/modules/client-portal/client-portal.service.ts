import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common'
import { SupabaseService } from '../../common/supabase/supabase.service'
import { NotificationsService } from '../notifications/notifications.service'

@Injectable()
export class ClientPortalService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // ─── Portal Config ────────────────────────────────────────────────────────────

  async getPortalConfig(eventId: string, tenantId: string, token: string) {
    const { data, error } = await this.supabase.getAuthenticatedClient(token)
      .from('client_portal_configs')
      .select('*')
      .eq('event_id', eventId)
      .eq('tenant_id', tenantId)
      .single()
    if (error && error.code !== 'PGRST116') throw new BadRequestException(error.message)
    return data ?? null
  }

  async upsertPortalConfig(eventId: string, dto: any, tenantId: string, token: string) {
    const { data, error } = await this.supabase.getAuthenticatedClient(token)
      .from('client_portal_configs')
      .upsert(
        { ...dto, event_id: eventId, tenant_id: tenantId, updated_at: new Date().toISOString() },
        { onConflict: 'event_id' },
      )
      .select()
      .single()
    if (error) throw new BadRequestException(error.message)
    // Fire-and-forget: notify the client (by email) that their portal is ready
    if (data?.access_token && dto.client_email) {
      const portalUrl = `${process.env.APP_URL ?? 'https://app.occasionpro.com'}/portal/${data.access_token}`
      this.notificationsService.sendNotification({
        tenantId,
        recipientId: data.id,  // portal config id as opaque ref (contact overridden below)
        recipientType: 'client',
        templateKey: 'client_portal_access',
        variables: { portalUrl, eventId },
        eventId,
        contactEmail: dto.client_email as string,
      }).catch(() => {})
    }
    return data
  }

  async regenerateAccessToken(eventId: string, tenantId: string, token: string) {
    const { data, error } = await this.supabase.getAuthenticatedClient(token)
      .from('client_portal_configs')
      .update({
        access_token: Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex'),
        updated_at: new Date().toISOString(),
      })
      .eq('event_id', eventId)
      .eq('tenant_id', tenantId)
      .select('access_token')
      .single()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  // ─── Portal Dashboard (public via access token) ───────────────────────────────

  async getPortalByToken(accessToken: string) {
    // Use service-level access to validate token (no auth header from client)
    const { data: config, error } = await this.supabase.serviceClient
      .from('client_portal_configs')
      .select('*')
      .eq('access_token', accessToken)
      .eq('is_active', true)
      .single()
    if (error || !config) throw new ForbiddenException('Invalid or expired portal link')
    if (config.expires_at && new Date(config.expires_at) < new Date()) {
      throw new ForbiddenException('This portal link has expired')
    }

    // Fetch all portal data in parallel using service client (bypasses JWT)
    const client = this.supabase.serviceClient
    const eventId = config.event_id
    const tenantId = config.tenant_id

    const [event, updates, timeline, documents, moodboard, budget, messages] = await Promise.all([
      client.from('events').select('id,name,event_date,venue_name,status,cover_image_url').eq('id', eventId).single(),
      config.show_updates
        ? client.from('client_updates').select('*').eq('event_id', eventId).eq('is_published', true).order('is_pinned', { ascending: false }).order('published_at', { ascending: false }).limit(50)
        : Promise.resolve({ data: [] }),
      config.show_timeline
        ? client.from('client_timeline_items').select('*').eq('event_id', eventId).eq('visible_to_client', true).order('sort_order')
        : Promise.resolve({ data: [] }),
      config.show_documents
        ? client.from('client_documents').select('*').eq('event_id', eventId).eq('is_shared', true).order('created_at', { ascending: false })
        : Promise.resolve({ data: [] }),
      config.show_moodboard
        ? client.from('client_moodboard_items').select('*').eq('event_id', eventId).order('sort_order')
        : Promise.resolve({ data: [] }),
      config.show_budget
        ? client.from('client_budget_approvals').select('*').eq('event_id', eventId).order('sort_order')
        : Promise.resolve({ data: [] }),
      client.from('client_messages').select('*').eq('event_id', eventId).order('created_at'),
    ])

    const budgetData = budget.data ?? []
    const totalBudget = budgetData.reduce((s: number, b: any) => s + (b.estimated_amount ?? 0), 0)
    const approvedBudget = budgetData
      .filter((b: any) => b.status === 'approved')
      .reduce((s: number, b: any) => s + (b.estimated_amount ?? 0), 0)
    const pendingApprovals = budgetData.filter((b: any) => b.status === 'pending_approval').length
    const pendingDocApprovals = (documents.data ?? []).filter((d: any) => d.requires_approval && d.approval_status === 'pending').length
    const timelineItems = timeline.data ?? []
    const completedMilestones = timelineItems.filter((t: any) => t.status === 'completed').length

    return {
      config,
      event: event.data,
      stats: {
        total_budget: totalBudget,
        approved_budget: approvedBudget,
        pending_budget_approvals: pendingApprovals,
        pending_doc_approvals: pendingDocApprovals,
        timeline_progress: timelineItems.length > 0
          ? Math.round((completedMilestones / timelineItems.length) * 100)
          : 0,
        unread_updates: (updates.data ?? []).filter((u: any) => !u.client_read).length,
      },
      updates: updates.data ?? [],
      timeline: timeline.data ?? [],
      documents: documents.data ?? [],
      moodboard: moodboard.data ?? [],
      budget: budget.data ?? [],
      messages: messages.data ?? [],
    }
  }

  // ─── Updates ─────────────────────────────────────────────────────────────────

  async getUpdates(eventId: string, tenantId: string, token: string) {
    const { data, error } = await this.supabase.getAuthenticatedClient(token)
      .from('client_updates')
      .select('*, created_by:profiles(id, full_name, avatar_url)')
      .eq('event_id', eventId)
      .eq('tenant_id', tenantId)
      .order('is_pinned', { ascending: false })
      .order('published_at', { ascending: false })
    if (error) throw new BadRequestException(error.message)
    return data ?? []
  }

  async createUpdate(eventId: string, dto: any, tenantId: string, token: string, userId: string) {
    const { data, error } = await this.supabase.getAuthenticatedClient(token)
      .from('client_updates')
      .insert({ ...dto, event_id: eventId, tenant_id: tenantId, created_by: userId })
      .select()
      .single()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  async updateUpdate(id: string, dto: any, tenantId: string, token: string) {
    const { data, error } = await this.supabase.getAuthenticatedClient(token)
      .from('client_updates')
      .update({ ...dto, updated_at: new Date().toISOString() })
      .eq('id', id).eq('tenant_id', tenantId)
      .select().single()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  async deleteUpdate(id: string, tenantId: string, token: string) {
    const { error } = await this.supabase.getAuthenticatedClient(token)
      .from('client_updates').delete().eq('id', id).eq('tenant_id', tenantId)
    if (error) throw new BadRequestException(error.message)
    return { success: true }
  }

  // ─── Timeline ─────────────────────────────────────────────────────────────────

  async getTimeline(eventId: string, tenantId: string, token: string) {
    const { data, error } = await this.supabase.getAuthenticatedClient(token)
      .from('client_timeline_items')
      .select('*')
      .eq('event_id', eventId).eq('tenant_id', tenantId)
      .order('sort_order')
    if (error) throw new BadRequestException(error.message)
    return data ?? []
  }

  async upsertTimelineItem(eventId: string, dto: any, tenantId: string, token: string, userId: string) {
    const { data, error } = await this.supabase.getAuthenticatedClient(token)
      .from('client_timeline_items')
      .upsert(
        { ...dto, event_id: eventId, tenant_id: tenantId, created_by: userId, updated_at: new Date().toISOString() },
        { onConflict: 'id' },
      )
      .select().single()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  async completeTimelineItem(id: string, tenantId: string, token: string) {
    const { data, error } = await this.supabase.getAuthenticatedClient(token)
      .from('client_timeline_items')
      .update({ status: 'completed', completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', id).eq('tenant_id', tenantId)
      .select().single()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  async deleteTimelineItem(id: string, tenantId: string, token: string) {
    const { error } = await this.supabase.getAuthenticatedClient(token)
      .from('client_timeline_items').delete().eq('id', id).eq('tenant_id', tenantId)
    if (error) throw new BadRequestException(error.message)
    return { success: true }
  }

  // ─── Documents ────────────────────────────────────────────────────────────────

  async getDocuments(eventId: string, tenantId: string, token: string) {
    const { data, error } = await this.supabase.getAuthenticatedClient(token)
      .from('client_documents')
      .select('*, uploaded_by:profiles(id, full_name)')
      .eq('event_id', eventId).eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
    if (error) throw new BadRequestException(error.message)
    return data ?? []
  }

  async uploadDocument(eventId: string, dto: any, tenantId: string, token: string, userId: string) {
    const { data, error } = await this.supabase.getAuthenticatedClient(token)
      .from('client_documents')
      .insert({ ...dto, event_id: eventId, tenant_id: tenantId, uploaded_by: userId })
      .select().single()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  async approveDocument(id: string, dto: { approved_by_name: string; notes?: string }, tenantId: string, token: string) {
    const { data, error } = await this.supabase.getAuthenticatedClient(token)
      .from('client_documents')
      .update({
        approval_status: 'approved',
        approved_by_name: dto.approved_by_name,
        approved_at: new Date().toISOString(),
        client_notes: dto.notes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id).eq('tenant_id', tenantId)
      .select().single()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  async rejectDocument(id: string, dto: { reason: string }, tenantId: string, token: string) {
    const { data, error } = await this.supabase.getAuthenticatedClient(token)
      .from('client_documents')
      .update({
        approval_status: 'rejected',
        rejection_reason: dto.reason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id).eq('tenant_id', tenantId)
      .select().single()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  async requestRevision(id: string, dto: { notes: string }, tenantId: string, token: string) {
    const { data, error } = await this.supabase.getAuthenticatedClient(token)
      .from('client_documents')
      .update({ approval_status: 'revision_requested', client_notes: dto.notes, updated_at: new Date().toISOString() })
      .eq('id', id).eq('tenant_id', tenantId)
      .select().single()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  // ─── Mood Board ───────────────────────────────────────────────────────────────

  async getMoodboard(eventId: string, tenantId: string, token: string) {
    const { data, error } = await this.supabase.getAuthenticatedClient(token)
      .from('client_moodboard_items')
      .select('*')
      .eq('event_id', eventId).eq('tenant_id', tenantId)
      .order('sort_order')
    if (error) throw new BadRequestException(error.message)
    return data ?? []
  }

  async addMoodboardItem(eventId: string, dto: any, tenantId: string, token: string, userId: string) {
    const { data, error } = await this.supabase.getAuthenticatedClient(token)
      .from('client_moodboard_items')
      .insert({ ...dto, event_id: eventId, tenant_id: tenantId, added_by: userId })
      .select().single()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  async reactMoodboardItem(id: string, dto: { liked: boolean; note?: string }, tenantId: string, token: string) {
    const { data, error } = await this.supabase.getAuthenticatedClient(token)
      .from('client_moodboard_items')
      .update({ client_liked: dto.liked, client_note: dto.note, reacted_at: new Date().toISOString() })
      .eq('id', id).eq('tenant_id', tenantId)
      .select().single()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  async deleteMoodboardItem(id: string, tenantId: string, token: string) {
    const { error } = await this.supabase.getAuthenticatedClient(token)
      .from('client_moodboard_items').delete().eq('id', id).eq('tenant_id', tenantId)
    if (error) throw new BadRequestException(error.message)
    return { success: true }
  }

  // ─── Budget Approvals ─────────────────────────────────────────────────────────

  async getBudgetApprovals(eventId: string, tenantId: string, token: string) {
    const { data, error } = await this.supabase.getAuthenticatedClient(token)
      .from('client_budget_approvals')
      .select('*, vendor:vendors(id, company_name)')
      .eq('event_id', eventId).eq('tenant_id', tenantId)
      .order('sort_order')
    if (error) throw new BadRequestException(error.message)
    const items = data ?? []
    const total = items.reduce((s, b) => s + (b.estimated_amount ?? 0), 0)
    const approved = items.filter(b => b.status === 'approved').reduce((s, b) => s + (b.estimated_amount ?? 0), 0)
    const pending = items.filter(b => b.status === 'pending_approval').length
    return { items, summary: { total, approved, balance: total - approved, pending_count: pending } }
  }

  async upsertBudgetItem(eventId: string, dto: any, tenantId: string, token: string, userId: string) {
    const { data, error } = await this.supabase.getAuthenticatedClient(token)
      .from('client_budget_approvals')
      .upsert(
        { ...dto, event_id: eventId, tenant_id: tenantId, created_by: userId, updated_at: new Date().toISOString() },
        { onConflict: 'id' },
      )
      .select().single()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  async clientApproveBudgetItem(id: string, dto: { notes?: string }, tenantId: string, token: string) {
    const { data, error } = await this.supabase.getAuthenticatedClient(token)
      .from('client_budget_approvals')
      .update({ status: 'approved', client_approved_at: new Date().toISOString(), client_notes: dto.notes, updated_at: new Date().toISOString() })
      .eq('id', id).eq('tenant_id', tenantId)
      .select().single()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  async clientRejectBudgetItem(id: string, dto: { notes?: string }, tenantId: string, token: string) {
    const { data, error } = await this.supabase.getAuthenticatedClient(token)
      .from('client_budget_approvals')
      .update({ status: 'rejected', client_rejected_at: new Date().toISOString(), client_notes: dto.notes, updated_at: new Date().toISOString() })
      .eq('id', id).eq('tenant_id', tenantId)
      .select().single()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  // ─── Messages ─────────────────────────────────────────────────────────────────

  async getMessages(eventId: string, tenantId: string, token: string) {
    const { data, error } = await this.supabase.getAuthenticatedClient(token)
      .from('client_messages')
      .select('*')
      .eq('event_id', eventId).eq('tenant_id', tenantId)
      .order('created_at')
    if (error) throw new BadRequestException(error.message)
    return data ?? []
  }

  async sendMessage(eventId: string, dto: any, tenantId: string, token: string) {
    const { data, error } = await this.supabase.getAuthenticatedClient(token)
      .from('client_messages')
      .insert({ ...dto, event_id: eventId, tenant_id: tenantId })
      .select().single()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  async markMessagesRead(eventId: string, tenantId: string, token: string) {
    const { error } = await this.supabase.getAuthenticatedClient(token)
      .from('client_messages')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('event_id', eventId).eq('tenant_id', tenantId).eq('is_read', false)
    if (error) throw new BadRequestException(error.message)
    return { success: true }
  }

  // ─── Full Internal Dashboard ──────────────────────────────────────────────────

  async getInternalPortalDashboard(eventId: string, tenantId: string, token: string) {
    const client = this.supabase.getAuthenticatedClient(token)
    const [config, updates, timeline, documents, moodboard, budget, messages] = await Promise.all([
      client.from('client_portal_configs').select('*').eq('event_id', eventId).eq('tenant_id', tenantId).single(),
      client.from('client_updates').select('*').eq('event_id', eventId).eq('tenant_id', tenantId).order('published_at', { ascending: false }).limit(20),
      client.from('client_timeline_items').select('*').eq('event_id', eventId).eq('tenant_id', tenantId).order('sort_order'),
      client.from('client_documents').select('*').eq('event_id', eventId).eq('tenant_id', tenantId).order('created_at', { ascending: false }),
      client.from('client_moodboard_items').select('*').eq('event_id', eventId).eq('tenant_id', tenantId).order('sort_order'),
      client.from('client_budget_approvals').select('*').eq('event_id', eventId).eq('tenant_id', tenantId).order('sort_order'),
      client.from('client_messages').select('*').eq('event_id', eventId).eq('tenant_id', tenantId).order('created_at').limit(50),
    ])

    const budgetItems = budget.data ?? []
    const totalBudget = budgetItems.reduce((s: number, b: any) => s + (b.estimated_amount ?? 0), 0)
    const approvedBudget = budgetItems.filter((b: any) => b.status === 'approved').reduce((s: number, b: any) => s + (b.estimated_amount ?? 0), 0)
    const timelineItems = timeline.data ?? []
    const completed = timelineItems.filter((t: any) => t.status === 'completed').length

    return {
      config: config.data,
      stats: {
        timeline_progress: timelineItems.length > 0 ? Math.round((completed / timelineItems.length) * 100) : 0,
        total_budget: totalBudget,
        approved_budget: approvedBudget,
        pending_budget_approvals: budgetItems.filter((b: any) => b.status === 'pending_approval').length,
        pending_doc_approvals: (documents.data ?? []).filter((d: any) => d.requires_approval && d.approval_status === 'pending').length,
        moodboard_reactions: (moodboard.data ?? []).filter((m: any) => m.client_liked !== null).length,
        unread_messages: (messages.data ?? []).filter((m: any) => !m.is_read && m.sender_type === 'client').length,
      },
      updates: updates.data ?? [],
      timeline: timeline.data ?? [],
      documents: documents.data ?? [],
      moodboard: moodboard.data ?? [],
      budget: budgetItems,
      messages: messages.data ?? [],
    }
  }
}
