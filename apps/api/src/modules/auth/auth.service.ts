import { Injectable, UnauthorizedException, Logger } from '@nestjs/common'
import { SupabaseService } from '../../common/supabase/supabase.service'
import { ConfigService } from '@nestjs/config'
import { BruteForceService } from '../../common/security/brute-force.service'
import { SecurityAuditService } from '../../common/security/security-audit.service'

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name)

  constructor(
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService,
    private readonly bruteForce: BruteForceService,
    private readonly audit: SecurityAuditService,
  ) {}

  async signUp(
    email: string,
    password: string,
    metadata: { full_name: string; tenant_slug?: string },
    ip?: string,
  ) {
    // Brute-force check before signup attempt (prevents account enumeration via timing)
    await this.bruteForce.checkLockout(ip ?? '', email, 'signup', 10, 15)

    const adminClient = this.supabase.serviceClient

    // If new tenant slug provided, create tenant first
    let tenantId: string | undefined
    if (metadata.tenant_slug) {
      const { data: tenant, error: tErr } = await adminClient
        .from('tenants')
        .insert({
          name: metadata.full_name + "'s Company",
          slug: metadata.tenant_slug,
          plan: 'starter',
        })
        .select()
        .single()
      if (tErr) {
        await this.bruteForce.recordAttempt({ ip: ip ?? '', identifier: email, type: 'signup', success: false })
        this.audit.log({ action: 'auth.signup_failed', ip, metadata: { email, reason: tErr.message } })
        throw new Error(`Tenant creation failed: ${tErr.message}`)
      }
      tenantId = tenant.id
    }

    // Create Supabase auth user
    const { data, error } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
      user_metadata: {
        full_name: metadata.full_name,
        tenant_id: tenantId,
      },
    })

    if (error) {
      await this.bruteForce.recordAttempt({ ip: ip ?? '', identifier: email, type: 'signup', success: false })
      this.audit.log({ action: 'auth.signup_failed', ip, metadata: { email, reason: error.message } })
      throw new Error(error.message)
    }

    await this.bruteForce.recordAttempt({ ip: ip ?? '', identifier: email, type: 'signup', success: true })
    this.audit.log({
      action: 'auth.signup_success',
      userId: data.user?.id,
      ip,
      metadata: { email, tenantId },
    })

    return {
      user_id: data.user?.id,
      email: data.user?.email,
      message: 'Account created. Please verify your email.',
    }
  }

  async signIn(email: string, password: string, ip?: string, userAgent?: string) {
    // SECURITY: Check brute-force lockout BEFORE attempting auth to prevent timing oracle
    await this.bruteForce.checkLockout(ip ?? '', email, 'login_password', 10, 15)

    const { createClient } = await import('@supabase/supabase-js')
    const client = createClient(
      this.config.get<string>('SUPABASE_URL', ''),
      this.config.get<string>('SUPABASE_ANON_KEY', ''),
    )

    const { data, error } = await client.auth.signInWithPassword({ email, password })

    if (error) {
      // Record failed attempt — fires-and-forgets internally, no await needed here
      await this.bruteForce.recordAttempt({
        ip: ip ?? '',
        identifier: email,
        type: 'login_password',
        success: false,
      })
      this.audit.log({
        action: 'auth.login_failed',
        ip,
        userAgent,
        metadata: { email, reason: 'invalid_credentials' },
      })
      throw new UnauthorizedException(error.message)
    }

    // Successful login — record and audit
    await this.bruteForce.recordAttempt({
      ip: ip ?? '',
      identifier: email,
      type: 'login_password',
      success: true,
    })
    const profile = await this.supabase.getProfile(data.user!.id)
    this.audit.log({
      action: 'auth.login_success',
      userId: data.user!.id,
      tenantId: profile?.tenant_id,
      ip,
      userAgent,
      metadata: { email },
    })

    return {
      access_token: data.session!.access_token,
      refresh_token: data.session!.refresh_token,
      expires_at: data.session!.expires_at,
      user: {
        id: data.user!.id,
        email: data.user!.email,
        profile,
      },
    }
  }

  async refreshToken(refreshToken: string) {
    const { createClient } = await import('@supabase/supabase-js')
    const client = createClient(
      this.config.get<string>('SUPABASE_URL', ''),
      this.config.get<string>('SUPABASE_ANON_KEY', ''),
    )
    const { data, error } = await client.auth.refreshSession({ refresh_token: refreshToken })
    if (error) throw new UnauthorizedException(error.message)
    return {
      access_token: data.session!.access_token,
      refresh_token: data.session!.refresh_token,
      expires_at: data.session!.expires_at,
    }
  }

  async signOut(userId: string) {
    // Invalidate all sessions for the user
    await this.supabase.serviceClient.auth.admin.signOut(userId, 'global')
    this.audit.log({ action: 'auth.logout', userId })
    return { success: true }
  }

  async getMe(userId: string, token: string) {
    const profile = await this.supabase.getProfile(userId)
    return { id: userId, profile }
  }

  async updateProfile(userId: string, dto: any, token: string) {
    const client = this.supabase.forRequest(token)
    const { data, error } = await client
      .from('profiles')
      .update({ ...dto, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select()
      .single()
    if (error) throw new Error(error.message)
    this.audit.log({ action: 'auth.profile_updated', userId, metadata: { fields: Object.keys(dto) } })
    return data
  }

  async changePassword(userId: string, newPassword: string) {
    const { error } = await this.supabase.serviceClient.auth.admin.updateUserById(userId, {
      password: newPassword,
    })
    if (error) throw new Error(error.message)
    this.audit.log({ action: 'auth.password_changed', userId })
    return { success: true }
  }

  async initiatePasswordReset(email: string) {
    const { createClient } = await import('@supabase/supabase-js')
    const client = createClient(
      this.config.get<string>('SUPABASE_URL', ''),
      this.config.get<string>('SUPABASE_ANON_KEY', ''),
    )
    await client.auth.resetPasswordForEmail(email, {
      redirectTo: `${this.config.get('WEB_URL', 'https://app.occasionpro.in')}/auth/reset-password`,
    })
    // Always return the same message regardless of whether email exists (prevents enumeration)
    this.audit.log({ action: 'auth.password_reset_requested', metadata: { email } })
    return { message: 'If an account exists, a reset email has been sent.' }
  }
}
