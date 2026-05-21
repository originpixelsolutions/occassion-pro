/**
 * OccasionPro — Event-Level Access Service
 *
 * Manages per-event team access and module overrides.
 * Works alongside workspace-level RBAC — event access is a scope restriction
 * on top of (never in place of) workspace role permissions.
 *
 * Access priority chain (highest wins):
 *   1. Super Admin → always full access
 *   2. Workspace Owner → always full access
 *   3. Event-level removal (is_active=false) → no access to this event
 *   4. Event-level module override → use override value
 *   5. Workspace role default → use role's default permission
 */

import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common'
import { SupabaseService } from '../../common/supabase/supabase.service'
import { NotificationsService } from '../notifications/notifications.service'

export type ModuleKey =
  | 'crm'
  | 'finance'
  | 'guests'
  | 'vendors'
  | 'operations'
  | 'production'
  | 'hospitality'
  | 'artists'
  | 'venues'
  | 'inventory'
  | 'marketing'
  | 'support'

export type ModuleAccess = 'none' | 'view' | 'edit' | 'full'

export interface ModuleOverrides {
  [key: string]: ModuleAccess
}

export interface EventTeamMember {
  user_id: string
  name: string
  email: string
  avatar_url: string | null
  workspace_role: string
  is_active: boolean
  module_overrides: ModuleOverrides | null
  added_by: string | null
  added_at: string | null
  removed_by: string | null
  removed_at: string | null
}

@Injectable()
export class EventAccessService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // ─── Get team for an event ─────────────────────────────────────────────────

  async getEventTeam(eventId: string, tenantId: string): Promise<EventTeamMember[]> {
    // Verify event belongs to tenant
    await this.assertEventBelongsToTenant(eventId, tenantId)

    const { data, error } = await this.supabase.serviceClient
      .rpc('get_event_team_with_access', { p_event_id: eventId })

    if (error) throw new BadRequestException(error.message)

    return data ?? []
  }

  // ─── Add a workspace member to an event ───────────────────────────────────

  async addToEvent(
    eventId: string,
    userId: string,
    addedBy: string,
    tenantId: string,
  ): Promise<{ success: true }> {
    await this.assertEventBelongsToTenant(eventId, tenantId)
    await this.assertUserIsTenantMember(userId, tenantId)

    // Upsert — if they were previously removed, re-activate
    const { error } = await this.supabase.serviceClient
      .from('team_event_access')
      .upsert(
        {
          event_id: eventId,
          user_id: userId,
          tenant_id: tenantId,
          is_active: true,
          added_by: addedBy,
          added_at: new Date().toISOString(),
          removed_by: null,
          removed_at: null,
          // Don't clear module_overrides on re-add — preserve previous customisations
        },
        { onConflict: 'event_id,user_id' },
      )

    if (error) throw new BadRequestException(error.message)

    return { success: true }
  }

  // ─── Remove a member from a specific event ────────────────────────────────

  async removeFromEvent(
    eventId: string,
    userId: string,
    removedBy: string,
    tenantId: string,
    reason?: string,
  ): Promise<{ success: true }> {
    await this.assertEventBelongsToTenant(eventId, tenantId)

    // Verify the remover has authority (owner can remove anyone; manager cannot remove owner/other managers)
    await this.assertRemovalAuthority(removedBy, userId, tenantId)

    // Soft-remove — workspace account stays intact
    const { error } = await this.supabase.serviceClient
      .from('team_event_access')
      .upsert(
        {
          event_id: eventId,
          user_id: userId,
          tenant_id: tenantId,
          is_active: false,
          removed_by: removedBy,
          removed_at: new Date().toISOString(),
          added_at: new Date().toISOString(), // required for upsert
        },
        { onConflict: 'event_id,user_id' },
      )

    if (error) throw new BadRequestException(error.message)

    // Log reason in audit_logs separately if provided
    if (reason) {
      await this.supabase.serviceClient.from('audit_logs').insert({
        tenant_id: tenantId,
        actor_id: removedBy,
        action: 'event_access.remove',
        entity_type: 'team_event_access',
        entity_id: `${eventId}:${userId}`,
        metadata: { reason, event_id: eventId, user_id: userId },
      })
    }

    // Notify the removed team member
    this.notificationsService.send({
      tenantId,
      recipientId: userId,
      recipientType: 'internal' as const,
      module: 'operations' as const,
      title: 'Removed from event',
      body: `You have been removed from this event${reason ? ': ' + reason : '.'}`,
      urgency: 'warning' as const,
      metadata: { event_id: eventId, removed_by: removedBy },
    }).catch(() => { /* swallow — notifications must not break access control */ })

    return { success: true }
  }

  // ─── Update per-module overrides for a member within an event ─────────────

  async updateModuleOverrides(
    eventId: string,
    userId: string,
    updatedBy: string,
    tenantId: string,
    overrides: ModuleOverrides,
  ): Promise<{ success: true }> {
    await this.assertEventBelongsToTenant(eventId, tenantId)
    await this.assertUserIsTenantMember(userId, tenantId)
    await this.assertRemovalAuthority(updatedBy, userId, tenantId)

    // Validate all override keys are known modules
    const KNOWN_MODULES: ModuleKey[] = [
      'crm', 'finance', 'guests', 'vendors', 'operations',
      'production', 'hospitality', 'artists', 'venues',
      'inventory', 'marketing', 'support',
    ]
    const VALID_ACCESS: ModuleAccess[] = ['none', 'view', 'edit', 'full']

    for (const [key, value] of Object.entries(overrides)) {
      if (!KNOWN_MODULES.includes(key as ModuleKey)) {
        throw new BadRequestException(`Unknown module key: ${key}`)
      }
      if (!VALID_ACCESS.includes(value)) {
        throw new BadRequestException(`Invalid access level "${value}" for module "${key}"`)
      }
    }

    // Upsert — ensure row exists (member may not have an explicit event_access row)
    const { error } = await this.supabase.serviceClient
      .from('team_event_access')
      .upsert(
        {
          event_id: eventId,
          user_id: userId,
          tenant_id: tenantId,
          is_active: true,
          module_overrides: overrides,
          added_by: updatedBy,
          added_at: new Date().toISOString(),
        },
        { onConflict: 'event_id,user_id' },
      )

    if (error) throw new BadRequestException(error.message)

    return { success: true }
  }

  // ─── Check effective access for a user on an event ────────────────────────

  async checkAccess(
    userId: string,
    eventId: string,
    moduleKey?: ModuleKey,
  ): Promise<{ access: ModuleAccess; source: string }> {
    const { data, error } = await this.supabase.serviceClient
      .rpc('check_event_module_access', {
        p_user_id: userId,
        p_event_id: eventId,
        p_module: moduleKey ?? null,
      })

    if (error) throw new BadRequestException(error.message)

    return data ?? { access: 'none', source: 'default' }
  }

  // ─── Get single member's event access row ─────────────────────────────────

  async getMemberAccess(
    eventId: string,
    userId: string,
    tenantId: string,
  ): Promise<EventTeamMember | null> {
    await this.assertEventBelongsToTenant(eventId, tenantId)

    const { data, error } = await this.supabase.serviceClient
      .from('team_event_access')
      .select(`
        user_id,
        is_active,
        module_overrides,
        added_by,
        added_at,
        removed_by,
        removed_at,
        users:user_id (name, email, avatar_url),
        tenant_members!inner (role)
      `)
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
      .single()

    if (error || !data) return null

    return {
      user_id: data.user_id,
      name: (data.users as any)?.name,
      email: (data.users as any)?.email,
      avatar_url: (data.users as any)?.avatar_url,
      workspace_role: (data.tenant_members as any)?.role,
      is_active: data.is_active,
      module_overrides: data.module_overrides,
      added_by: data.added_by,
      added_at: data.added_at,
      removed_by: data.removed_by,
      removed_at: data.removed_at,
    }
  }

  // ─── Clear all module overrides for a member ──────────────────────────────

  async clearModuleOverrides(
    eventId: string,
    userId: string,
    clearedBy: string,
    tenantId: string,
  ): Promise<{ success: true }> {
    await this.assertEventBelongsToTenant(eventId, tenantId)
    await this.assertRemovalAuthority(clearedBy, userId, tenantId)

    const { error } = await this.supabase.serviceClient
      .from('team_event_access')
      .update({ module_overrides: null })
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)

    if (error) throw new BadRequestException(error.message)

    return { success: true }
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private async assertEventBelongsToTenant(eventId: string, tenantId: string) {
    const { data } = await this.supabase.serviceClient
      .from('events')
      .select('id')
      .eq('id', eventId)
      .eq('tenant_id', tenantId)
      .single()

    if (!data) throw new NotFoundException('Event not found')
  }

  private async assertUserIsTenantMember(userId: string, tenantId: string) {
    const { data } = await this.supabase.serviceClient
      .from('user_roles')
      .select('id')
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .single()

    if (!data) throw new BadRequestException('User is not an active member of this workspace')
  }

  private async assertRemovalAuthority(
    actorId: string,
    targetUserId: string,
    tenantId: string,
  ) {
    // Get actor's role
    const { data: actor } = await this.supabase.serviceClient
      .from('user_roles')
      .select('role')
      .eq('user_id', actorId)
      .eq('tenant_id', tenantId)
      .single()

    if (!actor) throw new ForbiddenException('Actor is not a workspace member')

    // Owner can restrict anyone
    if (actor.role === 'owner') return

    // Event managers can only restrict team_leads and team_members
    if (actor.role === 'event_manager') {
      const { data: target } = await this.supabase.serviceClient
        .from('user_roles')
        .select('role')
        .eq('user_id', targetUserId)
        .eq('tenant_id', tenantId)
        .single()

      if (!target) throw new NotFoundException('Target user not found in workspace')

      const RESTRICTABLE = ['team_lead', 'team_member']
      if (!RESTRICTABLE.includes(target.role)) {
        throw new ForbiddenException(
          'Event Managers can only restrict Team Leads and Team Members from events',
        )
      }
      return
    }

    // Team leads and members cannot restrict anyone
    throw new ForbiddenException(
      'Insufficient permissions to modify event access. Only Workspace Owners and Event Managers can restrict event access.',
    )
  }
}
