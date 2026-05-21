import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { SupabaseService } from '../../common/supabase/supabase.service'

@Injectable()
export class MarketingService {
  constructor(private readonly supabase: SupabaseService) {}

  private client(token: string) {
    return this.supabase.forRequest(token)
  }

  // ── Dashboard ──────────────────────────────────────────────────────────────

  async getDashboard(tenantId: string, token: string) {
    const db = this.client(token)

    const [leadsResult, campaignsResult, sourcesResult, postsResult, analyticsResult] = await Promise.all([
      db
        .from('marketing_leads')
        .select(`
          id, stage, lead_score, is_hot, is_converted, created_at,
          source:lead_sources(name, type),
          event_type, estimated_budget, assigned_to
        `)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false }),
      db
        .from('marketing_campaigns')
        .select('id, name, type, status, sent_count, opened_count, converted_count, budget, spent')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(10),
      db
        .from('lead_sources')
        .select('id, name, type')
        .eq('tenant_id', tenantId)
        .eq('is_active', true),
      db
        .from('social_posts')
        .select('id, content, platforms, status, scheduled_at, likes, impressions')
        .eq('tenant_id', tenantId)
        .order('scheduled_at', { ascending: true })
        .limit(10),
      db
        .from('marketing_analytics')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('snapshot_date', { ascending: false })
        .limit(30),
    ])

    const leads = leadsResult.data || []
    const campaigns = campaignsResult.data || []

    // Stage funnel
    const stageCounts = leads.reduce((acc: Record<string, number>, l) => {
      acc[l.stage] = (acc[l.stage] || 0) + 1
      return acc
    }, {})

    // Source breakdown
    const sourceMap = leads.reduce((acc: Record<string, number>, l) => {
      const src = (l.source as any)?.name || 'Unknown'
      acc[src] = (acc[src] || 0) + 1
      return acc
    }, {})

    // Event type breakdown
    const eventTypeMap = leads.reduce((acc: Record<string, number>, l) => {
      if (l.event_type) acc[l.event_type] = (acc[l.event_type] || 0) + 1
      return acc
    }, {})

    const totalLeads = leads.length
    const convertedLeads = leads.filter(l => l.is_converted).length
    const hotLeads = leads.filter(l => l.is_hot).length
    const avgScore = totalLeads > 0
      ? Math.round(leads.reduce((s, l) => s + l.lead_score, 0) / totalLeads)
      : 0
    const totalPipelineValue = leads
      .filter(l => !l.is_converted && l.stage !== 'lost')
      .reduce((s, l) => s + (l.estimated_budget || 0), 0)

    return {
      summary: {
        total_leads: totalLeads,
        converted: convertedLeads,
        hot_leads: hotLeads,
        avg_score: avgScore,
        pipeline_value: totalPipelineValue,
        conversion_rate: totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0,
      },
      funnel: stageCounts,
      by_source: sourceMap,
      by_event_type: eventTypeMap,
      recent_leads: leads.slice(0, 10),
      campaigns: campaigns.slice(0, 5),
      upcoming_posts: (postsResult.data || []).filter(p => p.status === 'scheduled').slice(0, 5),
      analytics: analyticsResult.data || [],
    }
  }

  // ── Leads ──────────────────────────────────────────────────────────────────

  async listLeads(tenantId: string, token: string, filters: {
    stage?: string
    is_hot?: boolean
    search?: string
    source_id?: string
    event_type?: string
    limit?: number
    offset?: number
  } = {}) {
    const db = this.client(token)
    let query = db
      .from('marketing_leads')
      .select(`
        *,
        source:lead_sources(name, type, utm_source),
        assignee:profiles!assigned_to(id, full_name, avatar_url)
      `)
      .eq('tenant_id', tenantId)
      .order('lead_score', { ascending: false })
      .order('created_at', { ascending: false })

    if (filters.stage) query = query.eq('stage', filters.stage)
    if (filters.is_hot !== undefined) query = query.eq('is_hot', filters.is_hot)
    if (filters.source_id) query = query.eq('source_id', filters.source_id)
    if (filters.event_type) query = query.eq('event_type', filters.event_type)
    if (filters.search) {
      query = query.or(
        `full_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`
      )
    }

    const limit = filters.limit || 50
    const offset = filters.offset || 0
    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query
    if (error) throw new BadRequestException(error.message)
    return { leads: data, total: count }
  }

  async getLead(id: string, tenantId: string, token: string) {
    const db = this.client(token)
    const [leadResult, activitiesResult] = await Promise.all([
      db
        .from('marketing_leads')
        .select(`
          *,
          source:lead_sources(*),
          assignee:profiles!assigned_to(id, full_name, avatar_url)
        `)
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .single(),
      db
        .from('lead_activities')
        .select('*, performer:profiles!performed_by(id, full_name, avatar_url)')
        .eq('lead_id', id)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(20),
    ])

    if (leadResult.error) throw new NotFoundException('Lead not found')
    return { ...leadResult.data, activities: activitiesResult.data || [] }
  }

  async upsertLead(dto: any, tenantId: string, token: string) {
    // Auto-score
    const score = this._calculateLeadScore(dto)
    const payload = {
      ...dto,
      tenant_id: tenantId,
      lead_score: score.total,
      score_breakdown: score.breakdown,
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await this.client(token)
      .from('marketing_leads')
      .upsert(payload, { onConflict: 'id' })
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)
    return data
  }

  async updateStage(id: string, stage: string, lostReason: string | undefined, tenantId: string, token: string) {
    const payload: any = {
      stage,
      stage_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    if (stage === 'won') { payload.is_converted = true; payload.converted_at = new Date().toISOString() }
    if (stage === 'lost' && lostReason) payload.lost_reason = lostReason

    const { data, error } = await this.client(token)
      .from('marketing_leads')
      .update(payload)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)

    // Log activity
    await this.client(token)
      .from('lead_activities')
      .insert({
        tenant_id: tenantId,
        lead_id: id,
        type: 'stage_change',
        subject: `Stage changed to ${stage}`,
        body: lostReason || undefined,
        metadata: { from_stage: 'previous', to_stage: stage },
      })

    return data
  }

  async addActivity(leadId: string, dto: any, tenantId: string, token: string, performedBy: string) {
    const { data, error } = await this.client(token)
      .from('lead_activities')
      .insert({
        ...dto,
        lead_id: leadId,
        tenant_id: tenantId,
        performed_by: performedBy,
      })
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)

    // Update last_contact_at
    await this.client(token)
      .from('marketing_leads')
      .update({
        last_contact_at: new Date().toISOString(),
        follow_up_count: (dto.type === 'follow_up' ? 1 : 0),
        next_follow_up: dto.next_action_at || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', leadId)

    return data
  }

  async bulkAssign(ids: string[], assignedTo: string, tenantId: string, token: string) {
    const { data, error } = await this.client(token)
      .from('marketing_leads')
      .update({
        assigned_to: assignedTo,
        assigned_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .in('id', ids)
      .eq('tenant_id', tenantId)
      .select()

    if (error) throw new BadRequestException(error.message)
    return { updated: data?.length || 0 }
  }

  // ── Lead Score Algorithm ───────────────────────────────────────────────────

  private _calculateLeadScore(dto: any): { total: number; breakdown: Record<string, number> } {
    const breakdown: Record<string, number> = {}

    // Budget (0–30)
    if (dto.estimated_budget >= 5000000) breakdown.budget = 30
    else if (dto.estimated_budget >= 1000000) breakdown.budget = 20
    else if (dto.estimated_budget >= 500000) breakdown.budget = 10
    else if (dto.estimated_budget > 0) breakdown.budget = 5
    else breakdown.budget = 0

    // Urgency: event date (0–20)
    if (dto.event_date) {
      const daysToEvent = Math.floor((new Date(dto.event_date).getTime() - Date.now()) / 86400000)
      if (daysToEvent <= 30) breakdown.urgency = 20
      else if (daysToEvent <= 90) breakdown.urgency = 15
      else if (daysToEvent <= 180) breakdown.urgency = 10
      else breakdown.urgency = 5
    } else breakdown.urgency = 0

    // Profile completeness (0–20)
    let completeness = 0
    if (dto.full_name) completeness += 4
    if (dto.email) completeness += 4
    if (dto.phone) completeness += 4
    if (dto.event_type) completeness += 4
    if (dto.guest_count) completeness += 4
    breakdown.completeness = completeness

    // Engagement / source quality (0–15)
    const sourceScores: Record<string, number> = {
      referral: 15, direct: 12, organic: 10, paid_search: 8, paid_social: 8,
      email: 6, whatsapp: 7, sms: 5, other: 3,
    }
    breakdown.source = sourceScores[dto.source_type] || 3

    // Guest count (0–15)
    if (dto.guest_count >= 500) breakdown.guest_count = 15
    else if (dto.guest_count >= 200) breakdown.guest_count = 10
    else if (dto.guest_count >= 50) breakdown.guest_count = 5
    else breakdown.guest_count = 2

    const total = Math.min(100, Object.values(breakdown).reduce((s, v) => s + v, 0))
    return { total, breakdown }
  }

  // ── Campaigns ──────────────────────────────────────────────────────────────

  async listCampaigns(tenantId: string, token: string, status?: string) {
    let query = this.client(token)
      .from('marketing_campaigns')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })

    if (status) query = query.eq('status', status)
    const { data, error } = await query
    if (error) throw new BadRequestException(error.message)
    return data
  }

  async getCampaign(id: string, tenantId: string, token: string) {
    const [campaignResult, messagesResult, recipientsResult] = await Promise.all([
      this.client(token)
        .from('marketing_campaigns')
        .select('*')
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .single(),
      this.client(token)
        .from('campaign_messages')
        .select('*')
        .eq('campaign_id', id)
        .eq('tenant_id', tenantId)
        .order('sequence_order'),
      this.client(token)
        .from('campaign_recipients')
        .select('id, status, contact_name, sent_at, opened_at')
        .eq('campaign_id', id)
        .eq('tenant_id', tenantId)
        .limit(100),
    ])

    if (campaignResult.error) throw new NotFoundException('Campaign not found')
    return {
      ...campaignResult.data,
      messages: messagesResult.data || [],
      recipients: recipientsResult.data || [],
    }
  }

  async upsertCampaign(dto: any, tenantId: string, token: string) {
    const payload = { ...dto, tenant_id: tenantId, updated_at: new Date().toISOString() }
    const { data, error } = await this.client(token)
      .from('marketing_campaigns')
      .upsert(payload, { onConflict: 'id' })
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)
    return data
  }

  async updateCampaignStatus(id: string, status: string, tenantId: string, token: string) {
    const { data, error } = await this.client(token)
      .from('marketing_campaigns')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)
    return data
  }

  async addCampaignMessage(campaignId: string, dto: any, tenantId: string, token: string) {
    const { data, error } = await this.client(token)
      .from('campaign_messages')
      .insert({ ...dto, campaign_id: campaignId, tenant_id: tenantId })
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)
    return data
  }

  async addRecipientsFromLeads(campaignId: string, leadIds: string[], tenantId: string, token: string) {
    // Fetch leads
    const { data: leads } = await this.client(token)
      .from('marketing_leads')
      .select('id, full_name, email, phone')
      .in('id', leadIds)
      .eq('tenant_id', tenantId)

    if (!leads) return { added: 0 }

    const inserts = leads
      .filter(l => !l.do_not_contact)
      .map(l => ({
        campaign_id: campaignId,
        lead_id: l.id,
        tenant_id: tenantId,
        contact_name: l.full_name,
        contact_email: l.email,
        contact_phone: l.phone,
      }))

    const { data, error } = await this.client(token)
      .from('campaign_recipients')
      .upsert(inserts, { onConflict: 'campaign_id,lead_id', ignoreDuplicates: true })
      .select()

    if (error) throw new BadRequestException(error.message)
    return { added: data?.length || 0 }
  }

  // ── Lead Sources ───────────────────────────────────────────────────────────

  async listSources(tenantId: string, token: string) {
    const { data, error } = await this.client(token)
      .from('lead_sources')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('name')

    if (error) throw new BadRequestException(error.message)
    return data
  }

  async upsertSource(dto: any, tenantId: string, token: string) {
    const { data, error } = await this.client(token)
      .from('lead_sources')
      .upsert({ ...dto, tenant_id: tenantId }, { onConflict: 'id' })
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)
    return data
  }

  // ── Lead Capture Forms ─────────────────────────────────────────────────────

  async listForms(tenantId: string, token: string) {
    const { data, error } = await this.client(token)
      .from('lead_capture_forms')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })

    if (error) throw new BadRequestException(error.message)
    return data
  }

  async upsertForm(dto: any, tenantId: string, token: string) {
    const { data, error } = await this.client(token)
      .from('lead_capture_forms')
      .upsert({ ...dto, tenant_id: tenantId }, { onConflict: 'id' })
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)
    return data
  }

  async submitForm(slug: string, submissionData: any) {
    // Public: uses serviceClient (no auth)
    const { data: form, error: formErr } = await this.supabase.serviceClient
      .from('lead_capture_forms')
      .select('id, tenant_id, source_id, fields')
      .eq('slug', slug)
      .eq('is_active', true)
      .single()

    if (formErr || !form) throw new NotFoundException('Form not found or inactive')

    // Auto-create lead from submission
    const leadPayload = {
      tenant_id: form.tenant_id,
      full_name: submissionData.full_name || submissionData.name || 'Unknown',
      email: submissionData.email,
      phone: submissionData.phone,
      event_type: submissionData.event_type,
      event_date: submissionData.event_date,
      estimated_budget: submissionData.budget ? Number(submissionData.budget) : null,
      guest_count: submissionData.guest_count ? Number(submissionData.guest_count) : null,
      requirements: submissionData.requirements,
      source_id: form.source_id,
      source_type: 'form',
      stage: 'new',
    }

    const score = this._calculateLeadScore(leadPayload)
    const { data: lead } = await this.supabase.serviceClient
      .from('marketing_leads')
      .insert({ ...leadPayload, lead_score: score.total, score_breakdown: score.breakdown })
      .select()
      .single()

    // Save raw submission
    await this.supabase.serviceClient
      .from('form_submissions')
      .insert({
        form_id: form.id,
        tenant_id: form.tenant_id,
        lead_id: lead?.id,
        data: submissionData,
        utm_data: submissionData.utm || {},
      })

    // Increment submission count
    await this.supabase.serviceClient
      .from('lead_capture_forms')
      .update({ submission_count: (form as any).submission_count + 1 })
      .eq('id', form.id)

    return { success: true, lead_id: lead?.id }
  }

  // ── Social Posts ───────────────────────────────────────────────────────────

  async listSocialPosts(tenantId: string, token: string, status?: string) {
    let query = this.client(token)
      .from('social_posts')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('scheduled_at')

    if (status) query = query.eq('status', status)
    const { data, error } = await query
    if (error) throw new BadRequestException(error.message)
    return data
  }

  async upsertSocialPost(dto: any, tenantId: string, token: string, userId: string) {
    const payload = { ...dto, tenant_id: tenantId, created_by: userId }
    const { data, error } = await this.client(token)
      .from('social_posts')
      .upsert(payload, { onConflict: 'id' })
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)
    return data
  }
}
