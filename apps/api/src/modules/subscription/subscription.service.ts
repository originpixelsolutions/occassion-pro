import {
  Injectable, ForbiddenException, BadRequestException, NotFoundException, Logger,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as crypto from 'crypto'
import { SupabaseService } from '../../common/supabase/supabase.service'

export type PlanSlug = 'free' | 'starter' | 'growth' | 'agency'

export type PlanFeatureKey =
  | 'ai_assistant' | 'ai_proposals' | 'ai_budget_optimizer'
  | 'white_label' | 'custom_domain' | 'api_access'
  | 'multi_currency' | 'advanced_analytics'
  | 'guest_portal' | 'vendor_portal' | 'client_portal'
  | 'audit_trail' | 'playbooks' | 'document_generation'
  | 'animated_invitations' | 'short_links' | 'event_types_custom'
  | 'offline_checkin' | 'payment_processing'
  | 'realtime_collaboration' | 'priority_support'

export type LimitKey =
  | 'events' | 'team' | 'storage_gb' | 'guests_per_event'
  | 'ai_calls' | 'short_links' | 'venues' | 'vendors'

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name)

  constructor(
    private readonly supa: SupabaseService,
    private readonly config: ConfigService,
  ) {}

  private get db() { return this.supa.serviceClient }

  // ── READ ──────────────────────────────────────────────────────────────────

  async listPlans(): Promise<any[]> {
    const { data, error } = await this.db
      .from('subscription_plans')
      .select('*')
      .eq('is_public', true)
      .eq('is_active', true)
      .order('sort_order')
    if (error) throw new BadRequestException(error.message)
    return data ?? []
  }

  async getTenantPlan(tenantId: string): Promise<any> {
    const { data, error } = await this.db
      .from('v_tenant_plan')
      .select('*')
      .eq('tenant_id', tenantId)
      .maybeSingle()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  async getRawSubscription(tenantId: string): Promise<any> {
    const { data } = await this.db
      .from('tenant_subscriptions')
      .select('*, subscription_plans(*)')
      .eq('tenant_id', tenantId)
      .maybeSingle()
    return data
  }

  // ── FEATURE FLAG CHECK ───────────────────────────────────────────────────

  async hasFeature(tenantId: string, feature: PlanFeatureKey): Promise<boolean> {
    const plan = await this.getTenantPlan(tenantId)
    if (!plan) return false
    if (plan.sub_status === 'suspended' || plan.sub_status === 'expired') return false
    return plan.features?.[feature] === true
  }

  async requireFeature(tenantId: string, feature: PlanFeatureKey): Promise<void> {
    const has = await this.hasFeature(tenantId, feature)
    if (!has) {
      throw new ForbiddenException(
        `Your current plan does not include "${feature.replace(/_/g, ' ')}". Please upgrade to access this feature.`
      )
    }
  }

  // ── LIMIT CHECK ──────────────────────────────────────────────────────────

  async checkLimit(tenantId: string, limitKey: LimitKey, currentCount: number): Promise<void> {
    const plan = await this.getTenantPlan(tenantId)
    if (!plan) return
    if (plan.sub_status === 'suspended') {
      throw new ForbiddenException('Your workspace is suspended. Please contact support.')
    }

    const limitMap: Record<LimitKey, number | null> = {
      events:           plan.limit_events,
      team:             plan.limit_team,
      storage_gb:       plan.limit_storage_gb,
      guests_per_event: plan.limit_guests_per_event,
      ai_calls:         plan.limit_ai_calls,
      short_links:      plan.limit_short_links,
      venues:           plan.limit_venues,
      vendors:          plan.limit_vendors,
    }

    const limit = limitMap[limitKey]
    if (limit !== null && limit !== undefined && currentCount >= limit) {
      const humanKey = limitKey.replace(/_/g, ' ')
      throw new ForbiddenException(
        `You have reached the ${humanKey} limit (${limit}) on your current plan. Upgrade to create more.`
      )
    }
  }

  // ── USAGE REFRESH ────────────────────────────────────────────────────────

  async refreshUsage(tenantId: string): Promise<void> {
    const [eventsRes, teamRes, shortLinksRes] = await Promise.all([
      this.db.from('events').select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId).is('deleted_at', null),
      this.db.from('user_roles').select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId),
      this.db.from('short_links').select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId),
    ])

    await this.db.from('tenant_subscriptions').update({
      usage_events:       eventsRes.count ?? 0,
      usage_team_members: teamRes.count ?? 0,
      usage_short_links:  shortLinksRes.count ?? 0,
      usage_refreshed_at: new Date().toISOString(),
    }).eq('tenant_id', tenantId)
  }

  // ── PLAN CHANGES ─────────────────────────────────────────────────────────

  async startTrial(tenantId: string, planSlug: string = 'growth'): Promise<any> {
    const { data: plan } = await this.db
      .from('subscription_plans')
      .select('id, trial_days, slug')
      .eq('slug', planSlug)
      .maybeSingle()

    if (!plan) throw new NotFoundException('Plan not found')
    if (!plan.trial_days) throw new BadRequestException('This plan does not offer a trial')

    const existing = await this.getRawSubscription(tenantId)
    if (existing?.status === 'trialing') throw new BadRequestException('Trial already active')
    if (existing && existing.subscription_plans?.slug !== 'free') {
      throw new BadRequestException('Trials are only available when on the Free plan')
    }

    const trialStart = new Date()
    const trialEnd   = new Date(Date.now() + plan.trial_days * 86400000)

    const { data, error } = await this.db
      .from('tenant_subscriptions')
      .update({
        plan_id:              plan.id,
        status:               'trialing',
        trial_start:          trialStart.toISOString(),
        trial_end:            trialEnd.toISOString(),
        current_period_start: trialStart.toISOString(),
        current_period_end:   trialEnd.toISOString(),
      })
      .eq('tenant_id', tenantId)
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)

    await this.db.from('plan_change_history').insert({
      tenant_id:    tenantId,
      from_plan_id: existing?.plan_id ?? null,
      to_plan_id:   plan.id,
      reason:       `Started ${plan.trial_days}-day trial`,
    })

    return data
  }

  async cancelSubscription(tenantId: string, userId: string, reason?: string): Promise<any> {
    const sub = await this.getRawSubscription(tenantId)
    if (!sub) throw new NotFoundException('No subscription found')

    const { data, error } = await this.db
      .from('tenant_subscriptions')
      .update({ cancel_at_period_end: true, cancelled_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)

    await this.db.from('plan_change_history').insert({
      tenant_id:    tenantId,
      from_plan_id: sub.plan_id,
      to_plan_id:   sub.plan_id,
      changed_by:   userId,
      reason:       reason ?? 'Cancelled by user',
    })

    return data
  }

  async superAdminUpgrade(tenantId: string, planSlug: string, actorId: string): Promise<any> {
    const { data: plan } = await this.db
      .from('subscription_plans').select('id').eq('slug', planSlug).maybeSingle()
    if (!plan) throw new NotFoundException('Plan not found')

    const sub = await this.getRawSubscription(tenantId)

    const { data, error } = await this.db
      .from('tenant_subscriptions')
      .update({
        plan_id:              plan.id,
        status:               'active',
        trial_end:            null,
        cancel_at_period_end: false,
        cancelled_at:         null,
        current_period_start: new Date().toISOString(),
        current_period_end:   new Date(Date.now() + 30 * 86400000).toISOString(),
      })
      .eq('tenant_id', tenantId)
      .select().single()

    if (error) throw new BadRequestException(error.message)

    await this.db.from('plan_change_history').insert({
      tenant_id:    tenantId,
      from_plan_id: sub?.plan_id ?? null,
      to_plan_id:   plan.id,
      changed_by:   actorId,
      reason:       'Super Admin manual upgrade',
    })

    return data
  }

  // ── RAZORPAY INTEGRATION ─────────────────────────────────────────────────

  /**
   * createCheckoutOrder()
   * Creates a Razorpay order for plan upgrade.
   * Returns { order_id, amount, currency, key_id } for the frontend SDK.
   */
  async createCheckoutOrder(
    tenantId: string,
    planSlug: PlanSlug,
    billingPeriod: 'monthly' | 'yearly' = 'monthly',
  ): Promise<any> {
    const { data: plan } = await this.db
      .from('subscription_plans')
      .select('id, slug, name, price_monthly, price_yearly, currency')
      .eq('slug', planSlug)
      .maybeSingle()

    if (!plan) throw new NotFoundException('Plan not found')

    const amount = billingPeriod === 'yearly' ? plan.price_yearly : plan.price_monthly
    if (!amount) throw new BadRequestException('This plan is free — no payment required')

    const keyId     = this.config.get<string>('razorpay.keyId')
    const keySecret = this.config.get<string>('razorpay.keySecret')
    if (!keyId || !keySecret) throw new BadRequestException('Payment gateway not configured')

    const authHeader = Buffer.from(`${keyId}:${keySecret}`).toString('base64')
    const orderRes   = await fetch('https://api.razorpay.com/v1/orders', {
      method:  'POST',
      headers: {
        Authorization:  `Basic ${authHeader}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount:   amount * 100,   // paise
        currency: plan.currency ?? 'INR',
        receipt:  `sub_${tenantId.replace(/-/g, '').slice(0, 16)}_${Date.now()}`,
        notes: {
          tenant_id:      tenantId,
          plan_slug:      planSlug,
          billing_period: billingPeriod,
        },
      }),
    })

    if (!orderRes.ok) {
      const err = await orderRes.json().catch(() => ({}))
      this.logger.error('Razorpay order creation failed', err)
      throw new BadRequestException('Failed to create payment order')
    }

    const order = await orderRes.json()

    return {
      order_id:       order.id,
      amount:         order.amount,
      currency:       order.currency,
      key_id:         keyId,
      plan_name:      plan.name,
      billing_period: billingPeriod,
    }
  }

  /**
   * handleRazorpayWebhook()
   * HMAC-SHA256 signature verification + event routing.
   */
  async handleRazorpayWebhook(rawBody: Buffer, signature: string): Promise<void> {
    const webhookSecret = this.config.get<string>('razorpay.webhookSecret')
    if (!webhookSecret) throw new BadRequestException('Webhook secret not configured')

    const expected = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex')

    if (expected !== signature) {
      this.logger.warn('Razorpay webhook: signature mismatch')
      throw new ForbiddenException('Invalid webhook signature')
    }

    const payload = JSON.parse(rawBody.toString('utf8'))
    const event   = payload.event as string
    const entity  = payload.payload?.payment?.entity ?? payload.payload?.subscription?.entity ?? {}
    const notes   = entity.notes ?? {}

    this.logger.log(`Razorpay webhook: ${event}`)

    switch (event) {
      case 'payment.captured': {
        const tenantId     = notes.tenant_id as string | undefined
        const planSlug     = (notes.plan_slug ?? 'starter') as PlanSlug
        const billingPeriod = (notes.billing_period ?? 'monthly') as 'monthly' | 'yearly'
        if (!tenantId) break

        const { data: plan } = await this.db
          .from('subscription_plans').select('id').eq('slug', planSlug).maybeSingle()
        if (!plan) break

        const periodDays = billingPeriod === 'yearly' ? 365 : 30
        const now        = new Date()
        const sub        = await this.getRawSubscription(tenantId)

        await this.db.from('tenant_subscriptions').update({
          plan_id:              plan.id,
          status:               'active',
          billing_period:       billingPeriod,
          trial_end:            null,
          cancel_at_period_end: false,
          cancelled_at:         null,
          current_period_start: now.toISOString(),
          current_period_end:   new Date(now.getTime() + periodDays * 86400000).toISOString(),
          razorpay_customer_id: entity.customer_id ?? null,
          payment_provider:     'razorpay',
          external_customer_id: entity.customer_id ?? null,
        }).eq('tenant_id', tenantId)

        await this.db.from('plan_change_history').insert({
          tenant_id:    tenantId,
          from_plan_id: sub?.plan_id ?? null,
          to_plan_id:   plan.id,
          reason:       `Upgraded via Razorpay payment ${entity.id}`,
        })
        break
      }

      case 'subscription.charged': {
        const razorpaySubId = entity.id as string
        if (!razorpaySubId) break
        const now = new Date()
        await this.db.from('tenant_subscriptions')
          .update({
            status:               'active',
            current_period_start: now.toISOString(),
            current_period_end:   new Date(now.getTime() + 30 * 86400000).toISOString(),
          })
          .eq('razorpay_subscription_id', razorpaySubId)
        break
      }

      case 'subscription.halted': {
        const razorpaySubId = entity.id as string
        if (!razorpaySubId) break
        await this.db.from('tenant_subscriptions')
          .update({ status: 'past_due' })
          .eq('razorpay_subscription_id', razorpaySubId)
        break
      }

      case 'subscription.cancelled': {
        const razorpaySubId = entity.id as string
        if (!razorpaySubId) break
        await this.db.from('tenant_subscriptions')
          .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
          .eq('razorpay_subscription_id', razorpaySubId)
        break
      }

      default:
        this.logger.debug(`Unhandled Razorpay event: ${event}`)
    }
  }

  // ── SCHEDULED JOB ────────────────────────────────────────────────────────

  /**
   * checkTrialExpiry()
   * Called by @Cron daily. Expires trials + downgrades to Free after 7-day grace.
   */
  async checkTrialExpiry(): Promise<void> {
    const now = new Date().toISOString()

    const expiredResult = await this.db
      .from('tenant_subscriptions')
      .update({ status: 'expired' })
      .eq('status', 'trialing')
      .lt('trial_end', now)
      .select('id')

    const expiredCount = expiredResult.data?.length ?? 0
    if (expiredCount > 0) this.logger.log(`Trial expiry: ${expiredCount} tenant(s) expired`)

    const graceCutoff  = new Date(Date.now() - 7 * 86400000).toISOString()
    const { data: freePlan } = await this.db
      .from('subscription_plans').select('id').eq('slug', 'free').maybeSingle()

    if (freePlan) {
      const downgradedResult = await this.db
        .from('tenant_subscriptions')
        .update({ plan_id: freePlan.id, status: 'active' })
        .in('status', ['expired', 'past_due'])
        .lt('updated_at', graceCutoff)
        .select('id')

      const downgradedCount = downgradedResult.data?.length ?? 0
      if (downgradedCount > 0) this.logger.log(`Trial expiry: ${downgradedCount} tenant(s) downgraded to Free`)
    }
  }
}
