import type { TypedSupabaseClient } from '../client'
import type { UserRole } from '../types'

/**
 * Get the current authenticated user's tenant ID from their profile
 */
export async function getCurrentUserTenant(
  client: TypedSupabaseClient,
): Promise<{ tenantId: string; userId: string } | null> {
  const { data: { user }, error } = await client.auth.getUser()
  if (error || !user) return null

  const { data: profile } = await client
    .from('profiles')
    .select('tenant_id')
    .eq('id', user.id)
    .single()

  if (!profile) return null

  return { tenantId: profile.tenant_id, userId: user.id }
}

/**
 * Get the current user's active role for their tenant
 */
export async function getCurrentUserRole(
  client: TypedSupabaseClient,
  tenantId: string,
): Promise<UserRole | null> {
  const { data: { user } } = await client.auth.getUser()
  if (!user) return null

  const { data } = await client
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .limit(1)
    .single()

  return data?.role ?? null
}

/**
 * Check if the current user has the required role(s)
 */
export function hasRole(
  userRole: UserRole | null,
  allowedRoles: UserRole[],
): boolean {
  if (!userRole) return false
  // Super admin has access everywhere
  if (userRole === 'super_admin') return true
  return allowedRoles.includes(userRole)
}

/**
 * Tenant-scoped query shortcut — always adds tenant_id filter
 */
export function tenantQuery(
  client: TypedSupabaseClient,
  table: Parameters<TypedSupabaseClient['from']>[0],
  tenantId: string,
) {
  return client.from(table).select('*').eq('tenant_id', tenantId)
}
