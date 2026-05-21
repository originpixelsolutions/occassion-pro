/**
 * OccasionPro — Event Access Guard
 *
 * Enforces event-level access control on any route scoped to a specific event.
 * Applied after the standard AuthGuard and optionally after WorkspaceRoleGuard.
 *
 * Usage:
 *   @UseGuards(EventAccessGuard)
 *   @RequireEventAccess('view')         // optional — defaults to 'view'
 *   @RequireEventModule('finance')      // optional — checks a specific module
 *
 * Access chain checked in order:
 *   1. Super Admin → bypass all checks
 *   2. Workspace Owner → bypass all checks  
 *   3. Event-level removal (is_active=false) → 403
 *   4. Event-level module override → use override value
 *   5. Workspace role default → use role's default permission
 */

import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { SupabaseService } from '../supabase/supabase.service'

// ─── Metadata keys ─────────────────────────────────────────────────────────

export const EVENT_ACCESS_LEVEL_KEY = 'event_required_access'
export const EVENT_MODULE_KEY = 'event_required_module'

export type EventAccessLevel = 'view' | 'edit' | 'full'

export const RequireEventAccess = (level: EventAccessLevel) =>
  SetMetadata(EVENT_ACCESS_LEVEL_KEY, level)

export const RequireEventModule = (module: string) =>
  SetMetadata(EVENT_MODULE_KEY, module)

// ─── Access level rank ─────────────────────────────────────────────────────

const ACCESS_RANK: Record<string, number> = {
  none: 0,
  view: 1,
  edit: 2,
  full: 3,
}

// ─── Guard ─────────────────────────────────────────────────────────────────

@Injectable()
export class EventAccessGuard implements CanActivate {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest()
    const userId: string = req.user?.sub
    const tenantId: string = req.tenantId
    const eventId: string = req.params?.eventId

    if (!userId || !tenantId || !eventId) {
      throw new ForbiddenException('Missing required context for event access check')
    }

    // ── 1. Super Admin bypass ──────────────────────────────────────────────
    const { data: superAdmin } = await this.supabase.serviceClient
      .from('super_admins')
      .select('id')
      .eq('user_id', userId)
      .single()

    if (superAdmin) return true

    // ── 2. Workspace Owner bypass ──────────────────────────────────────────
    const { data: member } = await this.supabase.serviceClient
      .from('user_roles')
      .select('role, is_active')
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
      .single()

    if (!member || member.is_active === false) {
      throw new ForbiddenException('Not an active member of this workspace')
    }

    if (member.role === 'owner') return true

    // ── 3-5. Check via DB function (removal + overrides + role default) ────
    const requiredModule: string | undefined = this.reflector.getAllAndOverride<string>(
      EVENT_MODULE_KEY,
      [context.getHandler(), context.getClass()],
    )

    const requiredLevel: EventAccessLevel =
      this.reflector.getAllAndOverride<EventAccessLevel>(
        EVENT_ACCESS_LEVEL_KEY,
        [context.getHandler(), context.getClass()],
      ) ?? 'view'

    const { data: accessResult, error } = await this.supabase.serviceClient.rpc(
      'check_event_module_access',
      {
        p_user_id: userId,
        p_event_id: eventId,
        p_module: requiredModule ?? null,
      },
    )

    if (error) {
      throw new ForbiddenException('Failed to verify event access')
    }

    // accessResult is expected to be: { access: 'none'|'view'|'edit'|'full', source: string }
    // Or just the access string if the RPC returns a scalar
    const effectiveAccess: string =
      typeof accessResult === 'string'
        ? accessResult
        : accessResult?.access ?? 'none'

    if (effectiveAccess === 'none') {
      throw new ForbiddenException(
        'You have been removed from this event or do not have access.',
      )
    }

    const effectiveRank = ACCESS_RANK[effectiveAccess] ?? 0
    const requiredRank = ACCESS_RANK[requiredLevel] ?? 1

    if (effectiveRank < requiredRank) {
      throw new ForbiddenException(
        `This action requires ${requiredLevel} access${requiredModule ? ` to the ${requiredModule} module` : ''} on this event.`,
      )
    }

    // Attach to request for downstream use
    req.eventAccess = effectiveAccess
    req.eventAccessSource = typeof accessResult === 'object' ? accessResult?.source : 'check'

    return true
  }
}
