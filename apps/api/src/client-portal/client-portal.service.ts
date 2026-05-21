/**
 * OccasionPro — Client Portal Service v2
 * Magic link + email/password auth, UUID session tokens, per-tenant email scoping
 */

import {
  Injectable, NotFoundException, BadRequestException,
  UnauthorizedException, Logger,
} from '@nestjs/common'
import { SupabaseService } from '../common/supabase/supabase.service'
import * as bcrypt from 'bcryptjs'
import * as crypto from 'crypto'

export type AccessLevel = 'view_only' | 'collaborator' | 'full_access'

const ACCESS_RANK: Record<AccessLevel, number> = {
  view_only: 0,
  collaborator: 1,
  full_access: 2,
}

@Injectable()
export class ClientPortalService {
  private readonly logger = new Logger(ClientPortalService.name)

  constructor(
    private readonly supabase: SupabaseService,
  ) {}

  // ─── Magic Link Auth ───────────────────────────────────────────────────────

  /**
   * Step 1: request magic link. Find or create per-tenant client account.
   * Returns the plain token (caller must email it to the user).
   */
  async initiateMagicLink(email: string, tenantId: string, purpose: 'login' | 'set_password' = 'login') {
    const normalEmail = email.toLowerCase().trim()

    // Per-tenant lookup
    const { data: client } = await this.supabase.serviceClient
      .from('client_accounts')
      .select('id, full_name, profile_complete')
      .eq('email', normalEmail)
      .eq('tenant_id', tenantId)
      .single()

    let clientId: string
    let isNew = false

    if (client) {
      clientId = client.id
    } else {
      // Create placeholder — staff will have invited them first via client_event_access
      // but we allow self-serve create for magic link flow
      const { data: newClient, error } = await this.supabase.serviceClient
        .from('client_accounts')
        .insert({
          email: normalEmail,
          full_name: normalEmail.split('@')[0],
          tenant_id: tenantId,
          profile_complete: false,
        })
        .select('id')
        .single()
      if (error) throw new BadRequestException(error.message)
      clientId = newClient.id
      isNew = true
    }

    // Invalidate existing unused links for this client+purpose
    await this.supabase.serviceClient.from('client_magic_links')
      .update({ used: true })
      .eq('client_id', clientId)
      .eq('tenant_id', tenantId)
      .eq('purpose', purpose)
      .eq('used', false)

    const plainToken = crypto.randomBytes(32).toString('hex')
    const tokenHash = crypto.createHash('sha256').update(plainToken).digest('hex')

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

    const { error: insertErr } = await this.supabase.serviceClient.from('client_magic_links').insert({
      client_id: clientId,
      tenant_id: tenantId,
      token_hash: tokenHash,
      purpose,
      expires_at: expiresAt,
    })
    if (insertErr) throw new BadRequestException(insertErr.message)

    return {
      token: plainToken,
      client_id: clientId,
      is_new: isNew,
      needs_password: !(client?.profile_complete ?? false),
    }
  }

  /**
   * Step 2: verify magic link token. Returns session token + client info.
   */
  async verifyMagicLink(token: string, tenantId: string) {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')

    const { data: link } = await this.supabase.serviceClient
      .from('client_magic_links')
      .select('id, client_id, purpose, used, expires_at')
      .eq('token_hash', tokenHash)
      .eq('tenant_id', tenantId)
      .single()

    if (!link) throw new UnauthorizedException('Invalid or expired magic link.')
    if (link.used) throw new UnauthorizedException('This link has already been used.')
    if (new Date(link.expires_at) < new Date()) throw new UnauthorizedException('This link has expired.')

    // Mark used
    await this.supabase.serviceClient.from('client_magic_links')
      .update({ used: true }).eq('id', link.id)

    // Fetch client
    const { data: client } = await this.supabase.serviceClient
      .from('client_accounts')
      .select('id, email, full_name, profile_complete, avatar_url')
      .eq('id', link.client_id)
      .single()

    if (!client) throw new UnauthorizedException('Client account not found.')

    // Update last_login
    await this.supabase.serviceClient.from('client_accounts')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', client.id)

    const sessionToken = await this.createSession(client.id, tenantId)

    return {
      session_token: sessionToken,
      client: { id: client.id, email: client.email, full_name: client.full_name, avatar_url: client.avatar_url },
      needs_password: !client.profile_complete,
      purpose: link.purpose,
    }
  }

  // ─── Email + Password Auth ─────────────────────────────────────────────────

  async loginWithPassword(email: string, password: string, tenantId: string) {
    const { data: client } = await this.supabase.serviceClient
      .from('client_accounts')
      .select('*')
      .eq('email', email.toLowerCase().trim())
      .eq('tenant_id', tenantId)
      .single()

    if (!client) throw new UnauthorizedException('Invalid email or password.')

    if (!client.password_hash) {
      throw new UnauthorizedException('Please use the magic link to sign in — no password has been set yet.')
    }

    const valid = await bcrypt.compare(password, client.password_hash)
    if (!valid) throw new UnauthorizedException('Invalid email or password.')

    await this.supabase.serviceClient.from('client_accounts')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', client.id)

    const sessionToken = await this.createSession(client.id, tenantId)

    return {
      session_token: sessionToken,
      client: { id: client.id, email: client.email, full_name: client.full_name, avatar_url: client.avatar_url },
    }
  }

  async setPassword(sessionToken: string, password: string) {
    const { clientId } = await this.validateSession(sessionToken)
    if (password.length < 8) throw new BadRequestException('Password must be at least 8 characters.')

    const hash = await bcrypt.hash(password, 12)
    await this.supabase.serviceClient.from('client_accounts')
      .update({ password_hash: hash, profile_complete: true })
      .eq('id', clientId)

    return { success: true }
  }

  async logout(sessionToken: string) {
    // Delete session from DB (expire it immediately)
    await this.supabase.serviceClient.from('client_portal_sessions')
      .update({ expires_at: new Date().toISOString() })
      .eq('id', sessionToken)
    return { success: true }
  }

  // ─── Session Management ────────────────────────────────────────────────────

  async validateSession(sessionToken: string): Promise<{ clientId: string; tenantId: string }> {
    const { data: session } = await this.supabase.serviceClient
      .from('client_portal_sessions')
      .select('client_id, tenant_id, expires_at')
      .eq('id', sessionToken)
      .single()

    if (!session) throw new UnauthorizedException('Invalid session. Please sign in again.')
    if (new Date(session.expires_at) < new Date()) {
      throw new UnauthorizedException('Session expired. Please sign in again.')
    }

    // Fire-and-forget: update last_active_at
    this.supabase.serviceClient.from('client_portal_sessions')
      .update({ last_active_at: new Date().toISOString() })
      .eq('id', sessionToken)
      .then(() => {})

    return { clientId: session.client_id, tenantId: session.tenant_id }
  }

  private async createSession(clientId: string, tenantId: string): Promise<string> {
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data, error } = await this.supabase.serviceClient
      .from('client_portal_sessions')
      .insert({ client_id: clientId, tenant_id: tenantId, expires_at: expiresAt })
      .select('id')
      .single()
    if (error) throw new BadRequestException('Could not create session: ' + error.message)
    return data.id // UUID used as session token
  }

  // ─── Access helpers ────────────────────────────────────────────────────────

  private async assertAccessAndReturn(
    clientId: string,
    eventId: string,
    minLevel?: AccessLevel,
  ): Promise<{ access_level: AccessLevel; tenant_id: string }> {
    const { data } = await this.supabase.serviceClient
      .from('client_event_access')
      .select('access_level, tenant_id')
      .eq('client_account_id', clientId)
      .eq('event_id', eventId)
      .is('revoked_at', null)
      .single()

    if (!data) throw new UnauthorizedException('Access denied.')

    if (minLevel && ACCESS_RANK[data.access_level as AccessLevel] < ACCESS_RANK[minLevel]) {
      throw new UnauthorizedException(
        `This action requires ${minLevel.replace('_', ' ')} access or higher.`,
      )
    }

    return { access_level: data.access_level as AccessLevel, tenant_id: data.tenant_id }
  }

  // ─── Invite client (staff) ────────────────────────────────────────────────

  async inviteClient(tenantId: string, eventId: string, email: string, accessLevel: AccessLevel, invitedBy: string) {
    const normalEmail = email.toLowerCase().trim()

    // Per-tenant lookup
    const { data: existing } = await this.supabase.serviceClient
      .from('client_accounts')
      .select('id, full_name, profile_complete')
      .eq('email', normalEmail)
      .eq('tenant_id', tenantId)
      .single()

    let clientId: string

    if (existing) {
      clientId = existing.id
    } else {
      const { data: newClient, error } = await this.supabase.serviceClient
        .from('client_accounts')
        .insert({
          email: normalEmail,
          full_name: normalEmail.split('@')[0],
          tenant_id: tenantId,
          profile_complete: false,
        })
        .select('id')
        .single()
      if (error) throw new BadRequestException(error.message)
      clientId = newClient.id
    }

    // Grant/upsert event access
    const { error: accessErr } = await this.supabase.serviceClient.from('client_event_access').upsert({
      client_account_id: clientId, event_id: eventId,
      tenant_id: tenantId, access_level: accessLevel,
      invited_by: invitedBy, invited_at: new Date().toISOString(), revoked_at: null,
    }, { onConflict: 'client_account_id,event_id' })
    if (accessErr) throw new BadRequestException(accessErr.message)

    // Issue magic link for login/setup
    const linkResult = await this.initiateMagicLink(
      normalEmail, tenantId,
      existing?.profile_complete ? 'login' : 'set_password',
    )

    return {
      existing: !!existing,
      email: normalEmail,
      client_id: clientId,
      invite_token: linkResult.token,
    }
  }

  // ─── Staff: list clients on an event ──────────────────────────────────────

  async getEventClients(tenantId: string, eventId: string) {
    const { data } = await this.supabase.serviceClient
      .from('client_event_access')
      .select(`
        id, access_level, invited_at, last_viewed_at, revoked_at,
        client_accounts:client_account_id (
          id, email, full_name, avatar_url, profile_complete, last_login_at
        )
      `)
      .eq('event_id', eventId)
      .eq('tenant_id', tenantId)
      .order('invited_at', { ascending: false })

    return { clients: data || [] }
  }

  // ─── Dashboard ─────────────────────────────────────────────────────────────

  async getClientDashboard(clientId: string) {
    const { data: accesses } = await this.supabase.serviceClient
      .from('client_event_access')
      .select(`
        id, access_level, invited_at, last_viewed_at,
        events:event_id (
          id, name, status, start_date, end_date, venue_name, city,
          tenants:tenant_id (id, name, logo_url)
        )
      `)
      .eq('client_account_id', clientId)
      .is('revoked_at', null)
      .order('invited_at', { ascending: false })

    const now = new Date()
    const upcoming: any[] = []
    const active: any[] = []
    const past: any[] = []

    for (const a of (accesses || [])) {
      const ev = a.events as any
      if (!ev) continue
      const card = {
        access_id: a.id, event_id: ev.id, name: ev.name,
        start_date: ev.start_date, end_date: ev.end_date, status: ev.status,
        venue_name: ev.venue_name, city: ev.city,
        access_level: a.access_level, last_viewed_at: a.last_viewed_at,
        tenant: ev.tenants,
      }
      if (ev.status === 'completed' || (ev.end_date && new Date(ev.end_date) < now)) {
        past.push(card)
      } else if (ev.start_date && new Date(ev.start_date) <= now) {
        active.push(card)
      } else {
        upcoming.push(card)
      }
    }

    return { upcoming, active, past }
  }

  // ─── Event Overview ────────────────────────────────────────────────────────

  async getEventOverview(clientId: string, eventId: string) {
    const { access_level } = await this.assertAccessAndReturn(clientId, eventId)

    // Track last viewed
    await this.supabase.serviceClient.from('client_event_access')
      .update({ last_viewed_at: new Date().toISOString() })
      .eq('client_account_id', clientId).eq('event_id', eventId)

    const [eventRes, approvalsRes, messagesRes, settingsRes] = await Promise.all([
      this.supabase.serviceClient.from('events').select(
        'id, name, status, start_date, end_date, venue_name, city, description, timezone, total_budget, currency_code'
      ).eq('id', eventId).single(),
      this.supabase.serviceClient.from('client_approvals').select('id, status').eq('event_id', eventId),
      this.supabase.serviceClient.from('client_messages')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', eventId)
        .eq('is_read_by_client', false)
        .eq('sender_type', 'team'),
      this.supabase.serviceClient.from('client_portal_settings').select('*').eq('event_id', eventId).single(),
    ])

    const approvals = approvalsRes.data || []
    const pendingApprovals = approvals.filter((a: any) => a.status === 'pending').length

    return {
      event: eventRes.data,
      access_level,
      unread_messages: messagesRes.count || 0,
      pending_approvals: pendingApprovals,
      total_approvals: approvals.length,
      settings: settingsRes.data || this.defaultPortalSettings(eventId, ''),
    }
  }

  // ─── Messages ─────────────────────────────────────────────────────────────

  async getMessages(clientId: string, eventId: string) {
    await this.assertAccessAndReturn(clientId, eventId)

    const { data } = await this.supabase.serviceClient
      .from('client_messages')
      .select('id, sender_type, sender_id, message, attachment_url, attachment_name, is_read_by_client, is_read_by_team, created_at')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true })

    // Mark team messages as read by client
    await this.supabase.serviceClient.from('client_messages')
      .update({ is_read_by_client: true })
      .eq('event_id', eventId)
      .eq('sender_type', 'team')
      .eq('is_read_by_client', false)

    return { messages: data || [] }
  }

  async sendMessage(clientId: string, eventId: string, message: string, attachmentUrl?: string, attachmentName?: string) {
    const { tenant_id } = await this.assertAccessAndReturn(clientId, eventId)
    if (!message?.trim()) throw new BadRequestException('Message cannot be empty.')

    const { data, error } = await this.supabase.serviceClient.from('client_messages').insert({
      event_id: eventId,
      tenant_id,
      sender_type: 'client',
      sender_id: clientId,
      message: message.trim(),
      attachment_url: attachmentUrl || null,
      attachment_name: attachmentName || null,
      is_read_by_team: false,
      is_read_by_client: true,
    }).select().single()

    if (error) throw new BadRequestException(error.message)
    return data
  }

  // Staff: send message to client
  async sendMessageAsStaff(tenantId: string, staffId: string, eventId: string, message: string, attachmentUrl?: string, attachmentName?: string) {
    if (!message?.trim()) throw new BadRequestException('Message cannot be empty.')

    const { data, error } = await this.supabase.serviceClient.from('client_messages').insert({
      event_id: eventId,
      tenant_id: tenantId,
      sender_type: 'team',
      sender_id: staffId,
      message: message.trim(),
      attachment_url: attachmentUrl || null,
      attachment_name: attachmentName || null,
      is_read_by_client: false,
      is_read_by_team: true,
    }).select().single()

    if (error) throw new BadRequestException(error.message)
    return data
  }

  // ─── Documents ────────────────────────────────────────────────────────────

  async getDocuments(clientId: string, eventId: string) {
    await this.assertAccessAndReturn(clientId, eventId)
    const { data } = await this.supabase.serviceClient
      .from('event_documents')
      .select('id, name, type, file_url, file_size, created_at, uploaded_by')
      .eq('event_id', eventId)
      .eq('client_visible', true)
      .order('created_at', { ascending: false })
    return { documents: data || [] }
  }

  // ─── Budget ───────────────────────────────────────────────────────────────

  async getEventBudget(clientId: string, eventId: string) {
    const { access_level } = await this.assertAccessAndReturn(clientId, eventId)
    const rank = ACCESS_RANK[access_level]

    // view_only: totals only
    if (rank === 0) {
      const { data: invoices } = await this.supabase.serviceClient
        .from('invoices')
        .select('total_amount, status, currency_code')
        .eq('event_id', eventId)
        .eq('client_visible', true)

      const total = (invoices || []).reduce((s: number, inv: any) => s + (inv.total_amount || 0), 0)
      const paid = (invoices || [])
        .filter((i: any) => i.status === 'paid')
        .reduce((s: number, inv: any) => s + (inv.total_amount || 0), 0)

      return {
        access_level,
        summary: { total, paid, outstanding: total - paid },
        currency_code: invoices?.[0]?.currency_code || 'INR',
      }
    }

    // collaborator: category breakdown from budget_lines
    if (rank === 1) {
      const { data: lines } = await this.supabase.serviceClient
        .from('budget_line_items')
        .select('category, description, estimated_amount, actual_amount, status')
        .eq('event_id', eventId)
        .order('category')

      const byCategory: Record<string, { estimated: number; actual: number; lines: any[] }> = {}
      for (const line of (lines || [])) {
        if (!byCategory[line.category]) byCategory[line.category] = { estimated: 0, actual: 0, lines: [] }
        byCategory[line.category].estimated += line.estimated_amount || 0
        byCategory[line.category].actual += line.actual_amount || 0
        byCategory[line.category].lines.push(line)
      }

      return { access_level, by_category: byCategory }
    }

    // full_access: budget_lines + invoices with vendor names
    const [linesRes, invoicesRes] = await Promise.all([
      this.supabase.serviceClient.from('budget_line_items')
        .select('*')
        .eq('event_id', eventId)
        .order('category'),
      this.supabase.serviceClient.from('invoices')
        .select('id, invoice_number, vendor_name, total_amount, status, due_date, currency_code, client_visible')
        .eq('event_id', eventId)
        .eq('client_visible', true)
        .order('due_date'),
    ])

    return {
      access_level,
      budget_lines: linesRes.data || [],
      invoices: invoicesRes.data || [],
    }
  }

  // ─── Approvals ────────────────────────────────────────────────────────────

  async getApprovals(clientId: string, eventId: string) {
    await this.assertAccessAndReturn(clientId, eventId)
    const { data } = await this.supabase.serviceClient
      .from('client_approvals')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })
    return { approvals: data || [] }
  }

  async submitApproval(clientId: string, eventId: string, approvalId: string, status: 'approved' | 'changes_requested', comment?: string) {
    await this.assertAccessAndReturn(clientId, eventId, 'collaborator')
    const { error } = await this.supabase.serviceClient.from('client_approvals').update({
      status, review_comment: comment,
      reviewed_by: clientId, reviewed_at: new Date().toISOString(),
    }).eq('id', approvalId).eq('event_id', eventId)
    if (error) throw new BadRequestException(error.message)
    return { success: true }
  }

  async createApproval(tenantId: string, eventId: string, dto: {
    title: string; description?: string; file_url?: string
    deadline?: string; submitted_by: string
  }) {
    const { data, error } = await this.supabase.serviceClient.from('client_approvals').insert({
      tenant_id: tenantId, event_id: eventId, ...dto,
    }).select().single()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  // ─── Portal Settings (staff) ──────────────────────────────────────────────

  async getPortalSettings(tenantId: string, eventId: string) {
    const { data } = await this.supabase.serviceClient.from('client_portal_settings')
      .select('*').eq('event_id', eventId).single()
    return data || this.defaultPortalSettings(eventId, tenantId)
  }

  async upsertPortalSettings(tenantId: string, eventId: string, settings: any) {
    const { data, error } = await this.supabase.serviceClient.from('client_portal_settings').upsert({
      tenant_id: tenantId, event_id: eventId, ...settings,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'event_id' }).select().single()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  // ─── Revoke access ────────────────────────────────────────────────────────

  async revokeAccess(tenantId: string, clientId: string, eventId: string) {
    await this.supabase.serviceClient.from('client_event_access')
      .update({ revoked_at: new Date().toISOString() })
      .eq('client_account_id', clientId).eq('event_id', eventId).eq('tenant_id', tenantId)
    return { success: true }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private defaultPortalSettings(eventId: string, tenantId: string) {
    return {
      event_id: eventId, tenant_id: tenantId, enabled: true,
      section_overview: true, section_approvals: true, section_budget: true,
      section_payments: true, section_documents: true, section_timeline: true,
      section_messages: true, section_gallery: true, section_reports: true,
    }
  }
}
