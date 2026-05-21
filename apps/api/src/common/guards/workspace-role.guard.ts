/**
 * OccasionPro — Workspace Role Guard
 *
 * Enforces the corrected 4-tier tenant role hierarchy:
 *   owner > event_manager > team_lead > team_member
 *
 * Usage:
 *   @UseGuards(JwtAuthGuard, WorkspaceRoleGuard)
 *   @RequireTenantRole('owner')             // owner only (billing, workspace settings)
 *   @RequireTenantRole('event_manager')     // owner OR event_manager
 *   @RequireTenantRole('team_lead')         // owner, event_manager, OR team_lead
 *
 * The guard reads tenant_id from:
 *   1. request.user.tenant_id (JWT claim)
 *   2. request.params.tenantId
 *   3. request.body.tenant_id
 *
 * Super Admin (from super_admins table) bypasses all tenant role checks.
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { SupabaseService } from '../supabase/supabase.service'

export const TENANT_ROLE_KEY = 'tenant_required_role'

export type TenantRole = 'owner' | 'event_manager' | 'team_lead' | 'team_member'

// Role hierarchy — higher = more access
const ROLE_RANK: Record<TenantRole, number> = {
  owner:          4,
  event_manager:  3,
  team_lead:      2,
  team_member:    1,
}

@Injectable()
export class WorkspaceRoleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly supabase: SupabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRole = this.reflector.getAllAndOverride<TenantRole>(
      TENANT_ROLE_KEY,
      [context.getHandler(), context.getClass()],
    )

    // No role requirement → open to any authenticated tenant member
    if (!requiredRole) return true

    const req = context.switchToHttp().getRequest()
    const userId: string = req.user?.sub ?? req.user?.id
    if (!userId) throw new UnauthorizedException('Not authenticated')

    // Super Admin bypasses all tenant role checks
    const { data: superAdmin } = await this.supabase.serviceClient
      .from('super_admins')
      .select('id')
      .eq('user_id', userId)
      .single()
    if (superAdmin) return true

    // Resolve tenant_id
    const tenantId: string =
      req.user?.tenant_id ??
      req.params?.tenantId ??
      req.body?.tenant_id

    if (!tenantId) throw new ForbiddenException('Tenant context not found')

    // Fetch role from tenant_members
    const { data: member } = await this.supabase.serviceClient
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
      .single()

    if (!member) {
      throw new ForbiddenException('You are not a member of this workspace')
    }

    const userRank = ROLE_RANK[member.role as TenantRole] ?? 0
    const requiredRank = ROLE_RANK[requiredRole] ?? 0

    if (userRank < requiredRank) {
      throw new ForbiddenException(
        `This action requires the '${requiredRole}' role or higher. Your role: ${member.role}`
      )
    }

    // Attach resolved role to request for downstream use
    req.tenantRole = member.role
    req.tenantId = tenantId

    return true
  }
}
