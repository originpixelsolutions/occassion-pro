/**
 * OccasionPro — Tenant Registration Service
 *
 * Multi-step tenant provisioning:
 * 1. createAccount     → Supabase Auth user + short-lived reg token in Redis
 * 2. setupWorkspace    → Create tenant row, upload logo to R2
 * 3. startTrial        → Assign plan, set trial dates, issue full access token
 * 4. Notify Super Admin via pg_notify + email
 */

import {
  Injectable,
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common'
import { SupabaseService } from '../common/supabase/supabase.service'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import * as bcrypt from 'bcryptjs'
import { HaveIBeenPwned } from '../security/hibp.service'

interface RegSession {
  user_id: string
  email: string
  name: string
  step: 'account' | 'workspace' | 'complete'
  tenant_id?: string
}

@Injectable()
export class RegistrationService {
  private readonly REG_TOKEN_PREFIX = 'op:reg:'
  private readonly REG_TOKEN_TTL_SEC = 3600 // 1 hour to complete setup

  constructor(
    private readonly supabase: SupabaseService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly hibp: HaveIBeenPwned,
  ) {}

  // ─── Step 1: Create Account ────────────────────────────────────────────────

  async createAccount(name: string, email: string, password: string) {
    const db = this.supabase.serviceClient

    // Check if email already exists (profiles.email is synced from auth.users)
    const { data: existing } = await db
      .from('profiles')
      .select('id')
      .eq('email', email.toLowerCase())
      .maybeSingle()

    if (existing) throw new ConflictException('An account with this email already exists')

    // Check HaveIBeenPwned
    const isPwned = await this.hibp.isPasswordPwned(password)
    if (isPwned) {
      throw new BadRequestException(
        'This password has appeared in a data breach. Please choose a different password.'
      )
    }

    // Create Supabase auth user
    // Passing full_name (not name) so the on_auth_user_created trigger populates profiles.full_name
    const { data: authData, error: authError } = await db.auth.admin.createUser({
      email: email.toLowerCase(),
      password,
      email_confirm: true,
      user_metadata: { full_name: name },
    })

    if (authError) throw new BadRequestException(authError.message)

    // The on_auth_user_created trigger automatically creates a profiles row with full_name and email.
    // Upsert to also set role + status (new columns added in migration 087).
    const { error: userError } = await db
      .from('profiles')
      .upsert({
        id:        authData.user.id,
        email:     email.toLowerCase(),
        full_name: name,
        role:      'owner',
        status:    'active',
      })

    if (userError) throw new BadRequestException(userError.message)

    const userId = authData.user.id

    // Issue short-lived registration token
    const regToken = this.jwtService.sign(
      { sub: userId, email: email.toLowerCase(), type: 'registration', step: 'account' },
      { expiresIn: '1h' }
    )

    return { token: regToken, user: { id: userId, name, email: email.toLowerCase() } }
  }

  // ─── Step 2: Set Up Workspace ──────────────────────────────────────────────

  async setupWorkspace(
    regToken: string,
    data: {
      company_name: string
      slug: string
      timezone: string
      logo?: Express.Multer.File
    }
  ) {
    const session = this.verifyRegToken(regToken, 'account')
    const db = this.supabase.serviceClient

    // Double-check slug availability
    const slugAvail = await this.isSlugAvailable(data.slug)
    if (!slugAvail) throw new ConflictException('This workspace URL is already taken')

    let logo_url: string | null = null

    // Upload logo to Supabase Storage / R2
    if (data.logo) {
      const ext = data.logo.originalname.split('.').pop()
      const path = `tenants/${data.slug}/logo.${ext}`
      const { error } = await db.storage
        .from('public-assets')
        .upload(path, data.logo.buffer, {
          contentType: data.logo.mimetype,
          upsert: true,
        })
      if (!error) {
        const { data: urlData } = db.storage
          .from('public-assets')
          .getPublicUrl(path)
        logo_url = urlData.publicUrl
      }
    }

    // Create tenant record
    const { data: tenant, error: tenantError } = await db
      .from('tenants')
      .insert({
        name: data.company_name,
        slug: data.slug,
        timezone: data.timezone,
        logo_url,
        owner_id: session.user_id,
        status: 'trialing',
        health_score: 100,
      })
      .select('id, name, slug')
      .single()

    if (tenantError) throw new BadRequestException(tenantError.message)

    // Link user to tenant as workspace owner via user_roles (the correct membership table)
    await db.from('user_roles').insert({
      user_id:   session.user_id,
      tenant_id: tenant.id,
      role:      'owner',
      joined_at: new Date().toISOString(),
    })

    // Set primary tenant on the profile so profiles.tenant_id is populated
    await db
      .from('profiles')
      .update({ tenant_id: tenant.id, role: 'owner' })
      .eq('id', session.user_id)

    // Issue updated reg token with tenant_id and advanced step
    const updatedToken = this.jwtService.sign(
      {
        sub: session.user_id,
        email: session.email,
        tenant_id: tenant.id,
        type: 'registration',
        step: 'workspace',
      },
      { expiresIn: '1h' }
    )

    return { token: updatedToken, tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug } }
  }

  // ─── Step 3: Start Trial ───────────────────────────────────────────────────

  async startTrial(regToken: string, planId: string, billingCycle: 'monthly' | 'yearly') {
    const session = this.verifyRegToken(regToken, 'workspace')
    if (!session.tenant_id) throw new UnauthorizedException('Workspace not set up yet')

    const db = this.supabase.serviceClient

    // Verify plan exists
    const { data: plan, error: planError } = await db
      .from('subscription_plans')
      .select('*')
      .eq('id', planId)
      .eq('is_active', true)
      .single()

    if (planError || !plan) throw new BadRequestException('Plan not found')

    const trialEnd = new Date()
    trialEnd.setDate(trialEnd.getDate() + (plan.trial_days ?? 14))

    // Create subscription
    await db.from('tenant_subscriptions').insert({
      tenant_id: session.tenant_id,
      plan_id: planId,
      billing_cycle: billingCycle,
      status: 'trialing',
      trial_ends_at: trialEnd.toISOString(),
      current_period_start: new Date().toISOString(),
      current_period_end: trialEnd.toISOString(),
    })

    // Enable default modules for this plan
    if (plan.enabled_modules?.length) {
      const moduleInserts = plan.enabled_modules.map((m: string) => ({
        tenant_id: session.tenant_id,
        module_key: m,
        is_enabled: true,
      }))
      await db.from('tenant_module_settings').insert(moduleInserts)
    }

    // Update tenant status
    await db
      .from('tenants')
      .update({ status: 'trialing', plan_id: planId })
      .eq('id', session.tenant_id)

    // Create onboarding checklist (non-fatal — table created in migration 089)
    db.from('tenant_onboarding').insert([
      { tenant_id: session.tenant_id, step: 'create_first_event', completed: false },
      { tenant_id: session.tenant_id, step: 'invite_team', completed: false },
      { tenant_id: session.tenant_id, step: 'setup_payment', completed: false },
    ]).then(() => {}).catch(() => {})

    // Seed default role permissions for the 3 configurable roles (non-fatal)
    db.rpc('seed_default_role_permissions', {
      p_tenant_id: session.tenant_id,
    }).then(() => {}).catch(() => {})

    // Notify Super Admin (non-fatal — pg_notify function may not exist in all envs)
    db.rpc('notify_new_tenant', {
      p_tenant_id: session.tenant_id,
      p_tenant_name: session.email,
      p_plan_name: plan.name,
    }).catch(() => {})

    // Issue full access token
    const accessToken = this.jwtService.sign(
      {
        sub: session.user_id,
        email: session.email,
        tenant_id: session.tenant_id,
        role: 'owner',
      },
      { expiresIn: '1h' }
    )

    const refreshToken = this.jwtService.sign(
      { sub: session.user_id, tenant_id: session.tenant_id, type: 'refresh' },
      { expiresIn: '7d' }
    )

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      tenant: { id: session.tenant_id },
      trial_ends_at: trialEnd.toISOString(),
    }
  }

  // ─── Public plan listing ───────────────────────────────────────────────────

  async getPublicPlans() {
    const { data: plans } = await this.supabase.serviceClient
      .from('subscription_plans')
      .select('id, name, price_monthly, price_yearly, trial_days, max_events, max_users, max_storage_gb, features, is_popular')
      .eq('is_active', true)
      .eq('is_public', true)
      .order('price_monthly', { ascending: true })

    return { plans: plans ?? [] }
  }

  // ─── Slug availability ─────────────────────────────────────────────────────

  async isSlugAvailable(slug: string): Promise<boolean> {
    const RESERVED = ['www', 'api', 'app', 'admin', 'super', 'portal', 'login', 'register', 'help', 'support', 'mail', 'static', 'assets']
    if (RESERVED.includes(slug)) return false

    const { data } = await this.supabase.serviceClient
      .from('tenants')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()

    return !data
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private verifyRegToken(token: string, expectedStep: 'account' | 'workspace'): RegSession {
    try {
      const payload = this.jwtService.verify(token)
      if (payload.type !== 'registration') throw new Error('Not a registration token')
      if (payload.step !== expectedStep) {
        throw new BadRequestException(`Expected step: ${expectedStep}, got: ${payload.step}`)
      }
      return {
        user_id:   payload.sub,
        email:     payload.email,
        name:      payload.name ?? '',
        step:      payload.step,
        tenant_id: payload.tenant_id,
      }
    } catch (err) {
      if (err instanceof BadRequestException) throw err
      throw new UnauthorizedException('Invalid or expired registration token')
    }
  }
}
