import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { SupabaseService } from '../../common/supabase/supabase.service'
import { EmailService } from '../communications/email.service'
import { WhatsAppService } from '../communications/whatsapp.service'
import * as https from 'https'
import * as http from 'http'
import { URL } from 'url'

// ── DTOs ──────────────────────────────────────────────────────────────────────

export interface ActionConfig {
  // webhook.http
  url?: string
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH'
  headers?: Record<string, string>
  body_template?: string
  timeout_ms?: number
  retry_count?: number

  // email.send
  to_template?: string
  subject_template?: string
  body_template_html?: string
  cc?: string[]

  // whatsapp.send / sms.send
  to_field?: string      // path in context, e.g. "guest.phone"
  message_template?: string

  // task.create
  title_template?: string
  description_template?: string
  category?: string
  assigned_to?: string  // user id
  due_days_offset?: number

  // notification.internal
  title?: string
  message_template_text?: string

  // field.update
  entity?: string
  entity_id_field?: string
  field?: string
  value_template?: string

  // delay.wait
  seconds?: number

  // condition.branch
  condition_field?: string
  operator?: 'eq' | 'ne' | 'gt' | 'lt' | 'contains' | 'exists'
  condition_value?: unknown
  skip_actions_on_false?: string[]  // action IDs to skip if condition fails
}

export interface RuleAction {
  id: string
  type: string
  label?: string
  config: ActionConfig
}

export interface CreateRuleDto {
  name: string
  description?: string
  trigger_type: string
  trigger_filters?: Record<string, unknown>
  actions: RuleAction[]
  is_active?: boolean
  run_once?: boolean
  cooldown_seconds?: number
  max_executions?: number
  event_id?: string
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class AutomationsService {
  private readonly logger = new Logger(AutomationsService.name)

  constructor(
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService,
    private readonly email: EmailService,
    private readonly whatsapp: WhatsAppService,
  ) {}

  // ── CRUD ───────────────────────────────────────────────────────────────────

  async listRules(tenantId: string, eventId?: string) {
    const db = this.supabase.client
    let q = db
      .from('automation_rules')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })

    if (eventId) q = q.eq('event_id', eventId)

    const { data, error } = await q
    if (error) throw error
    return data
  }

  async getRule(tenantId: string, ruleId: string) {
    const { data, error } = await this.supabase.client
      .from('automation_rules')
      .select('*')
      .eq('id', ruleId)
      .single()
    if (error) throw new NotFoundException('Rule not found')
    if (data.tenant_id !== tenantId) throw new ForbiddenException()
    return data
  }

  async createRule(tenantId: string, userId: string, dto: CreateRuleDto) {
    const { data, error } = await this.supabase.client
      .from('automation_rules')
      .insert({
        tenant_id: tenantId,
        created_by: userId,
        event_id: dto.event_id ?? null,
        name: dto.name.trim(),
        description: dto.description?.trim() ?? null,
        trigger_type: dto.trigger_type,
        trigger_filters: dto.trigger_filters ?? {},
        actions: dto.actions,
        is_active: dto.is_active ?? true,
        run_once: dto.run_once ?? false,
        cooldown_seconds: dto.cooldown_seconds ?? 0,
        max_executions: dto.max_executions ?? null,
      })
      .select()
      .single()
    if (error) throw error
    return data
  }

  async updateRule(tenantId: string, ruleId: string, dto: Partial<CreateRuleDto>) {
    await this.getRule(tenantId, ruleId) // ownership check

    const { data, error } = await this.supabase.client
      .from('automation_rules')
      .update({
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.description !== undefined && { description: dto.description?.trim() }),
        ...(dto.trigger_type !== undefined && { trigger_type: dto.trigger_type }),
        ...(dto.trigger_filters !== undefined && { trigger_filters: dto.trigger_filters }),
        ...(dto.actions !== undefined && { actions: dto.actions }),
        ...(dto.is_active !== undefined && { is_active: dto.is_active }),
        ...(dto.run_once !== undefined && { run_once: dto.run_once }),
        ...(dto.cooldown_seconds !== undefined && { cooldown_seconds: dto.cooldown_seconds }),
        ...(dto.max_executions !== undefined && { max_executions: dto.max_executions }),
      })
      .eq('id', ruleId)
      .select()
      .single()
    if (error) throw error
    return data
  }

  async deleteRule(tenantId: string, ruleId: string) {
    await this.getRule(tenantId, ruleId)
    const { error } = await this.supabase.client
      .from('automation_rules')
      .delete()
      .eq('id', ruleId)
    if (error) throw error
  }

  async toggleRule(tenantId: string, ruleId: string) {
    const rule = await this.getRule(tenantId, ruleId)
    return this.updateRule(tenantId, ruleId, { is_active: !rule.is_active })
  }

  // ── Execution history ──────────────────────────────────────────────────────

  async listExecutions(tenantId: string, ruleId: string, limit = 50) {
    const rule = await this.getRule(tenantId, ruleId)
    const { data, error } = await this.supabase.client
      .from('automation_executions')
      .select(`
        *,
        automation_action_logs (*)
      `)
      .eq('rule_id', rule.id)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw error
    return data
  }

  // ── Trigger dispatch (called by other services / cron / webhooks) ──────────

  /**
   * Fire all active rules matching a trigger_type for this tenant/event combo.
   * Other services call this when something happens:
   *   e.g. await automations.fire('guest.rsvp_confirmed', tenantId, eventId, { guest_id, guest_name, phone })
   */
  async fire(
    triggerType: string,
    tenantId: string,
    eventId: string | null,
    context: Record<string, unknown>,
  ): Promise<void> {
    const db = this.supabase.client

    // Find matching active rules
    let q = db
      .from('automation_rules')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('trigger_type', triggerType)
      .eq('is_active', true)

    // Match rules scoped to this event OR global rules (event_id IS NULL)
    if (eventId) {
      q = q.or(`event_id.eq.${eventId},event_id.is.null`)
    } else {
      q = q.is('event_id', null)
    }

    const { data: rules, error } = await q
    if (error) {
      this.logger.error(`Failed to query rules for ${triggerType}: ${error.message}`)
      return
    }

    for (const rule of rules ?? []) {
      // Check max_executions
      if (rule.max_executions !== null && rule.execution_count >= rule.max_executions) continue

      // Check cooldown
      if (rule.cooldown_seconds > 0 && rule.last_fired_at) {
        const elapsed = (Date.now() - new Date(rule.last_fired_at).getTime()) / 1000
        if (elapsed < rule.cooldown_seconds) continue
      }

      // Check trigger_filters match context
      if (!this.matchesFilters(rule.trigger_filters ?? {}, context)) continue

      setImmediate(() => this.executeRule(rule, tenantId, eventId, context))
    }
  }

  // ── Manual trigger ─────────────────────────────────────────────────────────

  async manualFire(tenantId: string, ruleId: string, context: Record<string, unknown> = {}) {
    const rule = await this.getRule(tenantId, ruleId)
    await this.executeRule(rule, tenantId, rule.event_id ?? null, { ...context, manual: true })
    return { ok: true, message: 'Execution started' }
  }

  // ── Core execution engine ──────────────────────────────────────────────────

  private async executeRule(
    rule: any,
    tenantId: string,
    eventId: string | null,
    context: Record<string, unknown>,
  ) {
    const db = this.supabase.client
    const actions: RuleAction[] = rule.actions ?? []

    // Create execution record
    const { data: exec, error: execErr } = await db
      .from('automation_executions')
      .insert({
        rule_id: rule.id,
        tenant_id: tenantId,
        event_id: eventId,
        trigger_type: rule.trigger_type,
        trigger_context: context,
        status: 'running',
        actions_total: actions.length,
        started_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (execErr) {
      this.logger.error(`Failed to create execution for rule ${rule.id}: ${execErr.message}`)
      return
    }

    let successCount = 0
    let failedCount = 0
    let skippedCount = 0
    const skippedIds = new Set<string>()

    for (let i = 0; i < actions.length; i++) {
      const action = actions[i]

      // condition.branch may have flagged this action to be skipped
      if (skippedIds.has(action.id)) {
        skippedCount++
        await this.logAction(exec.id, tenantId, i, action, 'skipped', null)
        continue
      }

      const { success, output, error, httpStatus, httpDuration } = await this.executeAction(
        action,
        context,
        tenantId,
        eventId,
      )

      // Handle condition.branch skipping
      if (action.type === 'condition.branch' && !success) {
        const cfg = action.config
        for (const skipId of cfg.skip_actions_on_false ?? []) {
          skippedIds.add(skipId)
        }
      }

      if (success) successCount++
      else failedCount++

      await this.logAction(exec.id, tenantId, i, action, success ? 'success' : 'failed', {
        output,
        error,
        httpStatus,
        httpDuration,
      })
    }

    // Determine final status
    let finalStatus: string
    if (failedCount === 0) finalStatus = 'success'
    else if (successCount === 0) finalStatus = 'failed'
    else finalStatus = 'partial_failure'

    await db
      .from('automation_executions')
      .update({
        status: finalStatus,
        completed_at: new Date().toISOString(),
        actions_success: successCount,
        actions_failed: failedCount,
        actions_skipped: skippedCount,
      })
      .eq('id', exec.id)
  }

  private async executeAction(
    action: RuleAction,
    context: Record<string, unknown>,
    tenantId: string,
    eventId: string | null,
  ): Promise<{
    success: boolean
    output?: unknown
    error?: string
    httpStatus?: number
    httpDuration?: number
  }> {
    const cfg = action.config

    try {
      switch (action.type) {

        case 'webhook.http': {
          const url = this.interpolate(cfg.url ?? '', context)
          const body = this.interpolate(cfg.body_template ?? '', context)
          const { status, response, duration } = await this.httpPost(
            url,
            cfg.method ?? 'POST',
            cfg.headers ?? {},
            body,
            cfg.timeout_ms ?? 10000,
            cfg.retry_count ?? 1,
          )
          const success = status >= 200 && status < 300
          return { success, output: { response }, httpStatus: status, httpDuration: duration }
        }

        case 'email.send': {
          const to = this.interpolate(cfg.to_template ?? '', context)
          const subject = this.interpolate(cfg.subject_template ?? '', context)
          const html = this.interpolate(cfg.body_template_html ?? '', context)
          if (!to) return { success: false, error: 'to_template resolved to empty string' }
          await this.email.send(
            { subject, html, text: html.replace(/<[^>]+>/g, '') },
            to,
          )
          return { success: true }
        }

        case 'whatsapp.send': {
          const phone = this.resolveField(cfg.to_field ?? 'phone', context) as string
          const message = this.interpolate(cfg.message_template ?? '', context)
          if (!phone) return { success: false, error: 'Could not resolve WhatsApp phone from context' }
          await this.whatsapp.sendMessage(phone, message)
          return { success: true }
        }

        case 'task.create': {
          const title = this.interpolate(cfg.title_template ?? 'Automated Task', context)
          const description = this.interpolate(cfg.description_template ?? '', context)
          const dueDate = cfg.due_days_offset !== undefined
            ? new Date(Date.now() + cfg.due_days_offset * 86400000).toISOString()
            : null
          const { error } = await this.supabase.client.from('tasks').insert({
            tenant_id: tenantId,
            event_id: eventId,
            title,
            description,
            category: cfg.category ?? 'general',
            assigned_to: cfg.assigned_to ?? null,
            due_date: dueDate,
            status: 'pending',
          })
          if (error) return { success: false, error: error.message }
          return { success: true }
        }

        case 'notification.internal': {
          const message = this.interpolate(cfg.message_template_text ?? '', context)
          const { error } = await this.supabase.client.from('notifications').insert({
            tenant_id: tenantId,
            event_id: eventId,
            title: cfg.title ?? 'Automation Alert',
            message,
            type: 'automation',
          }).select()
          // notifications table may not exist yet — treat as soft failure
          if (error) this.logger.warn(`Notification insert failed: ${error.message}`)
          return { success: true }
        }

        case 'field.update': {
          const entityId = this.resolveField(cfg.entity_id_field ?? 'id', context) as string
          const value = this.interpolate(cfg.value_template ?? '', context)
          if (!entityId || !cfg.entity || !cfg.field) {
            return { success: false, error: 'field.update missing entity, entity_id_field, or field' }
          }
          const { error } = await this.supabase.client
            .from(cfg.entity)
            .update({ [cfg.field]: value })
            .eq('id', entityId)
            .eq('tenant_id', tenantId)
          if (error) return { success: false, error: error.message }
          return { success: true }
        }

        case 'delay.wait': {
          await new Promise(resolve => setTimeout(resolve, (cfg.seconds ?? 1) * 1000))
          return { success: true }
        }

        case 'condition.branch': {
          const fieldValue = this.resolveField(cfg.condition_field ?? '', context)
          const passes = this.evaluateCondition(fieldValue, cfg.operator ?? 'eq', cfg.condition_value)
          // success=true means condition passed; success=false means condition failed (will trigger skip)
          return { success: passes, output: { condition_result: passes, field_value: fieldValue } }
        }

        default:
          return { success: false, error: `Unknown action type: ${action.type}` }
      }
    } catch (err: any) {
      return { success: false, error: err?.message ?? String(err) }
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  /** Interpolate {{path.to.value}} tokens from context */
  private interpolate(template: string, context: Record<string, unknown>): string {
    return template.replace(/\{\{([^}]+)\}\}/g, (_, path) => {
      const val = this.resolveField(path.trim(), context)
      return val !== undefined && val !== null ? String(val) : ''
    })
  }

  /** Resolve a dot-path in context object */
  private resolveField(path: string, context: Record<string, unknown>): unknown {
    return path.split('.').reduce((obj: any, key) => obj?.[key], context)
  }

  /** Check trigger_filters match the context */
  private matchesFilters(filters: Record<string, unknown>, context: Record<string, unknown>): boolean {
    for (const [key, expected] of Object.entries(filters)) {
      const actual = context[key]
      if (Array.isArray(expected)) {
        if (!expected.includes(actual)) return false
      } else {
        if (actual !== expected) return false
      }
    }
    return true
  }

  private evaluateCondition(value: unknown, operator: string, expected: unknown): boolean {
    switch (operator) {
      case 'eq':       return value === expected
      case 'ne':       return value !== expected
      case 'gt':       return Number(value) > Number(expected)
      case 'lt':       return Number(value) < Number(expected)
      case 'contains': return String(value ?? '').includes(String(expected ?? ''))
      case 'exists':   return value !== undefined && value !== null
      default:         return false
    }
  }

  /** Simple HTTP request with retry */
  private async httpPost(
    urlStr: string,
    method: string,
    headers: Record<string, string>,
    body: string,
    timeoutMs: number,
    retries: number,
  ): Promise<{ status: number; response: string; duration: number }> {
    let lastErr: Error | null = null
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const start = Date.now()
        const result = await this.doRequest(urlStr, method, headers, body, timeoutMs)
        return { ...result, duration: Date.now() - start }
      } catch (err: any) {
        lastErr = err
        if (attempt < retries) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)))
      }
    }
    throw lastErr ?? new Error('HTTP request failed')
  }

  private doRequest(
    urlStr: string,
    method: string,
    headers: Record<string, string>,
    body: string,
    timeoutMs: number,
  ): Promise<{ status: number; response: string }> {
    return new Promise((resolve, reject) => {
      const parsed = new URL(urlStr)
      const lib = parsed.protocol === 'https:' ? https : http
      const bodyBuf = Buffer.from(body, 'utf-8')

      const req = lib.request(
        {
          hostname: parsed.hostname,
          port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
          path: parsed.pathname + parsed.search,
          method: method.toUpperCase(),
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': bodyBuf.length,
            'User-Agent': 'OccasionPro-Automations/1.0',
            ...headers,
          },
          timeout: timeoutMs,
        },
        (res) => {
          let data = ''
          res.on('data', (chunk) => (data += chunk))
          res.on('end', () => resolve({ status: res.statusCode ?? 0, response: data.slice(0, 2000) }))
        },
      )
      req.on('error', reject)
      req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')) })
      req.write(bodyBuf)
      req.end()
    })
  }

  private async logAction(
    execId: string,
    tenantId: string,
    index: number,
    action: RuleAction,
    status: string,
    result: { output?: unknown; error?: string; httpStatus?: number; httpDuration?: number } | null,
  ) {
    await this.supabase.client.from('automation_action_logs').insert({
      execution_id: execId,
      tenant_id: tenantId,
      action_index: index,
      action_id: action.id,
      action_type: action.type,
      action_label: action.label ?? null,
      status,
      completed_at: new Date().toISOString(),
      http_status_code: result?.httpStatus ?? null,
      http_response: result?.output ? String(result.output).slice(0, 2000) : null,
      http_duration_ms: result?.httpDuration ?? null,
      output: result?.output ? { value: result.output } : {},
      error_message: result?.error ?? null,
    })
  }

  // ── Analytics ──────────────────────────────────────────────────────────────

  async getAnalytics(tenantId: string, eventId?: string) {
    const db = this.supabase.client

    let rulesQ = db
      .from('automation_rules')
      .select('id, name, trigger_type, execution_count, last_fired_at, is_active')
      .eq('tenant_id', tenantId)
      .order('execution_count', { ascending: false })

    if (eventId) rulesQ = rulesQ.eq('event_id', eventId)

    const { data: rules } = await rulesQ

    let execQ = db
      .from('automation_executions')
      .select('status, trigger_type, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(500)

    if (eventId) execQ = execQ.eq('event_id', eventId)

    const { data: execs } = await execQ

    const totalRules = rules?.length ?? 0
    const activeRules = rules?.filter(r => r.is_active).length ?? 0
    const totalExecs = execs?.length ?? 0
    const successExecs = execs?.filter(e => e.status === 'success' || e.status === 'partial_failure').length ?? 0
    const failedExecs = execs?.filter(e => e.status === 'failed').length ?? 0

    return {
      total_rules: totalRules,
      active_rules: activeRules,
      total_executions: totalExecs,
      success_rate: totalExecs > 0 ? Math.round((successExecs / totalExecs) * 100) : 0,
      failed_executions: failedExecs,
      top_rules: rules?.slice(0, 5) ?? [],
      recent_executions: execs?.slice(0, 20) ?? [],
    }
  }
}
