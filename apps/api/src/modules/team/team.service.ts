import { Injectable } from '@nestjs/common'
import { SupabaseService } from '../../common/supabase/supabase.service'

@Injectable()
export class TeamService {
  constructor(private readonly supabase: SupabaseService) {}

  async getTeamMembers(tenantId: string, token: string) {
    const client = this.supabase.forRequest(token)
    const { data, error } = await client
      .from('profiles')
      .select(`*, user_roles!inner(role)`)
      .eq('tenant_id', tenantId)
      .order('full_name')
    if (error) throw new Error(error.message)
    return data ?? []
  }

  async inviteMember(dto: {
    email: string
    role: string
    tenantId: string
    invitedBy: string
  }) {
    // Use Supabase admin to invite — creates auth user + sends magic link
    const client = this.supabase.serviceClient
    const { data, error } = await client.auth.admin.inviteUserByEmail(dto.email, {
      data: {
        tenant_id: dto.tenantId,
        role: dto.role,
        invited_by: dto.invitedBy,
      },
    })
    if (error) throw new Error(error.message)
    return { invited: true, user_id: data.user?.id }
  }

  async updateMemberRole(userId: string, role: string, tenantId: string, token: string) {
    // Prevent assigning 'owner' via this endpoint — ownership must transfer via transferOwnership()
    if (role === 'owner') {
      throw new Error('Cannot assign owner role directly. Use the ownership transfer flow.')
    }
    const VALID_ROLES = ['event_manager', 'team_lead', 'team_member']
    if (!VALID_ROLES.includes(role)) {
      throw new Error(`Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`)
    }

    const client = this.supabase.forRequest(token)
    const { data, error } = await client
      .from('user_roles')
      .update({ role, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
      .neq('role', 'owner')       // never demote the owner via this path
      .select('id, user_id, role, is_active')
      .single()
    if (error) throw new Error(error.message)
    return data
  }

  // Shifts
  async getEventShifts(eventId: string, tenantId: string, token: string) {
    const client = this.supabase.forRequest(token)
    const { data, error } = await client
      .from('team_shifts')
      .select(`*, profiles(id, full_name, avatar_url)`)
      .eq('event_id', eventId)
      .eq('tenant_id', tenantId)
      .order('start_time')
    if (error) throw new Error(error.message)
    return data ?? []
  }

  async createShift(dto: any, token: string) {
    const client = this.supabase.forRequest(token)
    const { data, error } = await client
      .from('team_shifts')
      .insert(dto)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data
  }

  async updateShift(id: string, dto: any, tenantId: string, token: string) {
    const client = this.supabase.forRequest(token)
    const { data, error } = await client
      .from('team_shifts')
      .update({ ...dto, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data
  }

  async checkInShift(id: string, userId: string, tenantId: string, token: string) {
    return this.updateShift(id, { checked_in_at: new Date().toISOString(), checked_in_by: userId }, tenantId, token)
  }

  async getMyShifts(userId: string, tenantId: string, token: string) {
    const client = this.supabase.forRequest(token)
    const { data, error } = await client
      .from('team_shifts')
      .select(`*, events(id, name, start_date)`)
      .eq('assigned_to', userId)
      .eq('tenant_id', tenantId)
      .gte('start_time', new Date().toISOString())
      .order('start_time')
    if (error) throw new Error(error.message)
    return data ?? []
  }

  async removeMember(id: string, tenantId: string, token: string) {
    const client = this.supabase.forRequest(token)
    const { error } = await client.from('profiles').delete().eq('id', id).eq('tenant_id', tenantId)
    if (error) throw new Error(error.message)
  }

  async createMember(dto: any, token: string) {
    const client = this.supabase.forRequest(token)
    const { data, error } = await client.from('profiles').insert(dto).select().single()
    if (error) throw new Error(error.message)
    return data
  }

  // ─── Ownership Transfer ──────────────────────────────────────────────────

  async transferOwnership(
    tenantId: string,
    currentOwnerId: string,
    newOwnerUserId: string,
    token: string,
  ) {
    // Validate the new owner is a current member (not already the owner)
    const client = this.supabase.forRequest(token)
    const { data: newOwner } = await client
      .from('user_roles')
      .select('id, role')
      .eq('tenant_id', tenantId)
      .eq('user_id', newOwnerUserId)
      .single()

    if (!newOwner) {
      throw new Error('The selected user is not a member of this workspace')
    }
    if (newOwner.role === 'owner') {
      throw new Error('This user is already the workspace owner')
    }

    // Call the PostgreSQL function which atomically:
    //  1. Sets current owner → event_manager
    //  2. Sets new owner → owner
    //  3. Updates tenants.workspace_owner_id
    const { error } = await this.supabase.serviceClient.rpc('transfer_workspace_ownership', {
      p_tenant_id:          tenantId,
      p_current_owner_id:   currentOwnerId,
      p_new_owner_user_id:  newOwnerUserId,
    })

    if (error) throw new Error(error.message ?? 'Ownership transfer failed')

    return { success: true, new_owner_user_id: newOwnerUserId }
  }
}
