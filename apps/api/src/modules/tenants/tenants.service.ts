import { Injectable, ForbiddenException } from '@nestjs/common'
import { SupabaseService } from '../../common/supabase/supabase.service'

@Injectable()
export class TenantsService {
  constructor(private readonly supabase: SupabaseService) {}

  async findAll() {
    // Super admin only
    const { data, error } = await this.supabase.serviceClient
      .from('tenants')
      .select('*, profiles(count)')
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return data ?? []
  }

  async findOne(id: string, token: string) {
    const client = this.supabase.forRequest(token)
    const { data, error } = await client
      .from('tenants')
      .select('*')
      .eq('id', id)
      .single()
    if (error) throw new Error(error.message)
    return data
  }

  async update(id: string, dto: any, tenantId: string, token: string) {
    if (id !== tenantId) throw new ForbiddenException('Cannot modify other tenants')
    const client = this.supabase.forRequest(token)
    const { data, error } = await client
      .from('tenants')
      .update({ ...dto, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data
  }

  async getStats(tenantId: string, token: string) {
    const client = this.supabase.forRequest(token)
    const [events, members, vendors, guests] = await Promise.all([
      client.from('events').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId),
      client.from('profiles').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId),
      client.from('vendors').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId),
      client.from('guests').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId),
    ])
    return {
      total_events: events.count ?? 0,
      total_members: members.count ?? 0,
      total_vendors: vendors.count ?? 0,
      total_guests: guests.count ?? 0,
    }
  }

  async updateBranding(id: string, dto: {
    logo_url?: string
    brand_color?: string
    custom_domain?: string
  }, tenantId: string, token: string) {
    if (id !== tenantId) throw new ForbiddenException()
    return this.update(id, dto, tenantId, token)
  }

  async getUsage(tenantId: string, token: string) {
    const client = this.supabase.forRequest(token)
    const { data: tenant } = await client.from('tenants').select('plan, settings').eq('id', tenantId).single()
    const stats = await this.getStats(tenantId, token)

    const limits: Record<string, Record<string, number>> = {
      starter: { events: 5, members: 3, storage_gb: 5 },
      pro: { events: 50, members: 20, storage_gb: 50 },
      enterprise: { events: -1, members: -1, storage_gb: 500 },
    }
    const plan = tenant?.plan ?? 'starter'
    return {
      plan,
      usage: stats,
      limits: limits[plan] ?? limits.starter,
    }
  }

  // ─── Onboarding ──────────────────────────────────────────────────────────────

  /**
   * Get onboarding status for a tenant.
   * Returns { completed: boolean, step: number, completed_at: string | null }
   */
  async getOnboardingStatus(tenantId: string, token: string) {
    const client = this.supabase.forRequest(token)
    const { data, error } = await client
      .from('tenants')
      .select('onboarding_step, onboarding_completed_at')
      .eq('id', tenantId)
      .single()
    if (error) throw new Error(error.message)
    return {
      completed: data?.onboarding_completed_at !== null,
      step: data?.onboarding_step ?? 0,
      completed_at: data?.onboarding_completed_at ?? null,
    }
  }

  /**
   * Advance the onboarding wizard to the given step.
   * Steps 1-4 update `onboarding_step`.
   * Step 5 also sets `onboarding_completed_at`.
   */
  async completeOnboardingStep(tenantId: string, step: number, token: string) {
    if (step < 1 || step > 5) {
      throw new Error('Onboarding step must be between 1 and 5')
    }
    const client = this.supabase.forRequest(token)

    const patch: Record<string, unknown> = {
      onboarding_step: step,
      updated_at: new Date().toISOString(),
    }
    if (step === 5) {
      patch.onboarding_completed_at = new Date().toISOString()
    }

    const { data, error } = await client
      .from('tenants')
      .update(patch)
      .eq('id', tenantId)
      .select('onboarding_step, onboarding_completed_at')
      .single()
    if (error) throw new Error(error.message)
    return {
      completed: data?.onboarding_completed_at !== null,
      step: data?.onboarding_step ?? step,
      completed_at: data?.onboarding_completed_at ?? null,
    }
  }

  /**
   * Mark onboarding as complete regardless of current step.
   * Used when a user skips the wizard.
   */
  async completeOnboarding(tenantId: string, token: string) {
    return this.completeOnboardingStep(tenantId, 5, token)
  }
}
