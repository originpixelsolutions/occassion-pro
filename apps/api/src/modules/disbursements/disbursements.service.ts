import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common'
import { createClient } from '@supabase/supabase-js'
import { ConfigService } from '@nestjs/config'

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface CreateScheduleDto {
  vendor_id: string
  total_amount: number
  currency?: string
  notes?: string
  milestones: CreateMilestoneDto[]
}

export interface CreateMilestoneDto {
  name: string
  milestone_type?: string
  amount: number
  percentage_of_total?: number
  due_date?: string
  trigger_event?: string
  sort_order?: number
  notes?: string
}

export interface ApproveDto {
  status: 'approved' | 'rejected'
  comments?: string
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class DisbursementsService {
  private supabase

  constructor(private readonly config: ConfigService) {
    this.supabase = createClient(
      config.get<string>('SUPABASE_URL')!,
      config.get<string>('SUPABASE_SERVICE_ROLE_KEY')!,
    )
  }

  private userClient(token: string) {
    return createClient(
      this.config.get<string>('SUPABASE_URL')!,
      this.config.get<string>('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: `Bearer ${token}` } } },
    )
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Payment Schedules
  // ─────────────────────────────────────────────────────────────────────────────

  async getSchedules(eventId: string, tenantId: string, token: string) {
    const db = this.userClient(token)
    const { data, error } = await db
      .from('vendor_payment_schedules')
      .select(`
        *,
        vendors ( id, name, category, contact_name, contact_email ),
        vendor_payment_milestones ( *, vendor_disbursements (*), disbursement_approvals (*) )
      `)
      .eq('event_id', eventId)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })

    if (error) throw new BadRequestException(error.message)
    return data ?? []
  }

  async getSchedule(scheduleId: string, tenantId: string, token: string) {
    const db = this.userClient(token)
    const { data, error } = await db
      .from('vendor_payment_schedules')
      .select(`
        *,
        vendors ( id, name, category, contact_name, contact_email ),
        vendor_payment_milestones (
          *,
          vendor_disbursements (*),
          disbursement_approvals (
            *,
            profiles ( id, full_name, email )
          )
        )
      `)
      .eq('id', scheduleId)
      .eq('tenant_id', tenantId)
      .single()

    if (error || !data) throw new NotFoundException('Schedule not found')
    return data
  }

  async createSchedule(
    eventId: string,
    dto: CreateScheduleDto,
    tenantId: string,
    userId: string,
    token: string,
  ) {
    const db = this.userClient(token)

    // Check for existing schedule
    const { data: existing } = await db
      .from('vendor_payment_schedules')
      .select('id')
      .eq('event_id', eventId)
      .eq('vendor_id', dto.vendor_id)
      .eq('tenant_id', tenantId)
      .single()

    if (existing) throw new BadRequestException('A payment schedule already exists for this vendor on this event')

    const { data: schedule, error } = await db
      .from('vendor_payment_schedules')
      .insert({
        tenant_id: tenantId,
        event_id: eventId,
        vendor_id: dto.vendor_id,
        created_by: userId,
        total_amount: dto.total_amount,
        currency: dto.currency ?? 'INR',
        notes: dto.notes,
        status: 'active',
      })
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)

    // Insert milestones
    if (dto.milestones?.length) {
      const milestoneRows = dto.milestones.map((m, i) => ({
        schedule_id: schedule.id,
        tenant_id: tenantId,
        vendor_id: dto.vendor_id,
        name: m.name,
        milestone_type: m.milestone_type ?? 'manual',
        amount: m.amount,
        percentage_of_total: m.percentage_of_total,
        due_date: m.due_date,
        trigger_event: m.trigger_event,
        sort_order: m.sort_order ?? i,
        notes: m.notes,
        status: 'pending',
      }))

      const { error: mErr } = await db
        .from('vendor_payment_milestones')
        .insert(milestoneRows)

      if (mErr) throw new BadRequestException(mErr.message)
    }

    return this.getSchedule(schedule.id, tenantId, token)
  }

  async updateSchedule(
    scheduleId: string,
    dto: Partial<CreateScheduleDto>,
    tenantId: string,
    token: string,
  ) {
    const db = this.userClient(token)
    const { data, error } = await db
      .from('vendor_payment_schedules')
      .update({ ...dto, updated_at: new Date().toISOString() })
      .eq('id', scheduleId)
      .eq('tenant_id', tenantId)
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)
    if (!data) throw new NotFoundException('Schedule not found')
    return data
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Milestones
  // ─────────────────────────────────────────────────────────────────────────────

  async addMilestone(
    scheduleId: string,
    dto: CreateMilestoneDto,
    tenantId: string,
    token: string,
  ) {
    const db = this.userClient(token)

    // Verify schedule belongs to tenant
    const { data: schedule } = await db
      .from('vendor_payment_schedules')
      .select('id, vendor_id')
      .eq('id', scheduleId)
      .eq('tenant_id', tenantId)
      .single()
    if (!schedule) throw new NotFoundException('Schedule not found')

    const { data, error } = await db
      .from('vendor_payment_milestones')
      .insert({
        schedule_id: scheduleId,
        tenant_id: tenantId,
        vendor_id: schedule.vendor_id,
        ...dto,
        status: 'pending',
      })
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)
    return data
  }

  async updateMilestone(
    milestoneId: string,
    dto: Partial<CreateMilestoneDto>,
    tenantId: string,
    token: string,
  ) {
    const db = this.userClient(token)
    const { data, error } = await db
      .from('vendor_payment_milestones')
      .update({ ...dto, updated_at: new Date().toISOString() })
      .eq('id', milestoneId)
      .eq('tenant_id', tenantId)
      .in('status', ['pending'])  // only pending milestones can be edited
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)
    if (!data) throw new NotFoundException('Milestone not found or not in editable state')
    return data
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Approval Workflow
  // ─────────────────────────────────────────────────────────────────────────────

  async requestApproval(
    milestoneId: string,
    approverIds: string[],
    tenantId: string,
    token: string,
  ) {
    const db = this.userClient(token)

    // Update milestone to approval_pending
    const { data: milestone, error } = await db
      .from('vendor_payment_milestones')
      .update({ status: 'approval_pending', updated_at: new Date().toISOString() })
      .eq('id', milestoneId)
      .eq('tenant_id', tenantId)
      .eq('status', 'pending')
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)
    if (!milestone) throw new BadRequestException('Milestone not in pending status')

    // Insert approval requests
    const approvalRows = approverIds.map(approverId => ({
      tenant_id: tenantId,
      milestone_id: milestoneId,
      approver_id: approverId,
      status: 'pending',
    }))

    await db.from('disbursement_approvals').upsert(approvalRows, {
      onConflict: 'milestone_id,approver_id',
      ignoreDuplicates: false,
    })

    return { milestoneId, approversRequested: approverIds.length }
  }

  async decideApproval(
    milestoneId: string,
    dto: ApproveDto,
    tenantId: string,
    userId: string,
    token: string,
  ) {
    const db = this.userClient(token)

    // Record this approver's decision
    const { data: approval, error } = await db
      .from('disbursement_approvals')
      .update({
        status: dto.status,
        comments: dto.comments,
        decided_at: new Date().toISOString(),
      })
      .eq('milestone_id', milestoneId)
      .eq('approver_id', userId)
      .eq('status', 'pending')
      .select()
      .single()

    if (error || !approval) throw new BadRequestException('No pending approval found for this user')

    // If rejected by any approver → reject milestone
    if (dto.status === 'rejected') {
      await db
        .from('vendor_payment_milestones')
        .update({ status: 'rejected', updated_at: new Date().toISOString() })
        .eq('id', milestoneId)
        .eq('tenant_id', tenantId)
      return { decision: 'rejected', milestoneId }
    }

    // Check if ALL approvers have approved
    const { data: allApprovals } = await db
      .from('disbursement_approvals')
      .select('status')
      .eq('milestone_id', milestoneId)

    const allApproved = (allApprovals ?? []).every((a: any) => a.status === 'approved')
    if (allApproved) {
      await db
        .from('vendor_payment_milestones')
        .update({ status: 'approved', updated_at: new Date().toISOString() })
        .eq('id', milestoneId)
        .eq('tenant_id', tenantId)
    }

    return { decision: allApproved ? 'fully_approved' : 'partial_approval', milestoneId }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Disbursement (Payout)
  // ─────────────────────────────────────────────────────────────────────────────

  async initiateDisbursement(
    milestoneId: string,
    bankAccountId: string,
    paymentMode: string,
    tenantId: string,
    userId: string,
    token: string,
  ) {
    const db = this.userClient(token)

    // Verify milestone is approved
    const { data: milestone } = await db
      .from('vendor_payment_milestones')
      .select('*, vendor_payment_schedules ( vendor_id, currency )')
      .eq('id', milestoneId)
      .eq('tenant_id', tenantId)
      .single()

    if (!milestone) throw new NotFoundException('Milestone not found')
    if (milestone.status !== 'approved') throw new BadRequestException('Milestone must be approved before disbursement')

    // Load bank account
    const { data: bankAccount } = await db
      .from('vendor_bank_accounts')
      .select('*')
      .eq('id', bankAccountId)
      .eq('tenant_id', tenantId)
      .single()

    if (!bankAccount) throw new NotFoundException('Bank account not found')

    // Create disbursement record
    const { data: disbursement, error } = await db
      .from('vendor_disbursements')
      .insert({
        tenant_id: tenantId,
        milestone_id: milestoneId,
        schedule_id: milestone.schedule_id,
        vendor_id: bankAccount.vendor_id,
        bank_account_id: bankAccountId,
        initiated_by: userId,
        amount: milestone.amount,
        currency: milestone.vendor_payment_schedules?.currency ?? 'INR',
        payment_mode: paymentMode,
        status: 'queued',
        narration: `Payment for: ${milestone.name}`,
      })
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)

    // Update milestone to processing
    await db
      .from('vendor_payment_milestones')
      .update({ status: 'processing', updated_at: new Date().toISOString() })
      .eq('id', milestoneId)

    // Attempt Razorpay payout
    const razorpayResult = await this.dispatchRazorpayPayout(disbursement, bankAccount)

    // Update disbursement with Razorpay result
    const { data: updated } = await db
      .from('vendor_disbursements')
      .update({
        razorpay_payout_id: razorpayResult.payout_id ?? null,
        status: razorpayResult.success ? 'processing' : 'failed',
        failure_reason: razorpayResult.error ?? null,
        failed_at: razorpayResult.success ? null : new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', disbursement.id)
      .select()
      .single()

    // Update milestone status
    if (!razorpayResult.success) {
      await db
        .from('vendor_payment_milestones')
        .update({ status: 'approved', updated_at: new Date().toISOString() }) // revert to approved so retry is possible
        .eq('id', milestoneId)
    }

    return { disbursement: updated, razorpay: razorpayResult }
  }

  private async dispatchRazorpayPayout(disbursement: any, bankAccount: any) {
    const apiKey = this.config.get<string>('RAZORPAY_KEY_ID')
    const apiSecret = this.config.get<string>('RAZORPAY_KEY_SECRET')
    const accountNumber = this.config.get<string>('RAZORPAY_PAYOUT_ACCOUNT_NUMBER')

    if (!apiKey || !apiSecret || !accountNumber) {
      // Razorpay not configured — stub response
      console.warn('[Disbursement] Razorpay payout credentials not configured — simulating success')
      return {
        success: true,
        payout_id: `rp_stub_${Date.now()}`,
        status: 'processing',
      }
    }

    try {
      const fundAccountId = bankAccount.razorpay_fund_account_id

      if (!fundAccountId) {
        // Need to create contact + fund account first
        const fundAccId = await this.createRazorpayFundAccount(bankAccount, apiKey, apiSecret)
        if (!fundAccId) {
          return { success: false, error: 'Could not create Razorpay fund account' }
        }
      }

      const payload = {
        account_number: accountNumber,
        fund_account_id: bankAccount.razorpay_fund_account_id,
        amount: Math.round(disbursement.amount * 100), // paise
        currency: disbursement.currency,
        mode: disbursement.payment_mode.toUpperCase().replace('_', ''),
        purpose: 'payout',
        queue_if_low_balance: true,
        reference_id: disbursement.id,
        narration: disbursement.narration,
      }

      const res = await fetch('https://api.razorpay.com/v1/payouts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')}`,
        },
        body: JSON.stringify(payload),
      })

      const data: any = await res.json()

      if (!res.ok) {
        return { success: false, error: data?.error?.description ?? 'Razorpay payout failed' }
      }

      return { success: true, payout_id: data.id, status: data.status }
    } catch (err: any) {
      return { success: false, error: err?.message ?? 'Network error' }
    }
  }

  private async createRazorpayFundAccount(bankAccount: any, key: string, secret: string): Promise<string | null> {
    try {
      // Create contact first
      const contactRes = await fetch('https://api.razorpay.com/v1/contacts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${Buffer.from(`${key}:${secret}`).toString('base64')}`,
        },
        body: JSON.stringify({
          name: bankAccount.account_holder_name,
          type: 'vendor',
          reference_id: bankAccount.vendor_id,
        }),
      })
      const contact: any = await contactRes.json()
      if (!contactRes.ok) return null

      // Create fund account
      const fundAccountPayload: any = { contact_id: contact.id }
      if (bankAccount.account_type === 'upi') {
        fundAccountPayload.account_type = 'vpa'
        fundAccountPayload.vpa = { address: bankAccount.upi_id }
      } else {
        fundAccountPayload.account_type = 'bank_account'
        fundAccountPayload.bank_account = {
          name: bankAccount.account_holder_name,
          ifsc: bankAccount.ifsc_code,
          account_number: bankAccount.account_number,
        }
      }

      const faRes = await fetch('https://api.razorpay.com/v1/fund_accounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${Buffer.from(`${key}:${secret}`).toString('base64')}`,
        },
        body: JSON.stringify(fundAccountPayload),
      })
      const fa: any = await faRes.json()
      if (!faRes.ok) return null

      // Save back to Supabase
      await this.supabase
        .from('vendor_bank_accounts')
        .update({
          razorpay_contact_id: contact.id,
          razorpay_fund_account_id: fa.id,
        })
        .eq('id', bankAccount.id)

      return fa.id
    } catch {
      return null
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Razorpay Webhook (payout state updates)
  // ─────────────────────────────────────────────────────────────────────────────

  async handleRazorpayWebhook(payload: any) {
    const event = payload.event
    const payout = payload.payload?.payout?.entity

    if (!payout?.id) return { received: true }

    const statusMap: Record<string, string> = {
      'payout.processed':  'processed',
      'payout.reversed':   'reversed',
      'payout.failed':     'failed',
      'payout.cancelled':  'cancelled',
    }

    const newStatus = statusMap[event]
    if (!newStatus) return { received: true, ignored: true }

    const updatePayload: any = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    }

    if (newStatus === 'processed') {
      updatePayload.processed_at = payout.processed_on
        ? new Date(payout.processed_on * 1000).toISOString()
        : new Date().toISOString()
      updatePayload.reference_number = payout.utr ?? null
    }
    if (newStatus === 'reversed')  updatePayload.reversed_at = new Date().toISOString()
    if (newStatus === 'failed')    updatePayload.failed_at = new Date().toISOString()
    if (payout.failure_reason)     updatePayload.failure_reason = payout.failure_reason

    const { data: disbursement } = await this.supabase
      .from('vendor_disbursements')
      .update(updatePayload)
      .eq('razorpay_payout_id', payout.id)
      .select('milestone_id')
      .single()

    // Update milestone status
    if (disbursement?.milestone_id) {
      const milestoneStatus = newStatus === 'processed' ? 'paid' : newStatus === 'reversed' ? 'pending' : 'approved'
      await this.supabase
        .from('vendor_payment_milestones')
        .update({ status: milestoneStatus, updated_at: new Date().toISOString() })
        .eq('id', disbursement.milestone_id)
    }

    return { received: true, event, status: newStatus }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Bank Accounts
  // ─────────────────────────────────────────────────────────────────────────────

  async getBankAccounts(vendorId: string, tenantId: string, token: string) {
    const db = this.userClient(token)
    const { data, error } = await db
      .from('vendor_bank_accounts')
      .select('id, account_type, account_holder_name, bank_name, ifsc_code, upi_id, is_verified, is_primary, account_type')
      .eq('vendor_id', vendorId)
      .eq('tenant_id', tenantId)
      .order('is_primary', { ascending: false })

    if (error) throw new BadRequestException(error.message)
    return data ?? []
  }

  async addBankAccount(dto: any, vendorId: string, tenantId: string, token: string) {
    const db = this.userClient(token)
    const { data, error } = await db
      .from('vendor_bank_accounts')
      .insert({ ...dto, vendor_id: vendorId, tenant_id: tenantId })
      .select('id, account_type, account_holder_name, bank_name, ifsc_code, upi_id, is_verified, is_primary')
      .single()

    if (error) throw new BadRequestException(error.message)
    return data
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Reconciliation
  // ─────────────────────────────────────────────────────────────────────────────

  async getReconciliation(eventId: string, tenantId: string, token: string) {
    const db = this.userClient(token)
    const { data, error } = await db
      .from('vendor_disbursement_summary')
      .select('*')
      .eq('event_id', eventId)
      .eq('tenant_id', tenantId)

    if (error) throw new BadRequestException(error.message)

    const totals = (data ?? []).reduce(
      (acc: any, row: any) => ({
        totalScheduled:  acc.totalScheduled  + (Number(row.total_amount)     || 0),
        totalDisbursed:  acc.totalDisbursed  + (Number(row.total_disbursed)  || 0),
        totalOutstanding: acc.totalOutstanding + (Number(row.total_outstanding) || 0),
        balanceDue:      acc.balanceDue      + (Number(row.balance_due)      || 0),
      }),
      { totalScheduled: 0, totalDisbursed: 0, totalOutstanding: 0, balanceDue: 0 },
    )

    return { schedules: data ?? [], totals }
  }
}
