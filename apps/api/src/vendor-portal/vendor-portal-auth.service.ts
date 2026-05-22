import { Injectable, UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common'
import { SupabaseService } from '../common/supabase/supabase.service'
import * as bcrypt from 'bcryptjs'
import * as crypto from 'crypto'

@Injectable()
export class VendorPortalAuthService {
  constructor(private readonly supabase: SupabaseService) {}

  // ── Registration ──────────────────────────────────────────────────────────

  async register(dto: {
    email: string
    name: string
    business_name?: string
    phone?: string
    category?: string
  }) {
    const client = this.supabase.serviceClient
    const normalEmail = dto.email.toLowerCase().trim()

    // Check for existing account
    const { data: existing } = await client
      .from('vendor_accounts')
      .select('id')
      .eq('email', normalEmail)
      .maybeSingle()

    if (existing) {
      throw new BadRequestException('An account with this email already exists.')
    }

    const { data: vendor, error } = await client
      .from('vendor_accounts')
      .insert({
        email: normalEmail,
        name: dto.name.trim(),
        business_name: dto.business_name?.trim() || null,
        phone: dto.phone?.trim() || null,
        category: dto.category || 'Other',
      })
      .select('id, email, name, category')
      .single()

    if (error) throw new BadRequestException(error.message)

    // Issue a set-password token so vendor can set their password
    const { token } = await this.createPasswordToken(vendor.id, 'set_password')
    return { vendor, set_password_token: token }
  }

  // ── Password token helpers ────────────────────────────────────────────────

  private async createPasswordToken(vendorId: string, purpose: 'reset' | 'set_password'): Promise<{ token: string }> {
    const client = this.supabase.serviceClient
    const plainToken = crypto.randomBytes(32).toString('hex')
    const tokenHash = crypto.createHash('sha256').update(plainToken).digest('hex')

    // Invalidate existing unused tokens for same vendor+purpose
    await client
      .from('vendor_password_reset_tokens')
      .update({ used: true })
      .eq('vendor_id', vendorId)
      .eq('purpose', purpose)
      .eq('used', false)

    await client
      .from('vendor_password_reset_tokens')
      .insert({ vendor_id: vendorId, token_hash: tokenHash, purpose })

    return { token: plainToken }
  }

  async requestPasswordReset(email: string) {
    const client = this.supabase.serviceClient
    const normalEmail = email.toLowerCase().trim()

    const { data: vendor } = await client
      .from('vendor_accounts')
      .select('id')
      .eq('email', normalEmail)
      .maybeSingle()

    // Always return success to avoid email enumeration
    if (!vendor) return { message: 'If that email exists, a reset link has been sent.' }

    const { token } = await this.createPasswordToken(vendor.id, 'reset')
    return { message: 'Reset link issued.', token, vendor_id: vendor.id }
  }

  async resetPassword(token: string, newPassword: string) {
    const client = this.supabase.serviceClient
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')

    const { data: record, error } = await client
      .from('vendor_password_reset_tokens')
      .select('id, vendor_id, used, expires_at, purpose')
      .eq('token_hash', tokenHash)
      .maybeSingle()

    if (error || !record) throw new BadRequestException('Invalid reset token.')
    if (record.used) throw new BadRequestException('Token already used.')
    if (new Date(record.expires_at) < new Date()) throw new BadRequestException('Token expired.')

    const passwordHash = await bcrypt.hash(newPassword, 12)

    await client
      .from('vendor_password_reset_tokens')
      .update({ used: true })
      .eq('id', record.id)

    await client
      .from('vendor_accounts')
      .update({ password_hash: passwordHash, profile_complete: true })
      .eq('id', record.vendor_id)

    const sessionToken = await this.createSession(record.vendor_id)
    return { session_token: sessionToken }
  }

  // ── Login ─────────────────────────────────────────────────────────────────

  async login(email: string, password: string) {
    const client = this.supabase.serviceClient
    const normalEmail = email.toLowerCase().trim()

    const { data: vendor } = await client
      .from('vendor_accounts')
      .select('id, email, name, business_name, category, avatar_url, is_active, password_hash, profile_complete')
      .eq('email', normalEmail)
      .maybeSingle()

    if (!vendor || !vendor.is_active) {
      throw new UnauthorizedException('Invalid credentials.')
    }

    if (!vendor.password_hash) {
      throw new UnauthorizedException('Password not set. Please use the registration link sent to your email.')
    }

    const valid = await bcrypt.compare(password, vendor.password_hash)
    if (!valid) throw new UnauthorizedException('Invalid credentials.')

    // Update last login
    await client
      .from('vendor_accounts')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', vendor.id)

    const sessionToken = await this.createSession(vendor.id)
    const { password_hash: _pw, ...vendorSafe } = vendor
    return { session_token: sessionToken, vendor: vendorSafe }
  }

  // ── Session management ────────────────────────────────────────────────────

  private async createSession(vendorId: string): Promise<string> {
    const client = this.supabase.serviceClient
    const { data, error } = await client
      .from('vendor_portal_sessions')
      .insert({ vendor_id: vendorId })
      .select('id')
      .single()

    if (error) throw new BadRequestException('Failed to create session.')
    return data.id
  }

  async validateSession(sessionToken: string): Promise<{ vendorId: string }> {
    const client = this.supabase.serviceClient

    const { data: session, error } = await client
      .from('vendor_portal_sessions')
      .select('id, vendor_id, expires_at')
      .eq('id', sessionToken)
      .maybeSingle()

    if (error || !session) throw new UnauthorizedException('Invalid session.')
    if (new Date(session.expires_at) < new Date()) {
      throw new UnauthorizedException('Session expired.')
    }

    // Fire-and-forget last_active_at update
    client
      .from('vendor_portal_sessions')
      .update({ last_active_at: new Date().toISOString() })
      .eq('id', sessionToken)
      .then(() => {})

    return { vendorId: session.vendor_id }
  }

  async logout(sessionToken: string) {
    const client = this.supabase.serviceClient
    await client
      .from('vendor_portal_sessions')
      .delete()
      .eq('id', sessionToken)
    return { message: 'Logged out.' }
  }
}
