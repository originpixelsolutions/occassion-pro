import { Injectable, Logger, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common'
import { SupabaseService } from '../common/supabase/supabase.service'
import { PlatformSettingsService } from '../common/platform-settings/platform-settings.service'
import { AutomationService } from '../modules/automation/automation.service'

@Injectable()
export class SuperAdminService {
  private readonly logger = new Logger(SuperAdminService.name)

  constructor(
    private readonly supabase: SupabaseService,
    private readonly platformSettings: PlatformSettingsService,
    private readonly automation: AutomationService,
  ) {}

  private get db() { return this.supabase.serviceClient }

  // ─── Guard ─────────────────────────────────────────────────────────────────

  private async assertSuperAdmin(token: string): Promise<string> {
    const client = this.supabase.forRequest(token)
    const { data: { user } } = await client.auth.getUser()
    if (!user) throw new ForbiddenException('Unauthenticated')
    const { data: profile } = await this.db.from('profiles').select('role, is_super_admin').eq('id', user.id).single()
    if (!profile?.is_super_admin) throw new ForbiddenException('Super admin access required')
    return user.id
  }

  private async writeAuditLog(opts: {
    performedBy?: string; action: string; targetType: string
    targetId?: string; targetName?: string
    before?: unknown; after?: unknown; reason?: string; ip?: string
  }) {
    await this.db.from('super_admin_audit_log').insert({
      performed_by: opts.performedBy,
      action: opts.action,
      target_type: opts.targetType,
      target_id: opts.targetId,
      target_name: opts.targetName,
      before_value: opts.before ?? null,
      after_value: opts.after ?? null,
      reason: opts.reason,
      ip_address: opts.ip,
      is_automated: false,
    })
  }

  // ─── 1. Platform Overview ──────────────────────────────────────────────────

  async getPlatformOverview(token: string) {
    await this.assertSuperAdmin(token)

    const [tenantsRes, eventsRes, usersRes, revenueRes, automationRes, announcementsRes] = await Promise.all([
      this.db.from('tenants').select('id, name, plan, status, created_at, country, health_score, churn_risk, suspended_at, suspended_reason, trial_ends_at, storage_used_bytes, storage_quota_bytes'),
      this.db.from('events').select('id, tenant_id, status, event_type, created_at'),
      this.db.from('profiles').select('id, tenant_id, created_at, last_sign_in_at'),
      this.db.from('invoices').select('total_amount, status, tenant_id').eq('status', 'paid'),
      this.db.from('automation_job_config').select('job_name, last_run_status, is_paused, last_run_at, last_error, is_enabled').order('job_name'),
      this.db.from('platform_announcements').select('*').eq('is_active', true).order('created_at', { ascending: false }).limit(5),
    ])

    const tenants = tenantsRes.data ?? []
    const events = eventsRes.data ?? []
    const users = usersRes.data ?? []
    const paidInvoices = revenueRes.data ?? []

    const tenantMap = new Map<string, Record<string, unknown>>()
    for (const t of tenants) tenantMap.set(t.id, { ...t, eventCount: 0, userCount: 0, revenue: 0 })
    for (const e of events) { const t = tenantMap.get(e.tenant_id); if (t) t.eventCount = ((t.eventCount as number) ?? 0) + 1 }
    for (const u of users) { const t = tenantMap.get(u.tenant_id); if (t) t.userCount = ((t.userCount as number) ?? 0) + 1 }
    for (const inv of paidInvoices) { const t = tenantMap.get(inv.tenant_id); if (t) t.revenue = ((t.revenue as number) ?? 0) + Number(inv.total_amount ?? 0) }

    const signupsByMonth: Record<string, number> = {}
    for (const t of tenants) {
      if (!t.created_at) continue
      const key = t.created_at.slice(0, 7)
      signupsByMonth[key] = (signupsByMonth[key] ?? 0) + 1
    }

    const planCounts = tenants.reduce((acc: Record<string, number>, t) => {
      acc[t.plan ?? 'unknown'] = (acc[t.plan ?? 'unknown'] ?? 0) + 1; return acc
    }, {})
    const statusCounts = tenants.reduce((acc: Record<string, number>, t) => {
      acc[t.status ?? 'unknown'] = (acc[t.status ?? 'unknown'] ?? 0) + 1; return acc
    }, {})

    const eventsByType = events.reduce((acc: Record<string, number>, e) => {
      acc[e.event_type ?? 'unknown'] = (acc[e.event_type ?? 'unknown'] ?? 0) + 1; return acc
    }, {})

    const revenueByMonth: Record<string, number> = {}
    for (const inv of paidInvoices) {
      // not ideal — would need created_at on invoices; skip for now
    }

    const topTenants = Array.from(tenantMap.values())
      .sort((a, b) => ((b.eventCount as number) ?? 0) - ((a.eventCount as number) ?? 0))
      .slice(0, 10)
      .map(t => ({ id: t.id, name: t.name, events: t.eventCount, revenue: t.revenue, plan: t.plan, status: t.status }))

    const automations = automationRes.data ?? []
    const failedAutomations = automations.filter(j => j.last_run_status === 'failed' && !j.is_paused)

    return {
      summary: {
        totalTenants: tenants.length,
        activeTenants: statusCounts['active'] ?? 0,
        suspendedTenants: statusCounts['suspended'] ?? 0,
        trialTenants: statusCounts['trial'] ?? 0,
        totalEvents: events.length,
        totalUsers: users.length,
        totalRevenue: paidInvoices.reduce((s, i) => s + Number(i.total_amount ?? 0), 0),
        planCounts,
        statusCounts,
        churnAtRisk: tenants.filter(t => t.churn_risk === 'high' || t.churn_risk === 'critical').length,
        platformHealth: tenants.length > 0
          ? Math.round(tenants.reduce((s, t) => s + (t.health_score ?? 100), 0) / tenants.length) : 100,
        automationStatus: failedAutomations.length > 0 ? 'degraded' : 'healthy',
        failedAutomations: failedAutomations.map(j => j.job_name),
      },
      tenants: Array.from(tenantMap.values()),
      signupTrend: signupsByMonth,
      revenueByMonth,
      eventsByType,
      topTenants,
      activeAnnouncements: announcementsRes.data ?? [],
      automations: automations.map(j => ({
        jobName: j.job_name,
        isEnabled: j.is_enabled,
        isPaused: j.is_paused,
        lastRun: j.last_run_at,
        lastStatus: j.last_run_status,
        lastError: j.last_error,
      })),
    }
  }

  // ─── 2. Analytics ──────────────────────────────────────────────────────────

  async getPlatformAnalytics(token: string) {
    await this.assertSuperAdmin(token)
    return this.getPlatformOverview(token)
  }

  // ─── 3. Smart Alerts ───────────────────────────────────────────────────────

  async getSmartAlerts(token: string) {
    await this.assertSuperAdmin(token)
    const { data } = await this.db
      .from('smart_alerts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)
    return data ?? []
  }

  // ─── 4. Tenant Management ──────────────────────────────────────────────────

  async listTenants(token: string, filters: { status?: string; plan?: string; search?: string; churnRisk?: string } = {}) {
    await this.assertSuperAdmin(token)
    let q = this.db.from('tenants').select('*, tenant_health_scores(score, grade, churn_risk)')
    if (filters.status) q = q.eq('status', filters.status)
    if (filters.plan) q = q.eq('plan', filters.plan)
    if (filters.churnRisk) q = q.eq('churn_risk', filters.churnRisk)
    if (filters.search) q = q.ilike('name', `%${filters.search}%`)
    const { data } = await q.order('created_at', { ascending: false })
    return data ?? []
  }

  async getTenant(token: string, tenantId: string) {
    await this.assertSuperAdmin(token)
    const [tenantRes, usersRes, eventsRes, modulesRes, paymentRes, aiRes, healthRes, notesRes] = await Promise.all([
      this.db.from('tenants').select('*').eq('id', tenantId).single(),
      this.db.from('profiles').select('id, email, full_name, role, created_at, last_sign_in_at').eq('tenant_id', tenantId),
      this.db.from('events').select('id, name, status, start_date, event_type').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(10),
      this.db.from('tenant_module_settings').select('*').eq('tenant_id', tenantId),
      this.db.from('tenant_payment_config').select('tenant_id, use_platform_keys, payment_enabled, test_mode, grace_period_days, auto_suspend_days, last_payment_at, next_billing_date').eq('tenant_id', tenantId).single(),
      this.db.from('tenant_ai_config').select('tenant_id, ai_api_enabled, provider, tokens_used, tokens_limit, model_name').eq('tenant_id', tenantId).single(),
      this.db.from('tenant_health_scores').select('*').eq('tenant_id', tenantId).single(),
      this.db.from('super_admin_support_notes').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(20),
    ])
    if (!tenantRes.data) throw new NotFoundException('Tenant not found')
    return {
      tenant: tenantRes.data,
      users: usersRes.data ?? [],
      recentEvents: eventsRes.data ?? [],
      moduleSettings: modulesRes.data ?? [],
      paymentConfig: paymentRes.data,
      aiConfig: aiRes.data,
      healthScore: healthRes.data,
      supportNotes: notesRes.data ?? [],
    }
  }

  async suspendTenant(token: string, tenantId: string, reason: string, ip?: string) {
    const adminId = await this.assertSuperAdmin(token)
    const { data: before } = await this.db.from('tenants').select('status, name').eq('id', tenantId).single()
    if (!before) throw new NotFoundException('Tenant not found')
    await this.db.from('tenants').update({ status: 'suspended', suspended_at: new Date().toISOString(), suspended_reason: reason, suspended_by: 'super_admin' }).eq('id', tenantId)
    await this.writeAuditLog({ performedBy: adminId, action: 'tenant.suspend', targetType: 'tenant', targetId: tenantId, targetName: before.name, before: { status: before.status }, after: { status: 'suspended', reason }, ip })
    return { success: true }
  }

  async reactivateTenant(token: string, tenantId: string, ip?: string) {
    const adminId = await this.assertSuperAdmin(token)
    const { data: before } = await this.db.from('tenants').select('status, name').eq('id', tenantId).single()
    if (!before) throw new NotFoundException('Tenant not found')
    await this.db.from('tenants').update({ status: 'active', suspended_at: null, suspended_reason: null, suspended_by: null }).eq('id', tenantId)
    await this.writeAuditLog({ performedBy: adminId, action: 'tenant.reactivate', targetType: 'tenant', targetId: tenantId, targetName: before.name, before: { status: before.status }, after: { status: 'active' }, ip })
    return { success: true }
  }

  async deleteTenant(token: string, tenantId: string, confirmation: string, ip?: string) {
    if (confirmation !== 'DELETE') throw new ForbiddenException('Must confirm with "DELETE"')
    const adminId = await this.assertSuperAdmin(token)
    const { data: before } = await this.db.from('tenants').select('name').eq('id', tenantId).single()
    if (!before) throw new NotFoundException('Tenant not found')
    await this.db.from('tenants').delete().eq('id', tenantId)
    await this.writeAuditLog({ performedBy: adminId, action: 'tenant.delete', targetType: 'tenant', targetId: tenantId, targetName: before.name, ip })
    return { success: true }
  }

  async overrideTenantPlan(token: string, tenantId: string, plan: string, reason: string, until?: string, ip?: string) {
    const adminId = await this.assertSuperAdmin(token)
    const { data: before } = await this.db.from('tenants').select('plan, name').eq('id', tenantId).single()
    if (!before) throw new NotFoundException('Tenant not found')
    await this.db.from('tenants').update({ plan, plan_override_reason: reason, plan_override_until: until ?? null }).eq('id', tenantId)
    await this.writeAuditLog({ performedBy: adminId, action: 'tenant.plan_override', targetType: 'tenant', targetId: tenantId, targetName: before.name, before: { plan: before.plan }, after: { plan, reason, until }, ip })
    return { success: true }
  }

  async setStorageQuota(token: string, tenantId: string, quotaGb: number, ip?: string) {
    const adminId = await this.assertSuperAdmin(token)
    const quotaBytes = quotaGb * 1024 * 1024 * 1024
    const { data: t } = await this.db.from('tenants').select('name').eq('id', tenantId).single()
    await this.db.from('tenants').update({ storage_quota_bytes: quotaBytes }).eq('id', tenantId)
    await this.writeAuditLog({ performedBy: adminId, action: 'tenant.storage_quota', targetType: 'tenant', targetId: tenantId, targetName: t?.name, after: { quotaGb }, ip })
    return { success: true }
  }

  // ─── 5. Platform Users ─────────────────────────────────────────────────────

  async listPlatformUsers(token: string, limit = 200) {
    await this.assertSuperAdmin(token)
    const { data } = await this.db
      .from('profiles')
      .select('id, email, full_name, role, tenant_id, status, created_at, last_sign_in_at, tenants(name)')
      .order('created_at', { ascending: false })
      .limit(limit)
    return (data ?? []).map(u => ({ ...u, tenant_name: (u.tenants as any)?.name ?? null }))
  }

  async suspendUser(token: string, userId: string, ip?: string) {
    const adminId = await this.assertSuperAdmin(token)
    await this.db.from('profiles').update({ status: 'suspended' }).eq('id', userId)
    await this.writeAuditLog({ performedBy: adminId, action: 'user.suspend', targetType: 'user', targetId: userId, ip })
    return { success: true }
  }

  async unsuspendUser(token: string, userId: string, ip?: string) {
    const adminId = await this.assertSuperAdmin(token)
    await this.db.from('profiles').update({ status: 'active' }).eq('id', userId)
    await this.writeAuditLog({ performedBy: adminId, action: 'user.unsuspend', targetType: 'user', targetId: userId, ip })
    return { success: true }
  }

  async resetUserPassword(token: string, userId: string, ip?: string) {
    const adminId = await this.assertSuperAdmin(token)
    const { data: profile } = await this.db.from('profiles').select('email').eq('id', userId).single()
    if (!profile?.email) throw new NotFoundException('User not found')
    const client = this.supabase.adminClient
    await client.auth.admin.generateLink({ type: 'recovery', email: profile.email })
    await this.writeAuditLog({ performedBy: adminId, action: 'user.reset_password', targetType: 'user', targetId: userId, ip })
    return { success: true, email: profile.email }
  }

  // ─── 6. Module Control ─────────────────────────────────────────────────────

  async getTenantModules(token: string, tenantId: string) {
    await this.assertSuperAdmin(token)
    const { data } = await this.db.from('tenant_module_settings').select('*').eq('tenant_id', tenantId)
    return data ?? []
  }

  async setTenantModules(token: string, tenantId: string, modules: Record<string, boolean>, ip?: string) {
    const adminId = await this.assertSuperAdmin(token)
    const rows = Object.entries(modules).map(([module_name, enabled]) => ({
      tenant_id: tenantId, module_name, is_enabled: enabled,
    }))
    await this.db.from('tenant_module_settings').upsert(rows, { onConflict: 'tenant_id,module_name' })
    await this.writeAuditLog({ performedBy: adminId, action: 'tenant.module_update', targetType: 'tenant', targetId: tenantId, after: modules, ip })
    return { success: true }
  }

  // ─── 7. AI Config ─────────────────────────────────────────────────────────

  async getAiConfig(token: string) {
    await this.assertSuperAdmin(token)
    const settings = await this.platformSettings.getAll()
    return {
      ai_enabled: settings.ai_enabled ?? true,
      ai_provider: settings.ai_provider ?? 'anthropic',
      ai_model: settings.ai_model ?? 'claude-3-5-sonnet-20241022',
      ai_monthly_token_limit: settings.ai_monthly_token_limit ?? 10000000,
      ai_cost_per_1k_tokens: settings.ai_cost_per_1k_tokens ?? 0.003,
    }
  }

  async updateAiConfig(token: string, config: Record<string, unknown>, ip?: string) {
    const adminId = await this.assertSuperAdmin(token)
    for (const [key, value] of Object.entries(config)) {
      await this.platformSettings.set(key, value)
    }
    await this.writeAuditLog({ performedBy: adminId, action: 'platform.ai_config', targetType: 'platform', after: config, ip })
    return { success: true }
  }

  // ─── 8. Storage Stats ─────────────────────────────────────────────────────

  async getStorageStats(token: string) {
    await this.assertSuperAdmin(token)
    const { data: tenants } = await this.db
      .from('tenants')
      .select('id, name, storage_used_bytes, storage_quota_bytes, plan')
      .order('storage_used_bytes', { ascending: false })
    const total = (tenants ?? []).reduce((s, t) => s + Number(t.storage_used_bytes ?? 0), 0)
    const quota = (tenants ?? []).reduce((s, t) => s + Number(t.storage_quota_bytes ?? 0), 0)
    return {
      totalUsedBytes: total,
      totalQuotaBytes: quota,
      usedPercent: quota > 0 ? Math.round((total / quota) * 100) : 0,
      tenants: tenants ?? [],
    }
  }

  // ─── 9. System Health ─────────────────────────────────────────────────────

  async getSystemHealth(token: string) {
    await this.assertSuperAdmin(token)
    const start = Date.now()
    const [dbRes, automationRes, failedWebhooksRes, activeSessionsRes] = await Promise.all([
      this.db.from('tenants').select('id').limit(1),
      this.db.from('automation_job_config').select('job_name, last_run_status, is_paused, last_run_at, last_error'),
      this.db.from('webhook_deliveries').select('id').eq('status', 'failed').gte('created_at', new Date(Date.now() - 86400000).toISOString()),
      this.db.from('profiles').select('id').not('last_sign_in_at', 'is', null).gte('last_sign_in_at', new Date(Date.now() - 3600000).toISOString()),
    ])
    const dbLatency = Date.now() - start
    const jobs = automationRes.data ?? []
    const failedJobs = jobs.filter(j => j.last_run_status === 'failed' && !j.is_paused)
    const failedWebhooks = failedWebhooksRes.data?.length ?? 0
    const activeSessions = activeSessionsRes.data?.length ?? 0
    const overallStatus = failedJobs.length > 2 ? 'degraded' : dbLatency > 3000 ? 'degraded' : 'healthy'
    return {
      status: overallStatus,
      api_latency_ms: dbLatency,
      db_latency_ms: dbLatency,
      active_sessions: activeSessions,
      webhook_failures_24h: failedWebhooks,
      queue_processing: jobs.some(j => !j.is_paused),
      services: [
        { name: 'Database', status: dbRes.error ? 'down' : 'up', latency_ms: dbLatency, last_check: new Date().toISOString() },
        { name: 'Automation Engine', status: failedJobs.length > 0 ? 'degraded' : 'up', last_check: new Date().toISOString() },
        { name: 'Webhook Delivery', status: failedWebhooks > 50 ? 'degraded' : 'up', last_check: new Date().toISOString() },
      ],
      recentErrors: failedJobs.map(j => ({ service: j.job_name, message: j.last_error ?? 'Unknown error', count: 1, last_seen: j.last_run_at })),
    }
  }

  // ─── 10. Payment Config ───────────────────────────────────────────────────

  async getPaymentConfig(token: string) {
    await this.assertSuperAdmin(token)
    const settings = await this.platformSettings.getAll()
    return {
      platform_razorpay_enabled: settings.platform_razorpay_enabled ?? false,
      platform_stripe_enabled: settings.platform_stripe_enabled ?? false,
      platform_paypal_enabled: settings.platform_paypal_enabled ?? false,
      default_currency: settings.default_currency ?? 'INR',
      platform_fee_percent: settings.platform_fee_percent ?? 2.5,
      payout_schedule: settings.payout_schedule ?? 'weekly',
    }
  }

  async updatePaymentConfig(token: string, config: Record<string, unknown>, ip?: string) {
    const adminId = await this.assertSuperAdmin(token)
    for (const [key, value] of Object.entries(config)) {
      await this.platformSettings.set(key, value)
    }
    await this.writeAuditLog({ performedBy: adminId, action: 'platform.payment_config', targetType: 'platform', after: config, ip })
    return { success: true }
  }

  // ─── 11. Platform Settings ────────────────────────────────────────────────

  async getPlatformSettings(token: string) {
    await this.assertSuperAdmin(token)
    return this.platformSettings.getAll()
  }

  async updatePlatformSettings(token: string, settings: Record<string, unknown>, ip?: string) {
    const adminId = await this.assertSuperAdmin(token)
    for (const [key, value] of Object.entries(settings)) {
      await this.platformSettings.set(key, value)
    }
    await this.writeAuditLog({ performedBy: adminId, action: 'platform.settings_update', targetType: 'platform', after: settings, ip })
    return { success: true }
  }

  // ─── 12. Subscription Plans ───────────────────────────────────────────────

  async getPlans(token: string) {
    await this.assertSuperAdmin(token)
    const { data } = await this.db.from('subscription_plans').select('*').order('sort_order')
    return data ?? []
  }

  async createPlan(token: string, dto: Record<string, unknown>, ip?: string) {
    const adminId = await this.assertSuperAdmin(token)
    const { data, error } = await this.db.from('subscription_plans').insert(dto).select().single()
    if (error) throw new BadRequestException(error.message)
    await this.writeAuditLog({ performedBy: adminId, action: 'plan.create', targetType: 'plan', targetId: data.id, targetName: data.name, after: dto, ip })
    return data
  }

  async updatePlan(token: string, planId: string, dto: Record<string, unknown>, ip?: string) {
    const adminId = await this.assertSuperAdmin(token)
    const { data, error } = await this.db.from('subscription_plans').update(dto).eq('id', planId).select().single()
    if (error) throw new BadRequestException(error.message)
    await this.writeAuditLog({ performedBy: adminId, action: 'plan.update', targetType: 'plan', targetId: planId, after: dto, ip })
    return data
  }

  async deletePlan(token: string, planId: string, ip?: string) {
    const adminId = await this.assertSuperAdmin(token)
    await this.db.from('subscription_plans').delete().eq('id', planId)
    await this.writeAuditLog({ performedBy: adminId, action: 'plan.delete', targetType: 'plan', targetId: planId, ip })
    return { success: true }
  }

  // ─── 13. Automations ──────────────────────────────────────────────────────

  async getAutomationStatus(token: string) {
    await this.assertSuperAdmin(token)
    const { data } = await this.db.from('automation_job_config').select('*').order('job_name')
    return data ?? []
  }

  async getAutomationRuns(token: string, jobName: string, limit = 5) {
    await this.assertSuperAdmin(token)
    const { data } = await this.db
      .from('automation_job_runs')
      .select('*')
      .eq('job_name', jobName)
      .order('started_at', { ascending: false })
      .limit(limit)
    return data ?? []
  }

  async triggerAutomation(token: string, jobName: string, ip?: string) {
    const adminId = await this.assertSuperAdmin(token)
    const method = jobName as keyof AutomationService
    if (typeof this.automation[method] === 'function') {
      (this.automation[method] as () => Promise<void>)().catch(e => this.logger.error(`Manual trigger ${jobName} failed`, e))
    }
    await this.writeAuditLog({ performedBy: adminId, action: 'automation.trigger', targetType: 'automation', targetName: jobName, ip })
    return { success: true }
  }

  async pauseAutomation(token: string, jobName: string, ip?: string) {
    const adminId = await this.assertSuperAdmin(token)
    await this.db.from('automation_job_config').update({ is_paused: true }).eq('job_name', jobName)
    await this.writeAuditLog({ performedBy: adminId, action: 'automation.pause', targetType: 'automation', targetName: jobName, ip })
    return { success: true }
  }

  async resumeAutomation(token: string, jobName: string, ip?: string) {
    const adminId = await this.assertSuperAdmin(token)
    await this.db.from('automation_job_config').update({ is_paused: false }).eq('job_name', jobName)
    await this.writeAuditLog({ performedBy: adminId, action: 'automation.resume', targetType: 'automation', targetName: jobName, ip })
    return { success: true }
  }

  // ─── 14. Support Tools ────────────────────────────────────────────────────

  async getTenantNotes(token: string, tenantId?: string) {
    await this.assertSuperAdmin(token)
    let q = this.db.from('super_admin_support_notes').select('*, tenants(name)').order('created_at', { ascending: false }).limit(100)
    if (tenantId) q = q.eq('tenant_id', tenantId)
    const { data } = await q
    return data ?? []
  }

  async createTenantNote(token: string, dto: { tenant_id: string; note: string; category?: string; is_internal?: boolean }, ip?: string) {
    const adminId = await this.assertSuperAdmin(token)
    const { data, error } = await this.db.from('super_admin_support_notes').insert({
      ...dto, created_by: adminId,
    }).select().single()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  async getAnnouncements(token: string) {
    await this.assertSuperAdmin(token)
    const { data } = await this.db.from('platform_announcements').select('*').order('created_at', { ascending: false })
    return data ?? []
  }

  async createAnnouncement(token: string, dto: Record<string, unknown>, ip?: string) {
    const adminId = await this.assertSuperAdmin(token)
    const { data, error } = await this.db.from('platform_announcements').insert({ ...dto, created_by: adminId }).select().single()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  async deleteAnnouncement(token: string, id: string, ip?: string) {
    const adminId = await this.assertSuperAdmin(token)
    await this.db.from('platform_announcements').delete().eq('id', id)
    await this.writeAuditLog({ performedBy: adminId, action: 'announcement.delete', targetType: 'announcement', targetId: id, ip })
    return { success: true }
  }

  async getImpersonationLog(token: string) {
    await this.assertSuperAdmin(token)
    const { data } = await this.db
      .from('super_admin_audit_log')
      .select('*')
      .eq('action', 'user.impersonate')
      .order('created_at', { ascending: false })
      .limit(50)
    return data ?? []
  }

  // ─── Platform Events List ──────────────────────────────────────────────────

  async listPlatformEvents(
    token: string,
    opts: { status?: string; search?: string; limit?: number; offset?: number },
  ) {
    await this.assertSuperAdmin(token)

    let query = this.db
      .from('events')
      .select(`
        id, name, category, status, event_date,
        venue_name, venue_address,
        expected_guests, confirmed_guests,
        tenant_id,
        tenants!inner(id, name)
      `)
      .order('event_date', { ascending: false })
      .limit(opts.limit ?? 100)
      .range(opts.offset ?? 0, (opts.offset ?? 0) + (opts.limit ?? 100) - 1)

    if (opts.status && opts.status !== 'all') {
      query = query.eq('status', opts.status)
    }

    const { data, count } = await query
    const events = (data ?? []).map((e: any) => ({
      id:        e.id,
      name:      e.name,
      tenant:    (e.tenants as any)?.name ?? 'Unknown',
      tenant_id: e.tenant_id,
      type:      e.category ?? 'Event',
      status:    e.status,
      guests:    e.expected_guests ?? e.confirmed_guests ?? 0,
      start:     e.event_date,
      city:      (e.venue_address as any)?.city ?? e.venue_name ?? '—',
    }))

    // Apply search client-side (small dataset for super admin)
    const search = (opts.search ?? '').toLowerCase()
    const filtered = search
      ? events.filter((ev: any) =>
          ev.name.toLowerCase().includes(search) ||
          ev.tenant.toLowerCase().includes(search) ||
          ev.city.toLowerCase().includes(search),
        )
      : events

    // Compute stats
    const now = new Date().toISOString().slice(0, 10)
    const monthStart = now.slice(0, 7)
    const stats = {
      total:     filtered.length,
      active:    filtered.filter((e: any) => e.status === 'active' || e.status === 'published').length,
      thisMonth: filtered.filter((e: any) => (e.start ?? '').startsWith(monthStart)).length,
      avgGuests: filtered.length > 0
        ? Math.round(filtered.reduce((s: number, e: any) => s + (e.guests ?? 0), 0) / filtered.length)
        : 0,
    }

    return { events: filtered, stats }
  }
}
