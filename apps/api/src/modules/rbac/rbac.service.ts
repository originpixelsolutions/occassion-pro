import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common'
import { SupabaseService } from '../../common/supabase/supabase.service'

@Injectable()
export class RbacService {
  constructor(private readonly supabase: SupabaseService) {}

  private client(token: string) {
    return this.supabase.getAuthenticatedClient(token)
  }

  // ── Permissions catalogue ────────────────────────────────────────────────────

  async listPermissions(token: string) {
    const { data, error } = await this.client(token)
      .from('permissions')
      .select('*')
      .order('category')
      .order('resource')
      .order('action')

    if (error) throw new BadRequestException(error.message)

    // Group by category
    const grouped: Record<string, any[]> = {}
    for (const p of data ?? []) {
      const cat = p.category ?? 'Other'
      if (!grouped[cat]) grouped[cat] = []
      grouped[cat].push(p)
    }

    return { permissions: data ?? [], grouped }
  }

  // ── Roles ────────────────────────────────────────────────────────────────────

  async listRoles(token: string) {
    const { data, error } = await this.client(token)
      .from('roles')
      .select(`
        id, name, description, is_system, color, priority,
        created_at, updated_at,
        role_permissions(
          permission_id,
          permissions(id, code, resource, action, category)
        )
      `)
      .order('priority', { ascending: false })
      .order('name')

    if (error) throw new BadRequestException(error.message)

    // Attach member count
    const roles = (data ?? []).map(r => ({
      ...r,
      permissions: (r.role_permissions ?? []).map((rp: any) => rp.permissions).filter(Boolean),
      permission_count: (r.role_permissions ?? []).length,
    }))

    // Get member counts in parallel
    const ids = roles.map(r => r.id)
    const { data: counts } = await this.client(token)
      .from('profile_roles')
      .select('role_id')
      .in('role_id', ids)

    const memberCounts: Record<string, number> = {}
    for (const c of counts ?? []) {
      memberCounts[c.role_id] = (memberCounts[c.role_id] ?? 0) + 1
    }

    return {
      roles: roles.map(r => ({ ...r, member_count: memberCounts[r.id] ?? 0 })),
    }
  }

  async getRole(id: string, token: string) {
    const { data, error } = await this.client(token)
      .from('roles')
      .select(`
        *,
        role_permissions(
          granted_at,
          permissions(*)
        )
      `)
      .eq('id', id)
      .single()

    if (error || !data) throw new NotFoundException('Role not found')

    // Get members of this role
    const { data: members } = await this.client(token)
      .from('profile_roles')
      .select('profile_id, assigned_at, expires_at, profiles(id, full_name, email, avatar_url, role)')
      .eq('role_id', id)
      .order('assigned_at', { ascending: false })

    return {
      ...data,
      permissions: (data.role_permissions ?? []).map((rp: any) => rp.permissions),
      members: (members ?? []).map((m: any) => ({ ...m.profiles, assigned_at: m.assigned_at, expires_at: m.expires_at })),
    }
  }

  async createRole(token: string, dto: {
    name: string
    description?: string
    color?: string
    priority?: number
    permission_ids?: string[]
  }) {
    const client = this.client(token)

    const { data: role, error } = await client
      .from('roles')
      .insert({
        name: dto.name,
        description: dto.description ?? null,
        color: dto.color ?? '#6366f1',
        priority: dto.priority ?? 0,
        is_system: false,
      })
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)

    // Grant initial permissions
    if (dto.permission_ids?.length) {
      const perms = dto.permission_ids.map(pid => ({
        role_id: role.id,
        permission_id: pid,
      }))
      await client.from('role_permissions').insert(perms)
    }

    await this.logAudit(client, 'role_created', 'role', role.id, { name: dto.name })
    return role
  }

  async updateRole(id: string, token: string, dto: {
    name?: string
    description?: string
    color?: string
    priority?: number
  }) {
    const { data: existing } = await this.client(token)
      .from('roles')
      .select('is_system')
      .eq('id', id)
      .single()

    if (existing?.is_system) {
      throw new ForbiddenException('Cannot modify system roles')
    }

    const { data, error } = await this.client(token)
      .from('roles')
      .update({ ...dto, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)
    await this.logAudit(this.client(token), 'role_updated', 'role', id, dto)
    return data
  }

  async deleteRole(id: string, token: string) {
    const { data: existing } = await this.client(token)
      .from('roles')
      .select('is_system, name')
      .eq('id', id)
      .single()

    if (existing?.is_system) {
      throw new ForbiddenException('Cannot delete system roles')
    }

    const { error } = await this.client(token).from('roles').delete().eq('id', id)
    if (error) throw new BadRequestException(error.message)
    await this.logAudit(this.client(token), 'role_deleted', 'role', id, { name: existing?.name })
    return { success: true }
  }

  // ── Role permissions management ───────────────────────────────────────────────

  async setRolePermissions(roleId: string, token: string, permissionIds: string[]) {
    const client = this.client(token)

    const { data: role } = await client.from('roles').select('is_system').eq('id', roleId).single()
    if (role?.is_system) throw new ForbiddenException('Cannot modify system role permissions')

    // Replace all permissions
    await client.from('role_permissions').delete().eq('role_id', roleId)

    if (permissionIds.length > 0) {
      const rows = permissionIds.map(pid => ({ role_id: roleId, permission_id: pid }))
      const { error } = await client.from('role_permissions').insert(rows)
      if (error) throw new BadRequestException(error.message)
    }

    await this.logAudit(client, 'permission_granted', 'role', roleId, { count: permissionIds.length })
    return { success: true, granted: permissionIds.length }
  }

  async grantPermission(roleId: string, permissionId: string, token: string) {
    const client = this.client(token)
    const { error } = await client
      .from('role_permissions')
      .insert({ role_id: roleId, permission_id: permissionId })

    if (error) throw new BadRequestException(error.message)
    await this.logAudit(client, 'permission_granted', 'role', roleId, { permission_id: permissionId })
    return { success: true }
  }

  async revokePermission(roleId: string, permissionId: string, token: string) {
    const client = this.client(token)
    const { error } = await client
      .from('role_permissions')
      .delete()
      .eq('role_id', roleId)
      .eq('permission_id', permissionId)

    if (error) throw new BadRequestException(error.message)
    await this.logAudit(client, 'permission_revoked', 'role', roleId, { permission_id: permissionId })
    return { success: true }
  }

  // ── Profile role assignments ───────────────────────────────────────────────────

  async assignRole(profileId: string, roleId: string, token: string, expiresAt?: string) {
    const client = this.client(token)

    const { data, error } = await client
      .from('profile_roles')
      .upsert({
        profile_id: profileId,
        role_id: roleId,
        expires_at: expiresAt ?? null,
      }, { onConflict: 'profile_id,role_id,tenant_id' })
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)
    await this.logAudit(client, 'role_assigned', 'profile', profileId, { role_id: roleId })
    return data
  }

  async revokeRole(profileId: string, roleId: string, token: string) {
    const client = this.client(token)

    const { error } = await client
      .from('profile_roles')
      .delete()
      .eq('profile_id', profileId)
      .eq('role_id', roleId)

    if (error) throw new BadRequestException(error.message)
    await this.logAudit(client, 'role_revoked', 'profile', profileId, { role_id: roleId })
    return { success: true }
  }

  async getProfileRoles(profileId: string, token: string) {
    const { data, error } = await this.client(token)
      .from('profile_roles')
      .select(`
        role_id, assigned_at, expires_at,
        roles(id, name, color, priority, is_system,
          role_permissions(
            permissions(code, resource, action)
          )
        )
      `)
      .eq('profile_id', profileId)
      .order('assigned_at', { ascending: false })

    if (error) throw new BadRequestException(error.message)

    const roles = (data ?? []).map((pr: any) => ({
      ...pr.roles,
      assigned_at: pr.assigned_at,
      expires_at: pr.expires_at,
      permissions: (pr.roles?.role_permissions ?? [])
        .map((rp: any) => rp.permissions?.code)
        .filter(Boolean),
    }))

    // Flatten all permissions
    const allPermissions = [...new Set(roles.flatMap((r: any) => r.permissions))]

    return { roles, permissions: allPermissions }
  }

  // ── Current user permissions ──────────────────────────────────────────────────

  async getMyPermissions(token: string) {
    const client = this.client(token)

    const { data: { user } } = await client.auth.getUser()
    if (!user) throw new ForbiddenException('Not authenticated')

    const { data, error } = await client.rpc('get_profile_permissions', {
      p_profile_id: user.id,
    })

    if (error) throw new BadRequestException(error.message)
    return {
      permissions: data ?? [],
      codes: (data ?? []).map((p: any) => p.code),
    }
  }

  // ── Resource ACLs ─────────────────────────────────────────────────────────────

  async listAcls(token: string, resourceType?: string, resourceId?: string) {
    let q = this.client(token)
      .from('resource_acls')
      .select('*, profiles(id, full_name, email), permissions(code, description)')
      .order('created_at', { ascending: false })

    if (resourceType) q = q.eq('resource_type', resourceType)
    if (resourceId)   q = q.eq('resource_id', resourceId)

    const { data, error } = await q
    if (error) throw new BadRequestException(error.message)
    return { acls: data ?? [] }
  }

  async grantAcl(token: string, dto: {
    profile_id: string
    resource_type: string
    resource_id: string
    permission_id: string
    is_grant?: boolean
  }) {
    const { data, error } = await this.client(token)
      .from('resource_acls')
      .upsert({
        profile_id: dto.profile_id,
        resource_type: dto.resource_type,
        resource_id: dto.resource_id,
        permission_id: dto.permission_id,
        is_grant: dto.is_grant ?? true,
      }, { onConflict: 'profile_id,resource_type,resource_id,permission_id' })
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)
    await this.logAudit(
      this.client(token),
      dto.is_grant !== false ? 'acl_granted' : 'acl_revoked',
      'profile',
      dto.profile_id,
      { resource_type: dto.resource_type, resource_id: dto.resource_id },
    )
    return data
  }

  async removeAcl(aclId: string, token: string) {
    const { error } = await this.client(token)
      .from('resource_acls')
      .delete()
      .eq('id', aclId)

    if (error) throw new BadRequestException(error.message)
    return { success: true }
  }

  // ── Audit log ────────────────────────────────────────────────────────────────

  async getAuditLog(token: string, limit = 100) {
    const { data, error } = await this.client(token)
      .from('rbac_audit_log')
      .select('*, profiles(id, full_name, email)')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw new BadRequestException(error.message)
    return { entries: data ?? [] }
  }

  // ── Member directory (all users with roles) ───────────────────────────────────

  async getMembers(token: string) {
    const client = this.client(token)

    const { data: profileRoles, error } = await client
      .from('profile_roles')
      .select(`
        profile_id, assigned_at, expires_at,
        profiles(id, full_name, email, avatar_url, role, created_at),
        roles(id, name, color, is_system)
      `)
      .order('assigned_at', { ascending: false })

    if (error) throw new BadRequestException(error.message)

    // Group by profile
    const memberMap: Record<string, any> = {}
    for (const pr of profileRoles ?? []) {
      const pid = pr.profile_id
      if (!memberMap[pid]) {
        memberMap[pid] = {
          ...(pr as any).profiles,
          roles: [],
        }
      }
      memberMap[pid].roles.push({
        ...(pr as any).roles,
        assigned_at: pr.assigned_at,
        expires_at: pr.expires_at,
      })
    }

    return { members: Object.values(memberMap) }
  }

  // ── Platform modules ─────────────────────────────────────────────────────────

  async listModules(token: string) {
    const { data, error } = await this.client(token)
      .from('platform_modules')
      .select('*')
      .order('sort_order')

    if (error) throw new BadRequestException(error.message)

    // Group by category
    const grouped: Record<string, any[]> = {}
    for (const m of data ?? []) {
      const cat = m.category ?? 'operations'
      if (!grouped[cat]) grouped[cat] = []
      grouped[cat].push(m)
    }

    return { modules: data ?? [], grouped }
  }

  async listPresets(token: string) {
    const { data, error } = await this.client(token)
      .from('permission_presets')
      .select(`
        id, name, label, description, color, is_system,
        permission_preset_modules(module_id, access_level)
      `)
      .order('name')

    if (error) throw new BadRequestException(error.message)

    const presets = (data ?? []).map((p: any) => ({
      ...p,
      module_permissions: Object.fromEntries(
        (p.permission_preset_modules ?? []).map((m: any) => [m.module_id, m.access_level])
      ),
      permission_preset_modules: undefined,
    }))

    return { presets }
  }

  // ── Module-level permissions per profile ─────────────────────────────────────

  async getProfileModulePermissions(
    profileId: string,
    token: string,
    eventId?: string,
  ) {
    const client = this.client(token)

    // Get all modules
    const { data: modules } = await client
      .from('platform_modules')
      .select('id, label, category, sort_order, is_always_on, admin_only')
      .order('sort_order')

    // Get platform-wide permissions
    let q = client
      .from('team_member_permissions')
      .select('module_id, access_level, event_id, granted_at')
      .eq('profile_id', profileId)

    const { data: perms } = await q

    // Build maps: platform-wide + event-specific
    const platformMap: Record<string, string> = {}
    const eventMap: Record<string, string> = {}

    for (const p of perms ?? []) {
      if (p.event_id === null || p.event_id === undefined) {
        platformMap[p.module_id] = p.access_level
      } else if (eventId && p.event_id === eventId) {
        eventMap[p.module_id] = p.access_level
      }
    }

    // Build effective per-module result
    const result = (modules ?? []).map((m: any) => {
      const platformLevel = platformMap[m.id] ?? (m.is_always_on ? 'full' : 'none')
      const eventLevel = eventId ? (eventMap[m.id] ?? null) : null
      const effectiveLevel = eventLevel ?? platformLevel

      return {
        module_id: m.id,
        label: m.label,
        category: m.category,
        sort_order: m.sort_order,
        is_always_on: m.is_always_on,
        admin_only: m.admin_only,
        platform_level: platformLevel,
        event_level: eventLevel,
        effective_level: effectiveLevel,
      }
    })

    return {
      profile_id: profileId,
      event_id: eventId ?? null,
      permissions: result,
    }
  }

  async setModulePermission(
    profileId: string,
    moduleId: string,
    accessLevel: 'none' | 'view' | 'edit' | 'full',
    token: string,
    tenantId: string,
    eventId?: string,
  ) {
    const client = this.client(token)

    const { data, error } = await client
      .from('team_member_permissions')
      .upsert({
        profile_id: profileId,
        module_id: moduleId,
        access_level: accessLevel,
        tenant_id: tenantId,
        event_id: eventId ?? null,
      }, { onConflict: 'profile_id,event_id,module_id' })
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)

    await this.logAudit(client, 'module_permission_set', 'profile', profileId, {
      module_id: moduleId,
      access_level: accessLevel,
      event_id: eventId,
    })

    return data
  }

  async bulkSetModulePermissions(
    profileId: string,
    permissions: Array<{ module_id: string; access_level: 'none' | 'view' | 'edit' | 'full' }>,
    token: string,
    tenantId: string,
    eventId?: string,
  ) {
    const client = this.client(token)

    const rows = permissions.map(p => ({
      profile_id: profileId,
      module_id: p.module_id,
      access_level: p.access_level,
      tenant_id: tenantId,
      event_id: eventId ?? null,
      updated_at: new Date().toISOString(),
    }))

    const { error } = await client
      .from('team_member_permissions')
      .upsert(rows, { onConflict: 'profile_id,event_id,module_id' })

    if (error) throw new BadRequestException(error.message)

    await this.logAudit(client, 'module_permissions_bulk_set', 'profile', profileId, {
      count: permissions.length,
      event_id: eventId,
    })

    return { success: true, updated: permissions.length }
  }

  async applyPreset(
    profileId: string,
    presetName: string,
    token: string,
    tenantId: string,
    eventId?: string,
  ) {
    const client = this.client(token)

    // Load preset modules
    const { data: presetModules, error } = await client
      .from('permission_preset_modules')
      .select('module_id, access_level')
      .eq('preset_name', presetName)

    if (error) throw new BadRequestException(error.message)
    if (!presetModules?.length) throw new BadRequestException(`Preset "${presetName}" not found`)

    const permissions = presetModules.map((pm: any) => ({
      module_id: pm.module_id,
      access_level: pm.access_level as 'none' | 'view' | 'edit' | 'full',
    }))

    const result = await this.bulkSetModulePermissions(profileId, permissions, token, tenantId, eventId)

    await this.logAudit(client, 'preset_applied', 'profile', profileId, {
      preset_name: presetName,
      event_id: eventId,
    })

    return { ...result, preset: presetName }
  }

  async getEffectivePermissions(
    profileId: string,
    token: string,
    eventId?: string,
  ) {
    const client = this.client(token)

    // Use the DB function for each module OR fetch all at once by reusing getProfileModulePermissions
    const result = await this.getProfileModulePermissions(profileId, token, eventId)

    // Build a quick-access map
    const accessMap: Record<string, string> = {}
    for (const p of result.permissions) {
      accessMap[p.module_id] = p.effective_level
    }

    // Modules the user can access (non-none)
    const accessible = result.permissions
      .filter(p => p.effective_level !== 'none')
      .map(p => p.module_id)

    return {
      profile_id: profileId,
      event_id: eventId ?? null,
      access_map: accessMap,
      accessible_modules: accessible,
      permissions: result.permissions,
    }
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private async logAudit(
    client: any,
    action: string,
    targetType: string,
    targetId: string,
    metadata: Record<string, any> = {},
  ) {
    try {
      await client.from('rbac_audit_log').insert({
        action,
        target_type: targetType,
        target_id: targetId,
        metadata,
      })
    } catch {}
  }
}
