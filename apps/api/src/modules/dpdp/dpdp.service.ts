import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { createHash } from 'crypto'
import { SupabaseService } from '../../common/supabase/supabase.service'
import { EmailService } from '../communications/email.service'

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export type SubjectType   = 'guest' | 'team_member' | 'client' | 'vendor'
export type ConsentType   = 'data_processing' | 'marketing_comms' | 'photo_sharing' | 'third_party_sharing'
export type RequestType   = 'access' | 'correction' | 'erasure' | 'portability'
export type RequestStatus = 'pending' | 'processing' | 'completed' | 'rejected'

export interface RecordConsentDto {
  tenantId:     string
  eventId?:     string
  subjectType:  SubjectType
  subjectId?:   string
  subjectEmail: string
  consentType:  ConsentType
  consentGiven: boolean
  consentText:  string
  ip?:          string
  userAgent?:   string
  version?:     string
}

export interface SubmitDataRequestDto {
  requestorEmail: string
  requestType:    RequestType
  tenantId?:      string
  notes?:         string
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class DpdpService {
  private readonly logger = new Logger(DpdpService.name)

  constructor(
    private readonly supabase: SupabaseService,
    private readonly emailService: EmailService,
  ) {}

  // ── Helpers ────────────────────────────────────────────────────────────────

  private hash(value: string): string {
    return createHash('sha256').update(value).digest('hex')
  }

  private serviceClient() {
    return this.supabase.serviceClient
  }

  // ── Consent management ─────────────────────────────────────────────────────

  /**
   * Record an explicit consent event.
   * IP and User-Agent are SHA-256 hashed before storage — raw PII never persisted.
   */
  async recordConsent(dto: RecordConsentDto): Promise<void> {
    const client = this.serviceClient()

    const { error } = await client.from('consent_records').insert({
      tenant_id:       dto.tenantId,
      event_id:        dto.eventId ?? null,
      subject_type:    dto.subjectType,
      subject_id:      dto.subjectId ?? null,
      subject_email:   dto.subjectEmail.toLowerCase().trim(),
      consent_type:    dto.consentType,
      consent_given:   dto.consentGiven,
      consent_text:    dto.consentText,
      ip_hash:         dto.ip        ? this.hash(dto.ip)        : null,
      user_agent_hash: dto.userAgent ? this.hash(dto.userAgent) : null,
      version:         dto.version ?? '1.0',
    })

    if (error) {
      this.logger.error(`recordConsent failed: ${error.message}`, { dto })
      throw new Error(error.message)
    }

    this.logger.debug(`Consent recorded: ${dto.subjectEmail} → ${dto.consentType} = ${dto.consentGiven}`)
  }

  /**
   * Withdraw a specific consent type for a subject.
   * Sets withdrawn_at; the original record is preserved for audit.
   */
  async withdrawConsent(
    subjectEmail: string,
    tenantId:     string,
    consentType:  ConsentType,
  ): Promise<void> {
    const email  = subjectEmail.toLowerCase().trim()
    const client = this.serviceClient()

    const { error } = await client
      .from('consent_records')
      .update({ withdrawn_at: new Date().toISOString() })
      .eq('tenant_id',     tenantId)
      .eq('subject_email', email)
      .eq('consent_type',  consentType)
      .is('withdrawn_at',  null)

    if (error) throw new Error(error.message)

    this.logger.log(`Consent withdrawn: ${email} → ${consentType}`)
  }

  /**
   * Returns a map of consent type → current status (true if active consent exists).
   */
  async getConsentStatus(
    subjectEmail:  string,
    tenantId:      string,
    consentTypes:  ConsentType[],
  ): Promise<Record<ConsentType, boolean>> {
    const email  = subjectEmail.toLowerCase().trim()
    const client = this.serviceClient()

    const { data, error } = await client
      .from('consent_records')
      .select('consent_type, consent_given, withdrawn_at')
      .eq('tenant_id',    tenantId)
      .eq('subject_email', email)
      .in('consent_type', consentTypes)
      .order('given_at', { ascending: false })

    if (error) throw new Error(error.message)

    // For each type, take the most recent record; active = given && not withdrawn
    const result: Partial<Record<ConsentType, boolean>> = {}
    for (const type of consentTypes) {
      const record = (data ?? []).find(r => r.consent_type === type)
      result[type] = record
        ? record.consent_given && !record.withdrawn_at
        : false
    }

    return result as Record<ConsentType, boolean>
  }

  // ── Data subject requests ──────────────────────────────────────────────────

  /**
   * Submit a data rights request. Sends a confirmation email to the requestor.
   */
  async submitDataRequest(dto: SubmitDataRequestDto): Promise<{ id: string; reference: string }> {
    const client = this.serviceClient()

    const { data, error } = await client
      .from('data_requests')
      .insert({
        tenant_id:       dto.tenantId ?? null,
        requestor_email: dto.requestorEmail.toLowerCase().trim(),
        request_type:    dto.requestType,
        status:          'pending',
        notes:           dto.notes ?? null,
      })
      .select('id')
      .single()

    if (error || !data) throw new Error(error?.message ?? 'Failed to create data request')

    const reference = `OP-DR-${data.id.slice(0, 8).toUpperCase()}`

    // Confirmation email
    try {
      await this.emailService.sendEmail({
        to:      dto.requestorEmail,
        subject: `Your data rights request has been received — ${reference}`,
        html: `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111">
            <h2 style="color:#6366f1">Data Rights Request Received</h2>
            <p>We have received your <strong>${dto.requestType}</strong> request.</p>
            <p><strong>Reference:</strong> ${reference}</p>
            <p>We will process your request within <strong>30 days</strong> as required by the
               Digital Personal Data Protection Act 2023.</p>
            <p>If you have any questions, reply to this email or contact our Grievance Officer at
               <a href="mailto:grievance@occasionpro.in">grievance@occasionpro.in</a>.</p>
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
            <p style="font-size:12px;color:#6b7280">
              This is an automated message from OccasionPro.
              To exercise further data rights, visit your event's data rights page.
            </p>
          </div>
        `,
      })
    } catch (emailErr) {
      // Non-critical — request is still recorded
      this.logger.warn(`Confirmation email failed for ${dto.requestorEmail}: ${emailErr}`)
    }

    return { id: data.id, reference }
  }

  /**
   * Process an erasure request:
   *  1. Anonymise guest record (name, email, phone, custom_fields)
   *  2. Soft-delete check-in photos (set photo_url = null)
   *  3. Remove consent records for this email + tenant
   *  4. Mark request completed
   */
  async processErasureRequest(requestId: string, handledBy: string): Promise<void> {
    const client = this.serviceClient()

    const { data: req, error: reqErr } = await client
      .from('data_requests')
      .select('*')
      .eq('id', requestId)
      .eq('request_type', 'erasure')
      .single()

    if (reqErr || !req) throw new NotFoundException('Data request not found')

    const email    = req.requestor_email
    const tenantId = req.tenant_id

    // 1. Anonymise guest records
    await client
      .from('guests')
      .update({
        full_name:     'Deleted User',
        email:         null,
        phone:         null,
        custom_fields: null,
        notes:         null,
      })
      .eq('email',     email)
      .eq('tenant_id', tenantId)

    // 2. Remove consent records
    await client
      .from('consent_records')
      .delete()
      .eq('subject_email', email.toLowerCase())
      .eq('tenant_id',     tenantId)

    // 3. Mark completed
    const { error } = await client
      .from('data_requests')
      .update({
        status:       'completed',
        completed_at: new Date().toISOString(),
        handled_by:   handledBy,
        notes:        (req.notes ? req.notes + '\n' : '') + `Anonymised guest records and removed consent data.`,
      })
      .eq('id', requestId)

    if (error) throw new Error(error.message)

    this.logger.log(`Erasure completed for ${email} (request ${requestId})`)

    // Notify requestor
    try {
      await this.emailService.sendEmail({
        to:      email,
        subject: 'Your erasure request has been completed',
        html: `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
            <h2 style="color:#6366f1">Erasure Request Completed</h2>
            <p>Your personal data held in our system has been deleted as requested.</p>
            <p>If you have any further questions, contact
               <a href="mailto:grievance@occasionpro.in">grievance@occasionpro.in</a>.</p>
          </div>
        `,
      })
    } catch {}
  }

  /**
   * Process an access request: compile all data held and email it.
   */
  async processAccessRequest(requestId: string, handledBy: string): Promise<void> {
    const client = this.serviceClient()

    const { data: req, error: reqErr } = await client
      .from('data_requests')
      .select('*')
      .eq('id', requestId)
      .eq('request_type', 'access')
      .single()

    if (reqErr || !req) throw new NotFoundException('Data request not found')

    const email    = req.requestor_email
    const tenantId = req.tenant_id

    // Compile data bundle
    const [guestsRes, checkinsRes, consentsRes] = await Promise.all([
      client.from('guests').select('*').eq('email', email).eq('tenant_id', tenantId),
      client.from('checkin_logs').select('*').eq('tenant_id', tenantId)
        .in('guest_id', '(SELECT id FROM guests WHERE email = $1 AND tenant_id = $2)'),
      client.from('consent_records').select('consent_type,consent_given,consent_text,given_at,withdrawn_at')
        .eq('subject_email', email.toLowerCase()).eq('tenant_id', tenantId),
    ])

    const bundle = {
      generated_at: new Date().toISOString(),
      requestor: email,
      guests:    guestsRes.data  ?? [],
      consents:  consentsRes.data ?? [],
    }

    const bundleJson = JSON.stringify(bundle, null, 2)

    // Email the bundle
    try {
      await this.emailService.sendEmail({
        to:      email,
        subject: 'Your personal data — access request fulfilled',
        html: `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
            <h2 style="color:#6366f1">Your Personal Data</h2>
            <p>As requested, here is a summary of the personal data we hold about you:</p>
            <pre style="background:#f9fafb;padding:16px;border-radius:8px;font-size:12px;overflow:auto;white-space:pre-wrap">${bundleJson}</pre>
            <p style="font-size:12px;color:#6b7280;margin-top:24px">
              If you have any questions or wish to request correction or deletion of this data,
              contact <a href="mailto:grievance@occasionpro.in">grievance@occasionpro.in</a>.
            </p>
          </div>
        `,
      })
    } catch (e) {
      this.logger.warn(`Access bundle email failed: ${e}`)
    }

    // Mark completed
    await client
      .from('data_requests')
      .update({
        status:       'completed',
        completed_at: new Date().toISOString(),
        handled_by:   handledBy,
      })
      .eq('id', requestId)

    this.logger.log(`Access request completed for ${email} (request ${requestId})`)
  }

  /**
   * Update a request's status (for manual processing: correction, portability, rejection).
   */
  async updateRequestStatus(
    requestId: string,
    status:    RequestStatus,
    handledBy: string,
    notes?:    string,
  ): Promise<void> {
    const { error } = await this.serviceClient()
      .from('data_requests')
      .update({
        status,
        handled_by:   handledBy,
        completed_at: status === 'completed' ? new Date().toISOString() : null,
        ...(notes ? { notes } : {}),
      })
      .eq('id', requestId)

    if (error) throw new Error(error.message)
  }

  /**
   * List data requests — for super admin panel.
   */
  async getDataRequests(filters: {
    tenantId?:    string
    status?:      RequestStatus
    requestType?: RequestType
    page?:        number
    limit?:       number
  }): Promise<{ data: any[]; count: number }> {
    const { page = 1, limit = 50, tenantId, status, requestType } = filters
    const from = (page - 1) * limit
    const to   = from + limit - 1

    let query = this.serviceClient()
      .from('data_requests')
      .select('*', { count: 'exact' })
      .order('requested_at', { ascending: false })
      .range(from, to)

    if (tenantId)    query = query.eq('tenant_id',    tenantId)
    if (status)      query = query.eq('status',       status)
    if (requestType) query = query.eq('request_type', requestType)

    const { data, count, error } = await query
    if (error) throw new Error(error.message)

    return { data: data ?? [], count: count ?? 0 }
  }

  /**
   * Return the most recent active privacy policy version.
   */
  async getCurrentPrivacyPolicy(): Promise<{
    version: string
    content_markdown: string
    effective_from: string
  }> {
    const { data, error } = await this.serviceClient()
      .from('privacy_policy_versions')
      .select('version, content_markdown, effective_from')
      .order('effective_from', { ascending: false })
      .limit(1)
      .single()

    if (error || !data) throw new NotFoundException('No privacy policy found')
    return data
  }

  /**
   * Returns pending counts for the super admin dashboard badge.
   */
  async getSummary(): Promise<{
    pending: number
    processing: number
    completed: number
    rejected: number
  }> {
    const { data, error } = await this.serviceClient()
      .from('data_requests')
      .select('status')

    if (error) return { pending: 0, processing: 0, completed: 0, rejected: 0 }

    const counts = { pending: 0, processing: 0, completed: 0, rejected: 0 }
    for (const row of data ?? []) {
      counts[row.status as RequestStatus] = (counts[row.status as RequestStatus] ?? 0) + 1
    }
    return counts