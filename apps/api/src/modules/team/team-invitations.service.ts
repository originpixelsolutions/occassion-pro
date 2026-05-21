import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common'
import { randomBytes } from 'crypto'
import { SupabaseService } from '../../common/supabase/supabase.service'
import { SubscriptionService } from '../subscription/subscription.service'
import { NotificationsService } from '../notifications/notifications.service'

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface CreateInvitationDto {
  email: string
  name?: string
  role: 'event_manager' | 'team_lead' | 'team_member'
  tenantId: string
  invitedBy: string
}

export interface AcceptInvitationDto {
  token: string
  name: string
  password: string
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class TeamInvitationsService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly subscriptionSvc: SubscriptionService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private get db() {
    return this.supabase.serviceClient
  }

  // ── helpers ─────────────────────────────────────────────────────────────────

  private generateToken(): string {
    return randomBytes(32).toString('hex') // 64 hex chars
  }

  private isExpired(expiresAt: string): boolean {
    return new Date(expiresAt) < new Date()
  }

  // ── createInvitation ────────────────────────────────────────────────────────

  async createInvitation(dto: CreateInvitationDto) {
    const { email, name, role, tenantId, invitedBy } = dto

    // Check team member limit (pending invitations count toward the limit)
    const { count: memberCount } = await this.db
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
    const { count: pendingCount } = await this.db
      .from('team_invitations')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .is('accepted_at', null)
      .eq('is_revoked', false)
      .gt('expires_at', new Date().toISOString())
    await this.subscriptionSvc.checkLimit(tenantId, 'team', (memberCount ?? 0) + (pendingCount ?? 0))
    const emailLower = email.toLowerCase().trim()

    // 1. Check email not already a workspace member (profiles.email synced from auth.users)
    const { data: existingUser } = await this.db
      .from('profiles')
      .select('id')
      .eq('email', emailLower)
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (existingUser) {
      throw new ConflictException('This email is already a member of the workspace.')
    }

    // 2. Revoke any existing non-expired, non-accepted invitation for same workspace+email
    await this.db
      .from('team_invitations')
      .update({ is_revoked: true })
      .eq('tenant_id', tenantId)
      .eq('email', emailLower)
      .is('accepted_at', null)
      .eq('is_revoked', false)

    // 3. Fetch workspace name for email
    const { data: workspace } = await this.db
      .from('tenants')
      .select('name')
      .eq('id', tenantId)
      .single()

    // 4. Fetch inviter name
    const { data: inviter } = await this.db
      .from('profiles')
      .select('full_name, email')
      .eq('id', invitedBy)
      .single()

    // 5. Create invitation
    const token = this.generateToken()
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

    const { data: invitation, error } = await this.db
      .from('team_invitations')
      .insert({
        tenant_id:  tenantId,
        email:      emailLower,
        name:       name?.trim() || null,
        role,
        invited_by: invitedBy,
        token,
        expires_at: expiresAt,
      })
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)

    // 6. Send invitation email via Supabase Auth invite
    //    (falls back to a no-op if email is not configured — invite link still works)
    const inviteUrl = `${process.env.APP_URL ?? 'https://app.occasionpro.com'}/invite?token=${token}`
    const workspaceName = workspace?.name ?? 'OccasionPro'
    const inviterName   = inviter?.full_name ?? inviter?.email ?? 'Your workspace admin'
    const roleLabel     = role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

    try {
      await this.db.auth.admin.inviteUserByEmail(emailLower, {
        redirectTo: inviteUrl,
        data: {
          invite_token:   token,
          workspace_name: workspaceName,
          role:           roleLabel,
          invited_by:     inviterName,
        },
      })
    } catch {
      // Non-fatal — invitation record is already saved; link can be shared manually
    }

    // Fire-and-forget: notify the inviter that their invitation was sent
    this.notificationsService.sendNotification({
      tenantId,
      recipientId: invitedBy,
      recipientType: 'team',
      templateKey: 'team_invite',
      variables: {
        email: emailLower,
        name: name ?? emailLower,
        role: roleLabel,
        workspaceName,
        inviteUrl,
      },
      eventId: null,
    }).catch(() => {})

    return {
      id:         invitation.id,
      email:      invitation.email,
      role:       invitation.role,
      expires_at: invitation.expires_at,
      invite_url: inviteUrl,
    }
  }

  // ── getInvitation (public — by token) ───────────────────────────────────────

  async getInvitationByToken(token: string) {
    const { data, error } = await this.db
      .from('team_invitations')
      .select(`
        id, email, name, role, expires_at, accepted_at, is_revoked,
        tenants!team_invitations_tenant_id_fkey ( id, name, logo_url )
      `)
      .eq('token', token)
      .single()

    if (error || !data) throw new NotFoundException('Invitation not found.')
    if (data.accepted_at)  throw new BadRequestException('This invitation has already been accepted.')
    if (data.is_revoked)   throw new BadRequestException('This invitation has been revoked.')
    if (this.isExpired(data.expires_at)) throw new BadRequestException('This invitation has expired.')

    return {
      email:     data.email,
      name:      data.name,
      role:      data.role,
      workspace: (data as any).tenants,
    }
  }

  // ── acceptInvitation (public) ────────────────────────────────────────────────

  async acceptInvitation(dto: AcceptInvitationDto) {
    const { token, name, password } = dto

    // 1. Validate invitation
    const { data: invitation, error: findErr } = await this.db
      .from('team_invitations')
      .select('id, email, role, tenant_id, accepted_at, is_revoked, expires_at')
      .eq('token', token)
      .single()

    if (findErr || !invitation) throw new NotFoundException('Invitation not found.')
    if (invitation.accepted_at) throw new BadRequestException('Invitation already accepted.')
    if (invitation.is_revoked)  throw new BadRequestException('Invitation has been revoked.')
    if (this.isExpired(invitation.expires_at)) throw new BadRequestException('Invitation has expired.')

    // 2. Create Supabase Auth user
    const { data: authData, error: authErr } = await this.db.auth.admin.createUser({
      email:          invitation.email,
      password,
      email_confirm:  true,
      user_metadata: {
        full_name:    name.trim(),
        tenant_id:    invitation.tenant_id,
        role:         invitation.role,
      },
    })

    if (authErr) throw new BadRequestException(authErr.message)
    const userId = authData.user.id

    // 3. Upsert profiles row — trigger may already have created it on auth.user insert
    const { error: profileErr } = await this.db
      .from('profiles')
      .upsert({
        id:        userId,
        email:     invitation.email,
        full_name: name.trim(),
        tenant_id: invitation.tenant_id,
        role:      invitation.role,
        status:    'active',
      })

    if (profileErr) {
      // Rollback auth user to prevent orphans
      await this.db.auth.admin.deleteUser(userId)
      throw new BadRequestException(profileErr.message)
    }

    // 4. Mark invitation as accepted
    await this.db
      .from('team_invitations')
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', invitation.id)

    // 5. Sign in and return session so the frontend can redirect to dashboard
    const { data: session, error: signInErr } = await this.db.auth.admin.generateLink({
      type:  'magiclink',
      email: invitation.email,
    })

    return {
      success:    true,
      user_id:    userId,
      email:      invitation.email,
      tenant_id:  invitation.tenant_id,
      role:       invitation.role,
      // The frontend will do a normal signInWithPassword after this
    }
  }

  // ── listInvitations ──────────────────────────────────────────────────────────

  async listInvitations(tenantId: string) {
    const { data, error } = await this.db
      .from('team_invitations')
      .select(`
        id, email, name, role, expires_at, accepted_at, is_revoked, created_at,
        profiles!team_invitations_invited_by_fkey ( id, full_name, email )
      `)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })

    if (error) throw new BadRequestException(error.message)

    return (data ?? []).map(inv => ({
      ...inv,
      status: inv.accepted_at
        ? 'accepted'
        : inv.is_revoked
        ? 'revoked'
        : this.isExpired(inv.expires_at)
        ? 'expired'
        : 'pending',
    }))
  }

  // ── revokeInvitation ─────────────────────────────────────────────────────────

  async revokeInvitation(id: string, tenantId: string) {
    const { data, error } = await this.db
      .from('team_invitations')
      .update({ is_revoked: true })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .is('accepted_at', null)
      .select('id')
      .single()

    if (error || !data) throw new NotFoundException('Invitation not found or already accepted.')
    return { revoked: true }
  }

  // ── resendInvitation ─────────────────────────────────────────────────────────

  async resendInvitation(id: string, tenantId: string) {
    const { data: inv, error } = await this.db
      .from('team_invitations')
      .select('id, email, name, role, accepted_at, is_revoked, tenant_id')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single()

    if (error || !inv) throw new NotFoundException('Invitation not found.')
    if (inv.accepted_at) throw new BadRequestException('Invitation already accepted.')
    if (inv.is_revoked)  throw new BadRequestException('Invitation was revoked.')

    // Generate fresh token + reset expiry
    const token      = this.generateToken()
    const expiresAt  = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    const inviteUrl  = `${process.env.APP_URL ?? 'https://app.occasionpro.com'}/invite?token=${token}`

    await this.db
      .from('team_invitations')
      .update({ token, expires_at: expiresAt })
      .eq('id', id)

    // Re-send email
    try {
      await this.db.auth.admin.inviteUserByEmail(inv.email, {
        redirectTo: inviteUrl,
        data: { invite_token: token, role: inv.role },
      })
    } catch { /* non-fatal */ }

    return { resent: true, invite_url: inviteUrl, expires_at: expiresAt }
  }
}
