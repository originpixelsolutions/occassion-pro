import {
  Injectable, NotFoundException,
  ConflictException, BadRequestException,
} from '@nestjs/common'
import { SupabaseService } from '../../common/supabase/supabase.service'

export interface CreateAccessRequestDto {
  plan_requested?: 'agency' | 'enterprise' | 'custom'
  use_case: string
  expected_rps?: number
  requested_scopes?: string[]
}

export interface ReviewAccessRequestDto {
  approved: boolean
  review_notes?: string
}

@Injectable()
export class AccessRequestsService {
  constructor(private readonly supabase: SupabaseService) {}

  // ─── Tenant: submit access request ─────────────────────────────────────────
  async create(tenantId: string, userId: string, dto: CreateAccessRequestDto) {
    // Check for existing pending request
    const { data: existing } = await this.supabase.serviceClient
      .from('api_access_requests')
      .select('id,status')
      .eq('tenant_id', tenantId)
      .eq('status', 'pending')
      .maybeSingle()

    if (existing) {
      throw new ConflictException('A pending API access request already exists for this tenant')
    }

    const { data, error } = await this.supabase.serviceClient
      .from('api_access_requests')
      .insert({
        tenant_id: tenantId,
        requested_by: userId,
        plan_requested: dto.plan_requested ?? 'agency',
        use_case: dto.use_case,
        expected_rps: dto.expected_rps,
        requested_scopes: dto.requested_scopes ?? [],
      })
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)
    return data
  }

  // ─── Tenant: get own request ────────────────────────────────────────────────
  async getForTenant(tenantId: string) {
    const { data, error } = await this.supabase.serviceClient
      .from('api_access_requests')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) throw new BadRequestException(error.message)
    return data
  }

  // ─── Tenant: cancel pending request ────────────────────────────────────────
  async cancel(tenantId: string) {
    const { data: existing } = await this.supabase.serviceClient
      .from('api_access_requests')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('status', 'pending')
      .maybeSingle()

    if (!existing) throw new NotFoundException('No pending request found')

    await this.supabase.serviceClient
      .from('api_access_requests')
      .update({ status: 'cancelled' })
      .eq('id', existing.id)

    return { cancelled: true }
  }

  // ─── Super Admin: list all pending ─────────────────────────────────────────
  async listPending() {
    const { data, error } = await this.supabase.getServiceClient()
      .from('api_access_requests')
      .select(`
        id, plan_requested, use_case, expected_rps, requested_scopes,
        status, created_at,
        tenant:tenants(id, name, slug, plan),
        requester:users!requested_by(id, full_name, email)
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })

    if (error) throw new BadRequestException(error.message)
    return data
  }

  // ─── Super Admin: list all (with filter) ───────────────────────────────────
  async listAll(status?: string) {
    let q = this.supabase.getServiceClient()
      .from('api_access_requests')
      .select(`
        id, plan_requested, use_case, expected_rps, requested_scopes,
        status, review_notes, reviewed_at, created_at,
        tenant:tenants(id, name, slug, plan),
        requester:users!requested_by(id, full_name, email),
        reviewer:users!reviewed_by(id, full_name, email)
      `)
      .order('created_at', { ascending: false })

    if (status) q = q.eq('status', status)

    const { data, error } = await q
    if (error) throw new BadRequestException(error.message)
    return data
  }

  // ─── Super Admin: review ────────────────────────────────────────────────────
  async review(requestId: string, actorId: string, dto: ReviewAccessRequestDto) {
    const { data: req, error: fetchErr } = await this.supabase.getServiceClient()
      .from('api_access_requests')
      .select('*')
      .eq('id', requestId)
      .single()

    if (fetchErr || !req) throw new NotFoundException('Access request not found')
    if (req.status !== 'pending') {
      throw new ConflictException(`Request is already ${req.status}`)
    }

    const { data, error } = await this.supabase.getServiceClient()
      .from('api_access_requests')
      .update({
        status: dto.approved ? 'approved' : 'rejected',
        reviewed_by: actorId,
        reviewed_at: new Date().toISOString(),
        review_notes: dto.review_notes,
      })
      .eq('id', requestId)
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)
    return data
  }
}
