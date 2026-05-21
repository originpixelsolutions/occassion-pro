/**
 * OccasionPro — RequireTenantRole Decorator
 *
 * Pairs with WorkspaceRoleGuard to enforce minimum role level on routes.
 *
 * Usage:
 *   @RequireTenantRole('owner')           // owner only (billing, workspace settings)
 *   @RequireTenantRole('event_manager')   // event_manager or owner
 *   @RequireTenantRole('team_lead')       // team_lead, event_manager, or owner
 *
 * Role rank: owner=4, event_manager=3, team_lead=2, team_member=1
 * Any role with rank >= required rank is allowed. Super Admins always bypass.
 */

import { SetMetadata } from '@nestjs/common'

export type TenantRole = 'owner' | 'event_manager' | 'team_lead' | 'team_member'

/**
 * Metadata key — must match TENANT_ROLE_KEY in workspace-role.guard.ts
 */
export const TENANT_ROLE_KEY = 'tenant_required_role'

/**
 * Enforce a minimum tenant role level. WorkspaceRoleGuard reads this metadata.
 * Super Admins always bypass this check.
 */
export const RequireTenantRole = (minRole: TenantRole) =>
  SetMetadata(TENANT_ROLE_KEY, minRole)
