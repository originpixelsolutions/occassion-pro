import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { SupabaseService } from '../../common/supabase/supabase.service'

/**
 * AutomationService — PRIMARY operation layer.
 *
 * The platform runs itself. Super Admin watches and steps in only when needed.
 * Every job writes its run history to automation_job_runs.
 * Super Admin can pause/resume any job via automation_job_config.
 */
@Injectable()
export class AutomationService {
  private readonly logger = new Logger(AutomationService.name)

  constructor(private readonly supabase: SupabaseService) {}

  private get db() { return this.supabase.serviceClient }

  // ─── Job Runner Wrapper ───────────────────────────────────────────────────

  private async runJob<T>(
    jobName: string,
    fn: () => Promise<{ processed: number; affected: number; summary: Record<string, unknown> }>,
    triggeredBy: 'scheduler' | 'manual' | 'webhook' = 'scheduler',
  ): Promise<void> {
    // Check if paused
    const { data: cfg } = await this.db
      .from('automation_job_config')
      .select('is_enabled, is_paused')
      .eq('job_name', jobName)
      .single()

    if (cfg?.is_paused || cfg?.is_enabled === false) {
      this.logger.warn(`[${jobName}] Skipped — job is paused or disabled`)
      return
    }

    const startedAt = new Date()
    const { data: runRow } = await this.db
      .from('automation_job_runs')
      .insert({ job_name: jobName, status: 'running', started_at: startedAt.toISOString(), triggered_by: triggeredBy })
      .select('id').single()

    const runId = runRow?.id
    this.logger.log(`[${jobName}] Started (runId=${runId})`)

    try {
      const result = await fn()
      const completedAt = new Date()
      const durationMs = completedAt.getTime() - startedAt.getTime()

      await this.db.from('automation_job_runs').update({
        status: 'completed',
        completed_at: completedAt.toISOString(),
        duration_ms: durationMs,
        records_processed: result.processed,
        records_affected: result.affected,
        result_summary: result.summary,
      }).eq('id', runId)

      await this.db.from('automation_job_config').update({
        last_run_at: startedAt.toISOString(),
        last_run_status: 'completed',
        last_error: null,
      }).eq('job_name', jobName)

      this.logger.log(`[${jobName}] Completed in ${durationMs}ms — processed=${result.processed}, affected=${result.affected}`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      await this.db.from('automation_job_runs').update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_message: msg,
      }).eq('id', runId)

      await this.db.from('automation_job_config').update({
        last_run_at: startedAt.toISOString(),
        last_run_status: 'failed',
        last_error: msg,
      }).eq('job_name', jobName)

      this.logger.error(`[${jobName}] Failed: ${msg}`)
    }
  }

  // ─── 1. Tenant Health Updater — runs every hour ───────────────────────────

  @Cron('0 * * * *')
  async runTenantHealthUpdater() {
    await this.runJob('tenant_health_updater', async () => {
      const { data: tenants } = await this.db
        .from('tenants')
        .select('id, status, created_at, last_active_at, plan, storage_used_bytes, storage_quota_bytes')
        .eq('status', 'active')

      if (!tenants?.length) return { processed: 0, affected: 0, summary: {} }

      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      const sevenDaysAgo  = new Date(Date.now() - 7  * 24 * 60 * 60 * 1000).toISOString()

      let affected = 0
      for (const tenant of tenants) {
        // Gather signals
        const [eventsRes, loginsRes, paymentsRes] = await Promise.all([
          this.db.from('events').select('id', { count: 'exact', head: true })
            .eq('tenant_id', tenant.id).gte('created_at', thirtyDaysAgo),
          this.db.from('profiles').select('id', { count: 'exact', head: true })
            .eq('tenant_id', tenant.id).gte('last_sign_in_at', thirtyDaysAgo),
          this.db.from('invoices').select('status').eq('tenant_id', tenant.id)
            .gte('created_at', thirtyDaysAgo).order('created_at', { ascending: false }).limit(5),
        ])

        const events30d   = eventsRes.count ?? 0
        const logins30d   = loginsRes.count ?? 0
        const recentPayments = paymentsRes.data ?? []
        const hasFailedPayment = recentPayments.some(p => p.status === 'failed' || p.status === 'overdue')
        const storageUsedPct = tenant.storage_quota_bytes > 0
          ? (tenant.storage_used_bytes / tenant.storage_quota_bytes) * 100 : 0
        const daysSinceLastActive = tenant.last_active_at
          ? (Date.now() - new Date(tenant.last_active_at).getTime()) / (1000 * 60 * 60 * 24)
          : 999

        // Score components (0-100 each)
        const activityScore = Math.min(100, (logins30d / 10) * 50 + (events30d / 5) * 50)
        const billingScore  = hasFailedPayment ? 0 : 100
        const storageScore  = storageUsedPct < 80 ? 100 : storageUsedPct < 95 ? 50 : 0
        const recencyScore  = daysSinceLastActive < 7 ? 100 : daysSinceLastActive < 14 ? 70 : daysSinceLastActive < 30 ? 40 : 0

        const score = (activityScore * 0.4) + (billingScore * 0.3) + (storageScore * 0.1) + (recencyScore * 0.2)

        const grade = score >= 80 ? 'A' : score >= 60 ? 'B' : score >= 40 ? 'C' : score >= 20 ? 'D' : 'F'

        const riskReasons: string[] = []
        if (daysSinceLastActive > 14) riskReasons.push(`Inactive for ${Math.round(daysSinceLastActive)} days`)
        if (hasFailedPayment) riskReasons.push('Failed/overdue payment detected')
        if (logins30d === 0) riskReasons.push('No logins in 30 days')
        if (storageUsedPct > 90) riskReasons.push(`Storage at ${Math.round(storageUsedPct)}%`)
        if (events30d === 0 && logins30d < 3) riskReasons.push('Very low platform usage')

        const churnRisk = riskReasons.length >= 3 ? 'critical'
          : riskReasons.length === 2 ? 'high'
          : riskReasons.length === 1 ? 'medium' : 'low'

        await this.db.from('tenant_health_scores').upsert({
          tenant_id: tenant.id,
          score: Math.round(score * 100) / 100,
          grade,
          churn_risk: churnRisk,
          risk_reasons: riskReasons,
          components: { activity: activityScore, billing: billingScore, storage: storageScore, recency: recencyScore },
          last_active_at: tenant.last_active_at,
          events_30d: events30d,
          logins_30d: logins30d,
          calculated_at: new Date().toISOString(),
        }, { onConflict: 'tenant_id' })

        // Sync churn risk and health score back to tenants table
        await this.db.from('tenants').update({ churn_risk: churnRisk, health_score: score }).eq('id', tenant.id)
        affected++
      }

      return { processed: tenants.length, affected, summary: { tenantsScored: affected } }
    })
  }

  // ─── 2. Churn Risk Detector — runs daily at 04:00 ─────────────────────────

  @Cron('0 4 * * *')
  async runChurnRiskDetector() {
    await this.runJob('churn_risk_detector', async () => {
      // Find high/critical churn risk tenants and write audit + support flags
      const { data: atRisk } = await this.db
        .from('tenant_health_scores')
        .select('tenant_id, churn_risk, risk_reasons, score')
        .in('churn_risk', ['high', 'critical'])

      if (!atRisk?.length) return { processed: 0, affected: 0, summary: { flagged: 0 } }

      let flagged = 0
      for (const r of atRisk) {
        // Update support_tag on tenant
        const tag = r.churn_risk === 'critical' ? 'churned' : 'at_risk'
        await this.db.from('tenants').update({ support_tag: tag }).eq('id', r.tenant_id)

        // Write audit log (automated)
        await this.db.from('super_admin_audit_log').insert({
          action: 'automation.churn_risk_flagged',
          target_type: 'tenant',
          target_id: r.tenant_id,
          after_value: { churn_risk: r.churn_risk, score: r.score, reasons: r.risk_reasons },
          is_automated: true,
        })
        flagged++
      }

      return { processed: atRisk.length, affected: flagged, summary: { flagged } }
    })
  }

  // ─── 3. Subscription Scheduler — daily at 02:00 ───────────────────────────

  @Cron('0 2 * * *')
  async runSubscriptionScheduler() {
    await this.runJob('subscription_scheduler', async () => {
      const today = new Date().toISOString().slice(0, 10)
      let billed = 0, failed = 0

      // Find tenants with billing due today
      const { data: due } = await this.db
        .from('tenant_payment_config')
        .select('*, tenants(id, name, plan, status)')
        .eq('next_billing_date', today)
        .eq('payment_enabled', true)

      for (const cfg of due ?? []) {
        const tenant = (cfg as Record<string, unknown>).tenants as { id: string; name: string; plan: string; status: string }
        if (!tenant || tenant.status !== 'active') continue

        // In production: call Razorpay subscription charge API here
        // For now: log the intent
        await this.db.from('super_admin_audit_log').insert({
          action: 'automation.billing_triggered',
          target_type: 'tenant',
          target_id: tenant.id,
          target_name: tenant.name,
          after_value: { billing_date: today, plan: tenant.plan },
          is_automated: true,
        })

        // Advance next billing date by 30 days
        const next = new Date(today)
        next.setDate(next.getDate() + 30)
        await this.db.from('tenant_payment_config')
          .update({ next_billing_date: next.toISOString().slice(0, 10), last_payment_at: new Date().toISOString() })
          .eq('id', cfg.id)
        billed++
      }

      return { processed: (due ?? []).length, affected: billed, summary: { billed, failed } }
    })
  }

  // ─── 4. Payment Retry Handler — daily at 03:00 ───────────────────────────

  @Cron('0 3 * * *')
  async runPaymentRetryHandler() {
    await this.runJob('payment_retry_handler', async () => {
      const now = Date.now()
      const retryWindows = [3, 7, 14] // days after failure to retry

      const { data: failedInvoices } = await this.db
        .from('invoices')
        .select('id, tenant_id, total_amount, created_at, retry_count')
        .eq('status', 'failed')
        .lt('retry_count', 3)

      let retried = 0
      for (const inv of failedInvoices ?? []) {
        const failedDays = (now - new Date(inv.created_at).getTime()) / (1000 * 60 * 60 * 24)
        const retryCount = inv.retry_count ?? 0
        const shouldRetryAt = retryWindows[retryCount]
        if (!shouldRetryAt || Math.abs(failedDays - shouldRetryAt) > 0.5) continue

        // In production: call Razorpay retry API
        await this.db.from('invoices').update({ retry_count: retryCount + 1 }).eq('id', inv.id)
        await this.db.from('super_admin_audit_log').insert({
          action: 'automation.payment_retry',
          target_type: 'tenant',
          target_id: inv.tenant_id,
          after_value: { invoice_id: inv.id, attempt: retryCount + 1, amount: inv.total_amount },
          is_automated: true,
        })
        retried++
      }

      return { processed: (failedInvoices ?? []).length, affected: retried, summary: { retried } }
    })
  }

  // ─── 5. Auto-Suspend Enforcer — daily at 05:00 ────────────────────────────

  @Cron('0 5 * * *')
  async runAutoSuspendEnforcer() {
    await this.runJob('auto_suspend_enforcer', async () => {
      const now = new Date()
      let suspended = 0

      // Get payment configs with auto_suspend enabled
      const { data: configs } = await this.db
        .from('tenant_payment_config')
        .select('tenant_id, auto_suspend_days, last_payment_at, next_billing_date')
        .eq('payment_enabled', true)

      for (const cfg of configs ?? []) {
        if (!cfg.next_billing_date) continue
        const overdueDays = (now.getTime() - new Date(cfg.next_billing_date).getTime()) / (1000 * 60 * 60 * 24)
        if (overdueDays < (cfg.auto_suspend_days ?? 30)) continue

        // Check if tenant has a manual override (don't auto-suspend if manually marked)
        const { data: tenant } = await this.db
          .from('tenants')
          .select('id, name, status, suspended_by')
          .eq('id', cfg.tenant_id)
          .single()

        if (!tenant || tenant.status === 'suspended') continue
        // Skip if manually suspended (super admin already handled)
        if (tenant.suspended_by === 'super_admin') continue

        await this.db.from('tenants').update({
          status: 'suspended',
          suspended_at: now.toISOString(),
          suspended_reason: `Auto-suspended: payment overdue by ${Math.round(overdueDays)} days`,
          suspended_by: 'system',
        }).eq('id', cfg.tenant_id)

        await this.db.from('super_admin_audit_log').insert({
          action: 'automation.tenant_auto_suspended',
          target_type: 'tenant',
          target_id: cfg.tenant_id,
          target_name: tenant.name,
          after_value: { reason: 'payment_overdue', overdue_days: Math.round(overdueDays) },
          is_automated: true,
        })
        suspended++
      }

      return { processed: (configs ?? []).length, affected: suspended, summary: { suspended } }
    })
  }

  // ─── Manual trigger (Super Admin override) ────────────────────────────────

  async triggerJobManually(jobName: string): Promise<void> {
    const jobMap: Record<string, () => Promise<void>> = {
      tenant_health_updater: () => this.runTenantHealthUpdater(),
      churn_risk_detector: () => this.runChurnRiskDetector(),
      subscription_scheduler: () => this.runSubscriptionScheduler(),
      payment_retry_handler: () => this.runPaymentRetryHandler(),
      auto_suspend_enforcer: () => this.runAutoSuspendEnforcer(),
    }
    const fn = jobMap[jobName]
    if (!fn) throw new Error(`Unknown job: ${jobName}`)
    await fn()
  }

  async toggleJobPause(jobName: string, paused: boolean, reason?: string): Promise<void> {
    await this.db.from('automation_job_config').update({
      is_paused: paused,
      paused_reason: paused ? reason : null,
      updated_at: new Date().toISOString(),
    }).eq('job_name', jobName)
  }

  async getJobStatuses() {
    const { data: configs } = await this.db.from('automation_job_config').select('*').order('job_name')
    const { data: recentRuns } = await this.db
      .from('automation_job_runs')
      .select('job_name, status, started_at, completed_at, duration_ms, records_affected, error_message')
      .order('created_at', { ascending: false })
      .limit(50)

    const runsByJob = (recentRuns ?? []).reduce((acc: Record<string, typeof recentRuns>, r) => {
      if (r) { acc[r.job_name] = acc[r.job_name] ?? []; acc[r.job_name]?.push(r) }
      return acc
    }, {})

    return (configs ?? []).map(c => ({
      ...c,
      recentRuns: (runsByJob[c.job_name] ?? []).slice(0, 5),
    }))
  }
}
