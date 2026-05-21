import {
  Injectable, NotFoundException, ForbiddenException, BadRequestException,
} from '@nestjs/common'
import { SupabaseService } from '../../common/supabase/supabase.service'

export interface UpsertPlanDto {
  title?: string
  crowd_capacity?: number
  venue_area_sqm?: number
  expected_attendance?: number
  medical_team_count?: number
  security_team_count?: number
  first_aid_kits?: number
  aed_units?: number
  fire_extinguishers?: number
  emergency_exits?: number
  nearest_hospital?: string
  hospital_distance_km?: number
  emergency_contact_name?: string
  emergency_contact_phone?: string
  ambulance_on_site?: boolean
  police_liaison_name?: string
  police_liaison_phone?: string
  weather_contingency?: string
  evacuation_plan_url?: string
  notes?: string
}

export interface CreateRiskDto {
  category: string
  hazard: string
  who_affected?: string
  likelihood: number
  severity: number
  mitigation: string
  residual_likelihood?: number
  residual_severity?: number
  owner?: string
  status?: string
  review_date?: string
  notes?: string
}

export interface CreateIncidentDto {
  incident_type: string
  title: string
  description: string
  severity: string
  occurred_at: string
  location?: string
  injured_count?: number
  hospitalized?: boolean
  reported_by?: string
  action_taken?: string
  follow_up?: string
  police_report?: boolean
  police_ref_no?: string
}

export interface CreateChecklistDto {
  title: string
  category?: string
  due_date?: string
  assigned_to?: string
  items?: string[]
}

@Injectable()
export class HealthSafetyService {
  constructor(private readonly supa: SupabaseService) {}

  private get db() { return this.supa.serviceClient }

  private readonly DEFAULT_CHECKLISTS = [
    {
      title: 'Venue Safety Walkthrough', category: 'venue',
      items: [
        'All emergency exits clearly marked and unobstructed',
        'Fire extinguishers inspected and accessible',
        'First aid kits stocked and positioned at key points',
        'Electrical panels and cables secured',
        'Stage/structure load calculations verified',
        'Crowd barriers positioned per plan',
        'Accessible routes for persons with disabilities confirmed',
      ],
    },
    {
      title: 'Medical Readiness', category: 'medical',
      items: [
        'Medical team on-site and briefed',
        'AED units placed and staff trained',
        'Nearest hospital route confirmed',
        'Ambulance / EMS on standby (if required)',
        'Medical waste disposal arranged',
        'Allergen information shared with F&B team',
      ],
    },
    {
      title: 'Security Briefing', category: 'security',
      items: [
        'Security team briefed on access control zones',
        'Bag/ticket check procedures confirmed',
        'CCTV coverage verified',
        'Radio communication channels assigned',
        'Police liaison contact confirmed',
        'VIP security detail coordinated',
      ],
    },
    {
      title: 'Fire Safety Checks', category: 'fire_safety',
      items: [
        'Fire alarm system tested',
        'Sprinkler system operational',
        'Pyrotechnics permit obtained and stored',
        'No-smoking zones enforced',
        'Evacuation drill completed with staff',
        'Fire marshal stations assigned',
      ],
    },
  ]

  // ── PLAN ──────────────────────────────────────────────────────────────────

  async getOrCreatePlan(eventId: string, tenantId: string, userId: string): Promise<any> {
    const { data: existing } = await this.db
      .from('health_safety_plans')
      .select('*')
      .eq('event_id', eventId)
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (existing) return existing

    const { data: plan, error } = await this.db
      .from('health_safety_plans')
      .insert({ event_id: eventId, tenant_id: tenantId, created_by: userId, title: 'Health & Safety Plan' })
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)

    await this.seedDefaultChecklists(plan.id, eventId, tenantId)
    return plan
  }

  private async seedDefaultChecklists(planId: string, eventId: string, tenantId: string) {
    for (let i = 0; i < this.DEFAULT_CHECKLISTS.length; i++) {
      const tmpl = this.DEFAULT_CHECKLISTS[i]
      const { data: cl } = await this.db
        .from('hs_checklists')
        .insert({ plan_id: planId, event_id: eventId, tenant_id: tenantId, title: tmpl.title, category: tmpl.category, sort_order: i })
        .select().single()

      if (cl) {
        const items = tmpl.items.map((text, idx) => ({ checklist_id: cl.id, text, sort_order: idx }))
        await this.db.from('hs_checklist_items').insert(items)
      }
    }
  }

  async updatePlan(eventId: string, tenantId: string, dto: UpsertPlanDto): Promise<any> {
    const plan = await this.requirePlan(eventId, tenantId)
    const { data, error } = await this.db
      .from('health_safety_plans').update(dto).eq('id', plan.id).select().single()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  async approvePlan(eventId: string, tenantId: string, userId: string): Promise<any> {
    const plan = await this.requirePlan(eventId, tenantId)
    const { data, error } = await this.db
      .from('health_safety_plans')
      .update({ status: 'approved', approved_by: userId, approved_at: new Date().toISOString() })
      .eq('id', plan.id).select().single()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  private async requirePlan(eventId: string, tenantId: string): Promise<any> {
    const { data } = await this.db
      .from('health_safety_plans').select('*')
      .eq('event_id', eventId).eq('tenant_id', tenantId).maybeSingle()
    if (!data) throw new NotFoundException('H&S plan not found. Visit the safety page first.')
    return data
  }

  async getPlanSummary(eventId: string, tenantId: string): Promise<any> {
    const plan = await this.requirePlan(eventId, tenantId)

    const [risksRes, incidentsRes, checklistsRes] = await Promise.all([
      this.db.from('hs_risk_assessments').select('id,risk_level,status').eq('plan_id', plan.id),
      this.db.from('hs_incidents').select('id,severity,status').eq('plan_id', plan.id),
      this.db.from('hs_checklists').select('id,status,hs_checklist_items(id,is_checked)').eq('plan_id', plan.id),
    ])

    const risks = risksRes.data ?? []
    const incidents = incidentsRes.data ?? []
    const checklists = checklistsRes.data ?? []

    const totalItems = checklists.reduce((s: number, c: any) => s + (c.hs_checklist_items?.length ?? 0), 0)
    const checkedItems = checklists.reduce(
      (s: number, c: any) => s + (c.hs_checklist_items?.filter((i: any) => i.is_checked)?.length ?? 0), 0
    )

    return {
      plan,
      stats: {
        risks_total: risks.length,
        risks_critical: risks.filter((r: any) => r.risk_level === 'critical').length,
        risks_open: risks.filter((r: any) => r.status === 'open').length,
        incidents_total: incidents.length,
        incidents_open: incidents.filter((i: any) => i.status !== 'closed').length,
        checklist_total_items: totalItems,
        checklist_checked_items: checkedItems,
        checklist_pct: totalItems > 0 ? Math.round((checkedItems / totalItems) * 100) : 0,
      },
    }
  }

  // ── RISKS ─────────────────────────────────────────────────────────────────

  async listRisks(eventId: string, tenantId: string): Promise<any[]> {
    const plan = await this.requirePlan(eventId, tenantId)
    const { data, error } = await this.db
      .from('hs_risk_assessments').select('*').eq('plan_id', plan.id)
      .order('risk_score', { ascending: false })
    if (error) throw new BadRequestException(error.message)
    return data ?? []
  }

  async createRisk(eventId: string, tenantId: string, userId: string, dto: CreateRiskDto): Promise<any> {
    const plan = await this.requirePlan(eventId, tenantId)
    const { data, error } = await this.db
      .from('hs_risk_assessments')
      .insert({ ...dto, plan_id: plan.id, event_id: eventId, tenant_id: tenantId, created_by: userId })
      .select().single()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  async updateRisk(id: string, tenantId: string, dto: Partial<CreateRiskDto>): Promise<any> {
    const { data, error } = await this.db
      .from('hs_risk_assessments').update(dto).eq('id', id).eq('tenant_id', tenantId).select().single()
    if (error) throw new BadRequestException(error.message)
    if (!data) throw new NotFoundException('Risk not found')
    return data
  }

  async deleteRisk(id: string, tenantId: string): Promise<void> {
    const { error } = await this.db
      .from('hs_risk_assessments').delete().eq('id', id).eq('tenant_id', tenantId)
    if (error) throw new BadRequestException(error.message)
  }

  // ── INCIDENTS ─────────────────────────────────────────────────────────────

  async listIncidents(eventId: string, tenantId: string): Promise<any[]> {
    const { data, error } = await this.db
      .from('hs_incidents').select('*')
      .eq('event_id', eventId).eq('tenant_id', tenantId)
      .order('occurred_at', { ascending: false })
    if (error) throw new BadRequestException(error.message)
    return data ?? []
  }

  async createIncident(eventId: string, tenantId: string, userId: string, dto: CreateIncidentDto): Promise<any> {
    const { data: plan } = await this.db
      .from('health_safety_plans').select('id').eq('event_id', eventId).eq('tenant_id', tenantId).maybeSingle()

    const { data, error } = await this.db
      .from('hs_incidents')
      .insert({ ...dto, plan_id: plan?.id ?? null, event_id: eventId, tenant_id: tenantId, created_by: userId })
      .select().single()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  async updateIncident(id: string, tenantId: string, dto: Partial<any>): Promise<any> {
    const { data, error } = await this.db
      .from('hs_incidents').update(dto).eq('id', id).eq('tenant_id', tenantId).select().single()
    if (error) throw new BadRequestException(error.message)
    if (!data) throw new NotFoundException('Incident not found')
    return data
  }

  // ── CHECKLISTS ────────────────────────────────────────────────────────────

  async listChecklists(eventId: string, tenantId: string): Promise<any[]> {
    const plan = await this.requirePlan(eventId, tenantId)
    const { data, error } = await this.db
      .from('hs_checklists')
      .select('*, hs_checklist_items(id,text,is_checked,checked_by,checked_at,notes,sort_order)')
      .eq('plan_id', plan.id).order('sort_order')
    if (error) throw new BadRequestException(error.message)
    return data ?? []
  }

  async createChecklist(eventId: string, tenantId: string, dto: CreateChecklistDto): Promise<any> {
    const plan = await this.requirePlan(eventId, tenantId)
    const { data: cl, error } = await this.db
      .from('hs_checklists')
      .insert({ plan_id: plan.id, event_id: eventId, tenant_id: tenantId, title: dto.title, category: dto.category ?? 'general', due_date: dto.due_date, assigned_to: dto.assigned_to })
      .select().single()
    if (error) throw new BadRequestException(error.message)

    if (dto.items?.length) {
      const items = dto.items.map((text, idx) => ({ checklist_id: cl.id, text, sort_order: idx }))
      await this.db.from('hs_checklist_items').insert(items)
    }
    return cl
  }

  async toggleChecklistItem(itemId: string, tenantId: string, checkedBy?: string): Promise<any> {
    const { data: item } = await this.db
      .from('hs_checklist_items').select('id,is_checked,checklist_id').eq('id', itemId).maybeSingle()
    if (!item) throw new NotFoundException('Item not found')

    const { data: cl } = await this.db
      .from('hs_checklists').select('id,tenant_id').eq('id', item.checklist_id).eq('tenant_id', tenantId).maybeSingle()
    if (!cl) throw new ForbiddenException()

    const nowChecked = !item.is_checked
    const { data, error } = await this.db
      .from('hs_checklist_items')
      .update({ is_checked: nowChecked, checked_by: nowChecked ? (checkedBy ?? null) : null, checked_at: nowChecked ? new Date().toISOString() : null })
      .eq('id', itemId).select().single()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  async addChecklistItem(checklistId: string, tenantId: string, text: string): Promise<any> {
    const { data: cl } = await this.db
      .from('hs_checklists').select('id').eq('id', checklistId).eq('tenant_id', tenantId).maybeSingle()
    if (!cl) throw new NotFoundException('Checklist not found')

    const { data, error } = await this.db
      .from('hs_checklist_items').insert({ checklist_id: checklistId, text }).select().single()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  async getCrowdDensity(eventId: string, tenantId: string): Promise<any> {
    const { data, error } = await this.db
      .from('v_hs_crowd_density').select('*').eq('event_id', eventId).maybeSingle()
    if (error) throw new BadRequestException(error.message)
    return data ?? null
  }
}
