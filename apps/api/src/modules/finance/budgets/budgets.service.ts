import { Injectable } from '@nestjs/common'
import { SupabaseService } from '../../../common/supabase/supabase.service'
import { NotificationsService } from '../../notifications/notifications.service'

@Injectable()
export class BudgetsService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async findByEvent(eventId: string, tenantId: string, token: string) {
    const client = this.supabase.forRequest(token)
    const { data, error } = await client
      .from('budgets')
      .select(`*, budget_line_items(*)`)
      .eq('event_id', eventId).eq('tenant_id', tenantId).single()
    if (error) throw new Error(error.message)
    return data
  }

  async upsertLineItem(dto: any, token: string) {
    const client = this.supabase.forRequest(token)
    const { data, error } = await client.from('budget_line_items').upsert(dto, { onConflict: 'id' }).select().single()
    if (error) throw new Error(error.message)

    // Fire-and-forget: check if budget utilization >= 90%
    if (dto.event_id && dto.tenant_id) {
      this.checkBudgetThreshold(dto.event_id, dto.tenant_id).catch(() => {})
    }

    return data
  }

  private async checkBudgetThreshold(eventId: string, tenantId: string): Promise<void> {
    const db = this.supabase.serviceClient
    const [{ data: budget }, { data: items }] = await Promise.all([
      db.from('budgets').select('total_budget').eq('event_id', eventId).eq('tenant_id', tenantId).single(),
      db.from('budget_line_items').select('estimated_amount, actual_amount').eq('event_id', eventId).eq('tenant_id', tenantId),
    ])
    if (!budget || !items) return
    const spent = (items as any[]).reduce((s, r) => s + (r.actual_amount ?? r.estimated_amount ?? 0), 0)
    const pct = budget.total_budget > 0 ? (spent / budget.total_budget) * 100 : 0
    if (pct < 90) return

    const ownerIds = await this.resolveOwnerIds(tenantId)
    const pctStr = Math.round(pct) + '%'
    for (const ownerId of ownerIds) {
      this.notificationsService.send({
        tenantId,
        recipientId: ownerId,
        recipientType: 'internal' as const,
        module: 'finance' as const,
        title: pct >= 100 ? '🚨 Budget Exceeded' : `⚠️ Budget at ${pctStr}`,
        body: `Event budget utilization has reached ${pctStr}. Immediate review recommended.`,
        urgency: pct >= 100 ? 'critical' as const : 'warning' as const,
        batchKey: `budget_threshold_${eventId}`,
        actionUrl: `/finance?event=${eventId}`,
        metadata: { event_id: eventId, pct: Math.round(pct), spent, total: budget.total_budget },
      }).catch(() => {})
    }
  }

  private async resolveOwnerIds(tenantId: string): Promise<string[]> {
    const { data } = await this.supabase.serviceClient
      .from('user_roles')
      .select('user_id')
      .eq('tenant_id', tenantId)
      .eq('role', 'owner')
    return (data ?? []).map((r: any) => r.user_id)
  }
}
