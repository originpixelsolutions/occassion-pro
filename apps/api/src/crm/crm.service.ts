import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { SupabaseService } from '../common/supabase/supabase.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  CreateLeadDto,
  UpdateLeadDto,
  CreateActivityDto,
  CreateProposalDto,
  LeadQueryDto,
  LeadStatus,
  ActivityType,
} from './dto/crm.dto';

@Injectable()
export class CrmService {
  private readonly logger = new Logger(CrmService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly notifications: NotificationsService,
  ) {}

  // ─── Leads ────────────────────────────────────────────────────────────────

  async createLead(tenantId: string, dto: CreateLeadDto, createdBy: string) {
    const client = this.supabase.serviceClient;

    // Auto-score the lead on creation
    const score = this.calculateLeadScore({
      budget_min: dto.budget_min,
      budget_max: dto.budget_max,
      guest_count: dto.guest_count,
      event_date: dto.event_date,
      source: dto.source,
    });

    const { data, error } = await client
      .from('leads')
      .insert({
        tenant_id: tenantId,
        ...dto,
        status: LeadStatus.NEW,
        score,
        created_by: createdBy,
        probability: 10,
      })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);

    // Log initial activity
    await this.logActivity(tenantId, {
      lead_id: data.id,
      type: ActivityType.NOTE,
      subject: 'Lead created',
      description: `Lead created from ${dto.source || 'unknown source'}`,
      is_completed: true,
    } as any, createdBy);

    // Notify assignee
    if (dto.assigned_to) {
      await this.notifications.create(tenantId, {
        user_id: dto.assigned_to,
        type: 'lead_assigned',
        title: 'New lead assigned to you',
        body: `${dto.client_name} — ${dto.event_type || 'Event'} enquiry`,
        data: { leadId: data.id },
      } as any);
    }

    return data;
  }

  async getLeads(tenantId: string, query: LeadQueryDto) {
    const client = this.supabase.serviceClient;

    let q = client
      .from('leads')
      .select(
        `
        id, client_name, client_email, client_phone, company_name,
        event_type, event_date, budget_min, budget_max, guest_count,
        status, score, deal_value, probability, source,
        expected_close_date, assigned_to, created_at, updated_at,
        team_members!leads_assigned_to_fkey(users(full_name, avatar_url))
      `,
        { count: 'exact' },
      )
      .eq('tenant_id', tenantId);

    if (query.status) q = q.eq('status', query.status);
    if (query.source) q = q.eq('source', query.source);
    if (query.assigned_to) q = q.eq('assigned_to', query.assigned_to);
    if (query.search) {
      q = q.or(
        `client_name.ilike.%${query.search}%,client_email.ilike.%${query.search}%,company_name.ilike.%${query.search}%`,
      );
    }

    const from = ((query.page ?? 1) - 1) * (query.limit ?? 20);
    const to = from + (query.limit ?? 20) - 1;

    const { data, error, count } = await q
      .order(query.sort_by ?? 'created_at', { ascending: query.sort_order === 'asc' })
      .range(from, to);

    if (error) throw new BadRequestException(error.message);

    return {
      data,
      meta: {
        total: count ?? 0,
        page: query.page ?? 1,
        limit: query.limit ?? 20,
        total_pages: Math.ceil((count ?? 0) / (query.limit ?? 20)),
      },
    };
  }

  async getLead(tenantId: string, leadId: string) {
    const client = this.supabase.serviceClient;
    const { data, error } = await client
      .from('leads')
      .select(`
        *,
        team_members!leads_assigned_to_fkey(users(full_name, avatar_url, email)),
        activities(*, team_members(users(full_name))),
        proposals(id, title, total_amount, status, created_at)
      `)
      .eq('id', leadId)
      .eq('tenant_id', tenantId)
      .single();

    if (error || !data) throw new NotFoundException('Lead not found');
    return data;
  }

  async updateLead(tenantId: string, leadId: string, dto: UpdateLeadDto, updatedBy: string) {
    const client = this.supabase.serviceClient;

    // Get current lead state
    const { data: current } = await client
      .from('leads')
      .select('status, score, deal_value')
      .eq('id', leadId)
      .eq('tenant_id', tenantId)
      .single();

    if (!current) throw new NotFoundException('Lead not found');

    const { data, error } = await client
      .from('leads')
      .update({ ...dto, updated_at: new Date().toISOString() })
      .eq('id', leadId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);

    // Log status change in activity
    if (dto.status && dto.status !== current.status) {
      await this.logActivity(tenantId, {
        lead_id: leadId,
        type: ActivityType.NOTE,
        subject: `Status changed: ${current.status} → ${dto.status}`,
        description: dto.loss_reason ? `Loss reason: ${dto.loss_reason}` : undefined,
        is_completed: true,
      } as any, updatedBy);

      // Handle won/lost notifications
      if (dto.status === LeadStatus.WON) {
        await this.handleLeadWon(tenantId, data);
      }
    }

    return data;
  }

  // ─── Lead Scoring ─────────────────────────────────────────────────────────

  private calculateLeadScore(data: {
    budget_min?: number;
    budget_max?: number;
    guest_count?: number;
    event_date?: string;
    source?: string;
  }): number {
    let score = 0;

    // Budget score (0–30 pts)
    const avgBudget = ((data.budget_min ?? 0) + (data.budget_max ?? 0)) / 2;
    if (avgBudget >= 5_000_000) score += 30;        // 50L+
    else if (avgBudget >= 1_000_000) score += 20;   // 10L+
    else if (avgBudget >= 300_000) score += 10;     // 3L+
    else if (avgBudget > 0) score += 5;

    // Guest count (0–20 pts)
    if ((data.guest_count ?? 0) >= 1000) score += 20;
    else if ((data.guest_count ?? 0) >= 500) score += 15;
    else if ((data.guest_count ?? 0) >= 200) score += 10;
    else if ((data.guest_count ?? 0) >= 50) score += 5;

    // Timeline urgency (0–20 pts)
    if (data.event_date) {
      const daysUntilEvent = Math.ceil(
        (new Date(data.event_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      );
      if (daysUntilEvent <= 30) score += 20;        // Very urgent
      else if (daysUntilEvent <= 90) score += 15;   // Urgent
      else if (daysUntilEvent <= 180) score += 10;  // Near-term
      else if (daysUntilEvent <= 365) score += 5;   // Long-term
    }

    // Source quality (0–30 pts)
    const sourceScores: Record<string, number> = {
      referral: 30,
      partner: 25,
      website: 20,
      microsite: 20,
      social_media: 10,
      cold_outreach: 5,
      event: 15,
      other: 5,
    };
    score += sourceScores[data.source ?? 'other'] ?? 5;

    return Math.min(100, score);
  }

  async rescoreLeads(tenantId: string) {
    const client = this.supabase.serviceClient;
    const { data: leads } = await client
      .from('leads')
      .select('id, budget_min, budget_max, guest_count, event_date, source')
      .eq('tenant_id', tenantId)
      .in('status', [LeadStatus.NEW, LeadStatus.CONTACTED, LeadStatus.QUALIFIED]);

    if (!leads) return;

    const updates = leads.map((lead) => ({
      id: lead.id,
      score: this.calculateLeadScore(lead),
    }));

    for (const update of updates) {
      await client.from('leads').update({ score: update.score }).eq('id', update.id);
    }

    return { rescored: updates.length };
  }

  // ─── Activities ───────────────────────────────────────────────────────────

  async logActivity(tenantId: string, dto: CreateActivityDto, userId: string) {
    const client = this.supabase.serviceClient;

    const { data, error } = await client
      .from('lead_activities')
      .insert({
        tenant_id: tenantId,
        ...dto,
        created_by: userId,
        is_completed: dto.is_completed ?? false,
      })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);

    // Update lead's last_activity_at
    await client
      .from('leads')
      .update({ last_activity_at: new Date().toISOString() })
      .eq('id', dto.lead_id)
      .eq('tenant_id', tenantId);

    return data;
  }

  async getActivities(tenantId: string, leadId: string) {
    const client = this.supabase.serviceClient;
    const { data, error } = await client
      .from('lead_activities')
      .select('*, team_members(users(full_name, avatar_url))')
      .eq('lead_id', leadId)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async scheduleFollowUp(tenantId: string, dto: { lead_id: string; follow_up_date: string; type: ActivityType; subject: string; notes?: string }, userId: string) {
    return this.logActivity(
      tenantId,
      {
        lead_id: dto.lead_id,
        type: dto.type,
        subject: dto.subject,
        description: dto.notes,
        scheduled_at: dto.follow_up_date,
        is_completed: false,
      } as CreateActivityDto,
      userId,
    );
  }

  async getDueFollowUps(tenantId: string, userId: string) {
    const client = this.supabase.serviceClient;
    const { data, error } = await client
      .from('lead_activities')
      .select('*, leads(client_name, event_type, status)')
      .eq('tenant_id', tenantId)
      .eq('created_by', userId)
      .eq('is_completed', false)
      .lte('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: true });

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  // ─── Proposals ────────────────────────────────────────────────────────────

  async createProposal(tenantId: string, dto: CreateProposalDto, createdBy: string) {
    const client = this.supabase.serviceClient;

    // Calculate total from line items if not provided
    const total_amount =
      dto.total_amount ??
      (dto.line_items?.reduce((sum, item) => sum + item.quantity * item.unit_price, 0) ?? 0);

    const { data, error } = await client
      .from('proposals')
      .insert({
        tenant_id: tenantId,
        lead_id: dto.lead_id,
        title: dto.title,
        total_amount,
        valid_until: dto.valid_until,
        line_items: dto.line_items ?? [],
        terms: dto.terms,
        notes: dto.notes,
        status: 'draft',
        created_by: createdBy,
        version: 1,
      })
      .select()
      .single();

    if (error) throw new BadRequestException(error.message);

    // Update lead status
    await client
      .from('leads')
      .update({
        status: LeadStatus.PROPOSAL_SENT,
        deal_value: total_amount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', dto.lead_id)
      .eq('tenant_id', tenantId);

    return data;
  }

  async getProposals(tenantId: string, leadId: string) {
    const client = this.supabase.serviceClient;
    const { data, error } = await client
      .from('proposals')
      .select('*')
      .eq('lead_id', leadId)
      .eq('tenant_id', tenantId)
      .order('version', { ascending: false });

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  // ─── Analytics ────────────────────────────────────────────────────────────

  async getPipelineStats(tenantId: string) {
    const client = this.supabase.serviceClient;
    const { data, error } = await client
      .from('leads')
      .select('status, deal_value, score, created_at')
      .eq('tenant_id', tenantId);

    if (error) throw new BadRequestException(error.message);

    const stats: Record<string, { count: number; total_value: number; avg_score: number }> = {};

    for (const lead of data ?? []) {
      if (!stats[lead.status]) {
        stats[lead.status] = { count: 0, total_value: 0, avg_score: 0 };
      }
      stats[lead.status].count++;
      stats[lead.status].total_value += lead.deal_value ?? 0;
      stats[lead.status].avg_score += lead.score ?? 0;
    }

    // Average the scores
    for (const s of Object.values(stats)) {
      s.avg_score = s.count > 0 ? Math.round(s.avg_score / s.count) : 0;
    }

    const wonLeads = data?.filter((l) => l.status === LeadStatus.WON) ?? [];
    const lostLeads = data?.filter((l) => l.status === LeadStatus.LOST) ?? [];
    const winRate =
      wonLeads.length + lostLeads.length > 0
        ? Math.round((wonLeads.length / (wonLeads.length + lostLeads.length)) * 100)
        : 0;

    const totalPipelineValue = (data ?? [])
      .filter((l) => ![LeadStatus.WON, LeadStatus.LOST].includes(l.status as LeadStatus))
      .reduce((sum, l) => sum + (l.deal_value ?? 0), 0);

    return {
      by_status: stats,
      win_rate: winRate,
      total_pipeline_value: totalPipelineValue,
      total_won_value: wonLeads.reduce((s, l) => s + (l.deal_value ?? 0), 0),
      total_leads: data?.length ?? 0,
    };
  }

  async getConversionFunnel(tenantId: string, days = 30) {
    const client = this.supabase.serviceClient;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { data } = await client
      .from('leads')
      .select('status')
      .eq('tenant_id', tenantId)
      .gte('created_at', since);

    const stages = [
      LeadStatus.NEW,
      LeadStatus.CONTACTED,
      LeadStatus.QUALIFIED,
      LeadStatus.PROPOSAL_SENT,
      LeadStatus.NEGOTIATION,
      LeadStatus.WON,
    ];

    const counts = stages.map((stage) => ({
      stage,
      count: data?.filter((l) => l.status === stage).length ?? 0,
    }));

    return counts;
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private async handleLeadWon(tenantId: string, lead: any) {
    this.logger.log(`Lead won: ${lead.id} — ${lead.client_name} (value: ${lead.deal_value})`);
    // Could auto-create event, send congratulations email, update team leaderboard, etc.
  }
}
