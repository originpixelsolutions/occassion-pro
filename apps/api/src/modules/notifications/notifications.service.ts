/**
 * OccasionPro â Notifications Service
 *
 * Central notification hub for all portals (team, client, vendor, guest).
 * Persists via Supabase, broadcasts real-time via Socket.io gateway.
 *
 * Multi-channel: in-app Â· email Â· SMS Â· WhatsApp Â· Expo push
 * Template engine: Handlebars (templates stored in notification_templates table)
 * Delivery log: notification_log table (immutable append-only)
 */

import { Injectable, Logger } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import { Queue } from 'bullmq'
import { SupabaseService } from '../../common/supabase/supabase.service'
import { NotificationsGateway } from './notifications.gateway'
import { EmailService } from '../communications/email.service'
import { SMSService } from '../communications/sms.service'
import { WhatsAppService } from '../communications/whatsapp.service'
import * as Handlebars from 'handlebars'

// âââ Enums / Literal Types âââââââââââââââââââââââââââââââââââââââââââââââââââââ

export type RecipientType = 'team' | 'guest' | 'client' | 'vendor'
export type NotificationChannel = 'in_app' | 'email' | 'sms' | 'whatsapp' | 'push'
export type NotificationModule =
  | 'guests' | 'finance' | 'fnb' | 'floorplan' | 'runsheet'
  | 'vendors' | 'clients' | 'team' | 'conference' | 'post_event' | 'system'
  | 'alerts'
export type NotificationUrgency = 'info' | 'warning' | 'critical'
export type DeliveryStatus = 'queued' | 'sent' | 'delivered' | 'failed' | 'bounced' | 'skipped'

// âââ Legacy DTO (preserved for backward compat) ââââââââââââââââââââââââââââââââ

export interface CreateNotificationDto {
  tenant_id: string
  event_id?: string | null
  recipient_id: string
  recipient_type: RecipientType
  module: NotificationModule
  title: string
  body: string
  action_url?: string | null
  urgency?: NotificationUrgency
  batch_key?: string | null
}

export interface NotificationItem {
  id: string
  tenant_id: string
  event_id: string | null
  recipient_id: string
  recipient_type: RecipientType
  module: NotificationModule
  urgency: NotificationUrgency
  title: string
  body: string
  action_url: string | null
  is_read: boolean
  read_at: string | null
  batch_count: number
  created_at: string
}

export interface NotificationPreference {
  module: NotificationModule
  urgency_threshold: NotificationUrgency
  in_app_enabled: boolean
  email_enabled: boolean
  whatsapp_enabled: boolean
}

// âââ New Multi-Channel DTOs ââââââââââââââââââââââââââââââââââââââââââââââââââââ

export interface SendNotificationOptions {
  tenantId: string
  /** The user/guest/vendor/client row id */
  recipientType: RecipientType
  recipientId: string
  /** Key that maps to notification_templates.template_key */
  templateKey: string
  /** Handlebars variables injected into title/body/subject templates */
  variables: Record<string, string | number | boolean | null | undefined>
  /** Override resolved channels; if omitted, resolved from user prefs */
  channels?: NotificationChannel[]
  eventId?: string | null
  /** Optional direct contacts (overrides DB lookup) */
  contactEmail?: string | null
  contactPhone?: string | null
  contactWhatsApp?: string | null
  /** Expo push token (overrides DB lookup) */
  pushToken?: string | null
}

export interface SendBulkNotificationOptions {
  tenantId: string
  recipients: Array<{
    recipientType: RecipientType
    recipientId: string
    contactEmail?: string | null
    contactPhone?: string | null
    contactWhatsApp?: string | null
    pushToken?: string | null
  }>
  templateKey: string
  variables: Record<string, string | number | boolean | null | undefined>
  channels?: NotificationChannel[]
  eventId?: string | null
}

export interface ChannelPreferencesDto {
  preferences: Record<string, Record<NotificationChannel, boolean>>
  quiet_hours_start?: string | null  // HH:MM
  quiet_hours_end?: string | null    // HH:MM
  quiet_hours_timezone?: string | null
}

export interface NotificationLogFilters {
  page?: number
  limit?: number
  channel?: NotificationChannel
  status?: DeliveryStatus
  templateKey?: string
  recipientId?: string
}

// âââ Template â Category map âââââââââââââââââââââââââââââââââââââââââââââââââââ

const TEMPLATE_CATEGORY: Record<string, string> = {
  guest_rsvp_confirmed:      'guests',
  guest_rsvp_declined:       'guests',
  guest_checkin_welcome:     'guests',
  guest_invitation_sent:     'guests',
  team_invite:               'team',
  team_event_assigned:       'team',
  runsheet_item_assigned:    'runsheet',
  alert_critical:            'alerts',
  alert_warning:             'alerts',
  vendor_event_assigned:     'vendors',
  vendor_payment_done:       'vendors',
  client_portal_access:      'clients',
  client_file_shared:        'clients',
  payment_confirmed:         'finance',
  refund_processed:          'finance',
  payment_failed:            'finance',
  event_reminder_24h:        'system',
  event_reminder_1h:         'system',
}

/** Channels enabled by default when the user has no preference row */
const DEFAULT_CATEGORY_CHANNELS: Record<string, NotificationChannel[]> = {
  guests:   ['in_app', 'email', 'whatsapp'],
  team:     ['in_app', 'email'],
  runsheet: ['in_app'],
  alerts:   ['in_app', 'email', 'push'],
  vendors:  ['in_app', 'email'],
  clients:  ['in_app', 'email'],
  finance:  ['in_app', 'email'],
  system:   ['in_app'],
}

// âââ Service âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name)

  constructor(
    private readonly supabase: SupabaseService,
    private readonly gateway: NotificationsGateway,
    private readonly emailService: EmailService,
    private readonly smsService: SMSService,
    private readonly whatsappService: WhatsAppService,
    @InjectQueue('notifications') private readonly notificationsQueue: Queue,
  ) {}

  // ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  // PUBLIC: Multi-channel send
  // ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

  /**
   * Primary notification entry point.
   * Fire-and-forget: never throws, all errors are caught + logged to delivery log.
   */
  async sendNotification(opts: SendNotificationOptions): Promise<void> {
    try {
      // 1. Fetch template (tenant override â system fallback)
      const template = await this.fetchTemplate(opts.templateKey, opts.tenantId)
      if (!template) {
        this.logger.warn(`No template found for key: ${opts.templateKey}`)
        return
      }

      // 2. Render title + body with Handlebars
      const title   = this.renderTemplate(template.title_template, opts.variables)
      const body    = this.renderTemplate(template.body_template, opts.variables)
      const subject = template.subject_template
        ? this.renderTemplate(template.subject_template, opts.variables)
        : title

      // 3. Resolve which channels to use
      const category = TEMPLATE_CATEGORY[opts.templateKey] ?? 'system'
      const channels = opts.channels ?? await this.resolveChannels(
        opts.recipientId, opts.tenantId, category
      )

      // 4. Resolve contact details
      const contact = await this.resolveContact(
        opts.recipientId, opts.recipientType, opts.tenantId, opts
      )

      // 5. Dispatch to each channel
      for (const channel of channels) {
        await this.dispatchChannel({
          channel,
          tenantId: opts.tenantId,
          recipientId: opts.recipientId,
          recipientType: opts.recipientType,
          templateKey: opts.templateKey,
          eventId: opts.eventId ?? null,
          title,
          body,
          subject,
          contact,
          actionUrl: template.action_url_template
            ? this.renderTemplate(template.action_url_template, opts.variables)
            : null,
          variables: opts.variables,
        })
      }
    } catch (err) {
      this.logger.error(`sendNotification error [${opts.templateKey}]: ${err}`)
    }
  }

  /**
   * Send same notification to many recipients.
   * 50ms delay between each to avoid rate-limit spikes.
   */
  async sendBulkNotification(opts: SendBulkNotificationOptions): Promise<void> {
    for (const recipient of opts.recipients) {
      await this.sendNotification({
        tenantId:       opts.tenantId,
        recipientType:  recipient.recipientType,
        recipientId:    recipient.recipientId,
        templateKey:    opts.templateKey,
        variables:      opts.variables,
        channels:       opts.channels,
        eventId:        opts.eventId,
        contactEmail:   recipient.contactEmail,
        contactPhone:   recipient.contactPhone,
        contactWhatsApp: recipient.contactWhatsApp,
        pushToken:      recipient.pushToken,
      })
      // slight backoff between dispatches
      await new Promise(r => setTimeout(r, 50))
    }
  }

  /**
   * Schedule event reminders: 24h before and 1h before.
   * Uses BullMQ delayed jobs so reminders survive server restarts and deployments.
   */
  async scheduleEventReminders(eventId: string, tenantId: string): Promise<void> {
    const { data: event } = await this.supabase.serviceClient
      .from('events')
      .select('id, name, start_date, tenant_id, team_members:event_team(user_id, role)')
      .eq('id', eventId)
      .single()

    if (!event) return

    const startMs   = new Date(event.start_date).getTime()
    const now       = Date.now()
    const delay24h  = startMs - now - 24 * 60 * 60 * 1000
    const delay1h   = startMs - now - 60 * 60 * 1000

    const teamMembers: Array<{ user_id: string }> = (event as any).team_members ?? []
    const recipientIds = teamMembers.map(m => m.user_id)
    const eventStart   = new Date(event.start_date).toLocaleString('en-IN', {
      dateStyle: 'medium', timeStyle: 'short',
    })

    if (delay24h > 0) {
      await this.notificationsQueue.add(
        'send-reminder',
        { tenantId, templateKey: 'event_reminder_24h', eventName: event.name, eventStart, recipientIds },
        { delay: delay24h, jobId: `reminder-24h-${eventId}`, removeOnComplete: true },
      )
    }

    if (delay1h > 0) {
      await this.notificationsQueue.add(
        'send-reminder',
        { tenantId, templateKey: 'event_reminder_1h', eventName: event.name, eventStart, recipientIds },
        { delay: delay1h, jobId: `reminder-1h-${eventId}`, removeOnComplete: true },
      )
    }

    this.logger.log(`Scheduled BullMQ reminders for event ${eventId}`)
  }

  // ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  // PUBLIC: Delivery log (super admin)
  // ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

  async getNotificationLog(tenantId: string, filters: NotificationLogFilters = {}) {
    const page  = filters.page  ?? 1
    const limit = filters.limit ?? 50
    const from  = (page - 1) * limit
    const to    = from + limit - 1

    let query = this.supabase.serviceClient
      .from('notification_log')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (filters.channel)      query = query.eq('channel',      filters.channel)
    if (filters.status)       query = query.eq('status',       filters.status)
    if (filters.templateKey)  query = query.eq('template_key', filters.templateKey)
    if (filters.recipientId)  query = query.eq('recipient_id', filters.recipientId)

    const { data, error, count } = await query
    if (error) throw error

    return { items: data ?? [], total: count ?? 0, page, limit }
  }

  // ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  // PUBLIC: Channel preferences (new schema)
  // ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

  async getChannelPreferences(userId: string, tenantId: string) {
    const { data } = await this.supabase.serviceClient
      .from('notification_channel_preferences')
      .select('*')
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
      .single()

    return data ?? null
  }

  async updateChannelPreferences(
    userId: string,
    tenantId: string,
    dto: ChannelPreferencesDto,
  ): Promise<void> {
    const { error } = await this.supabase.serviceClient
      .from('notification_channel_preferences')
      .upsert({
        user_id:                userId,
        tenant_id:              tenantId,
        channel_matrix:         dto.preferences,
        quiet_hours_start:      dto.quiet_hours_start ?? null,
        quiet_hours_end:        dto.quiet_hours_end   ?? null,
        quiet_hours_timezone:   dto.quiet_hours_timezone ?? 'UTC',
        updated_at:             new Date().toISOString(),
      }, { onConflict: 'user_id,tenant_id' })

    if (error) throw error
  }

  // ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  // LEGACY: in-app only (backward compat â preserved as-is)
  // ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

  /** @deprecated Use sendNotification() with templateKey instead */
  async send(payload: CreateNotificationDto): Promise<string | null> {
    try {
      const { data: notifId, error } = await this.supabase.serviceClient.rpc('create_notification', {
        p_tenant_id:      payload.tenant_id,
        p_event_id:       payload.event_id ?? null,
        p_recipient_id:   payload.recipient_id,
        p_recipient_type: payload.recipient_type,
        p_module:         payload.module,
        p_title:          payload.title,
        p_body:           payload.body,
        p_action_url:     payload.action_url ?? null,
        p_urgency:        payload.urgency ?? 'info',
        p_batch_key:      payload.batch_key ?? null,
      })

      if (error) {
        this.logger.error(`Failed to create notification: ${error.message}`)
        return null
      }

      if (notifId) {
        const { data: notification } = await this.supabase.serviceClient
          .from('notifications')
          .select('*')
          .eq('id', notifId)
          .single()

        if (notification) {
          this.gateway.emitToRecipient(payload.recipient_id, 'notification:new', notification)
        }
      }

      return notifId
    } catch (err) {
      this.logger.error(`Notification send error: ${err}`)
      return null
    }
  }

  /** @deprecated Use sendBulkNotification() instead */
  async sendBulk(
    recipients: Array<{ recipient_id: string; recipient_type: RecipientType }>,
    base: Omit<CreateNotificationDto, 'recipient_id' | 'recipient_type'>,
  ): Promise<void> {
    await Promise.allSettled(
      recipients.map(r =>
        this.send({ ...base, recipient_id: r.recipient_id, recipient_type: r.recipient_type }),
      ),
    )
  }

  async getUnread(
    recipientId: string,
    limit = 50,
  ): Promise<{ count: number; items: NotificationItem[] }> {
    const [countRes, itemsRes] = await Promise.all([
      this.supabase.serviceClient.rpc('get_unread_count', { p_recipient_id: recipientId }),
      this.supabase.serviceClient
        .from('notifications')
        .select('*')
        .eq('recipient_id', recipientId)
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .limit(limit),
    ])

    return {
      count: (countRes.data as number) ?? 0,
      items: (itemsRes.data as NotificationItem[]) ?? [],
    }
  }

  async getAll(
    recipientId: string,
    page = 1,
    limit = 25,
  ): Promise<{ items: NotificationItem[]; total: number; page: number; limit: number }> {
    const from = (page - 1) * limit
    const to   = from + limit - 1

    const { data, error, count } = await this.supabase.serviceClient
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('recipient_id', recipientId)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) throw error

    return {
      items: (data as NotificationItem[]) ?? [],
      total: count ?? 0,
      page,
      limit,
    }
  }

  async markRead(
    recipientId: string,
    ids: string[],
  ): Promise<{ marked: number }> {
    const { data } = await this.supabase.serviceClient.rpc('mark_notifications_read', {
      p_recipient_id: recipientId,
      p_ids: ids,
    })

    const marked = (data as number) ?? 0

    if (marked > 0) {
      this.gateway.emitToRecipient(recipientId, 'notification:read', { ids })
      const { data: newCount } = await this.supabase.serviceClient.rpc('get_unread_count', {
        p_recipient_id: recipientId,
      })
      this.gateway.emitToRecipient(recipientId, 'notification:count', { count: newCount ?? 0 })
    }

    return { marked }
  }

  async markAllRead(
    recipientId: string,
    tenantId: string,
  ): Promise<{ marked: number }> {
    const { data } = await this.supabase.serviceClient.rpc('mark_all_notifications_read', {
      p_recipient_id: recipientId,
      p_tenant_id:    tenantId,
    })

    const marked = (data as number) ?? 0

    if (marked > 0) {
      this.gateway.emitToRecipient(recipientId, 'notification:read_all', {})
      this.gateway.emitToRecipient(recipientId, 'notification:count', { count: 0 })
    }

    return { marked }
  }

  /** @deprecated Use getChannelPreferences() instead */
  async getPreferences(userId: string, tenantId: string): Promise<NotificationPreference[]> {
    const { data } = await this.supabase.serviceClient
      .from('notification_preferences')
      .select('module, urgency_threshold, in_app_enabled, email_enabled, whatsapp_enabled')
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)

    return (data as NotificationPreference[]) ?? []
  }

  /** @deprecated Use updateChannelPreferences() instead */
  async updatePreferences(
    userId: string,
    recipientType: RecipientType,
    tenantId: string,
    prefs: NotificationPreference[],
  ): Promise<void> {
    const upserts = prefs.map(p => ({
      user_id:           userId,
      recipient_type:    recipientType,
      tenant_id:         tenantId,
      module:            p.module,
      urgency_threshold: p.urgency_threshold,
      in_app_enabled:    p.in_app_enabled,
      email_enabled:     p.email_enabled,
      whatsapp_enabled:  p.whatsapp_enabled,
      updated_at:        new Date().toISOString(),
    }))

    const { error } = await this.supabase.serviceClient
      .from('notification_preferences')
      .upsert(upserts, { onConflict: 'user_id,tenant_id,module' })

    if (error) throw error
  }

  async registerDeviceToken(
    userId: string,
    tenantId: string,
    token: string,
    platform: 'ios' | 'android' | 'web',
  ): Promise<{ success: boolean }> {
    try {
      const { error } = await this.supabase.serviceClient
        .from('user_device_tokens')
        .upsert(
          { user_id: userId, tenant_id: tenantId, token, platform, updated_at: new Date().toISOString() },
          { onConflict: 'user_id,token' }
        )

      if (error) this.logger.warn(`registerDeviceToken: ${error.message}`)
      return { success: !error }
    } catch (err) {
      this.logger.error('registerDeviceToken error', err)
      return { success: false }
    }
  }

  async removeDeviceToken(userId: string, token: string): Promise<{ success: boolean }> {
    try {
      const { error } = await this.supabase.serviceClient
        .from('user_device_tokens')
        .delete()
        .eq('user_id', userId)
        .eq('token', token)

      return { success: !error }
    } catch (err) {
      this.logger.error('removeDeviceToken error', err)
      return { success: false }
    }
  }

  // ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  // PRIVATE: Internals
  // ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

  private async fetchTemplate(templateKey: string, tenantId: string) {
    // Try tenant-specific override first
    const { data: tenantTpl } = await this.supabase.serviceClient
      .from('notification_templates')
      .select('*')
      .eq('template_key', templateKey)
      .eq('tenant_id', tenantId)
      .single()

    if (tenantTpl) return tenantTpl

    // Fall back to system template (tenant_id IS NULL)
    const { data: systemTpl } = await this.supabase.serviceClient
      .from('notification_templates')
      .select('*')
      .eq('template_key', templateKey)
      .is('tenant_id', null)
      .single()

    return systemTpl ?? null
  }

  private renderTemplate(
    template: string,
    variables: Record<string, string | number | boolean | null | undefined>,
  ): string {
    try {
      const compiled = Handlebars.compile(template, { noEscape: true })
      return compiled(variables)
    } catch {
      // Fall back to raw template on compile error
      return template
    }
  }

  private async resolveChannels(
    recipientId: string,
    tenantId: string,
    category: string,
  ): Promise<NotificationChannel[]> {
    const { data: prefs } = await this.supabase.serviceClient
      .from('notification_channel_preferences')
      .select('channel_matrix, quiet_hours_start, quiet_hours_end, quiet_hours_timezone')
      .eq('user_id', recipientId)
      .eq('tenant_id', tenantId)
      .single()

    if (!prefs) {
      return DEFAULT_CATEGORY_CHANNELS[category] ?? ['in_app']
    }

    // Check quiet hours â skip email/sms/whatsapp during quiet period
    const inQuiet = this.isInQuietHours(
      prefs.quiet_hours_start,
      prefs.quiet_hours_end,
      prefs.quiet_hours_timezone,
    )

    const matrix: Record<string, Record<string, boolean>> = prefs.channel_matrix ?? {}
    const catPrefs = matrix[category] ?? {}

    const allChannels: NotificationChannel[] = ['in_app', 'email', 'sms', 'whatsapp', 'push']
    const defaultEnabled = DEFAULT_CATEGORY_CHANNELS[category] ?? ['in_app']

    return allChannels.filter(ch => {
      const enabled = ch in catPrefs
        ? catPrefs[ch]
        : defaultEnabled.includes(ch)

      // Suppress external channels during quiet hours
      if (inQuiet && ch !== 'in_app') return false
      return enabled
    })
  }

  private isInQuietHours(
    start: string | null,
    end: string | null,
    timezone: string | null,
  ): boolean {
    if (!start || !end) return false

    const tz = timezone ?? 'UTC'
    const now = new Date()

    // Get current HH:MM in the user's timezone
    const nowStr = now.toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz,
    })
    const [nowH, nowM] = nowStr.split(':').map(Number)
    const nowMins = nowH * 60 + nowM

    const [sh, sm] = start.split(':').map(Number)
    const [eh, em] = end.split(':').map(Number)
    const startMins = sh * 60 + sm
    const endMins   = eh * 60 + em

    // Handle overnight range (e.g. 22:00 â 08:00)
    if (startMins > endMins) {
      return nowMins >= startMins || nowMins <= endMins
    }
    return nowMins >= startMins && nowMins <= endMins
  }

  private async resolveContact(
    recipientId: string,
    recipientType: RecipientType,
    tenantId: string,
    opts: Pick<SendNotificationOptions, 'contactEmail' | 'contactPhone' | 'contactWhatsApp' | 'pushToken'>,
  ) {
    // If all contacts provided directly, skip DB lookup
    if (opts.contactEmail && opts.contactPhone && opts.contactWhatsApp) {
      return {
        email:    opts.contactEmail,
        phone:    opts.contactPhone,
        whatsapp: opts.contactWhatsApp,
        pushToken: opts.pushToken ?? null,
      }
    }

    let email: string | null = opts.contactEmail ?? null
    let phone: string | null = opts.contactPhone ?? null
    let whatsapp: string | null = opts.contactWhatsApp ?? null
    let pushToken: string | null = opts.pushToken ?? null

    // Look up from the appropriate table
    if (recipientType === 'team') {
      const { data } = await this.supabase.serviceClient
        .from('profiles')
        .select('email, phone')
        .eq('id', recipientId)
        .single()

      if (data) {
        email    = email    ?? data.email
        phone    = phone    ?? data.phone
        whatsapp = whatsapp ?? data.phone
      }

      // Fetch push token
      if (!pushToken) {
        const { data: tokenRow } = await this.supabase.serviceClient
          .from('user_device_tokens')
          .select('token')
          .eq('user_id', recipientId)
          .eq('tenant_id', tenantId)
          .order('updated_at', { ascending: false })
          .limit(1)
          .single()

        pushToken = tokenRow?.token ?? null
      }
    } else if (recipientType === 'guest') {
      const { data } = await this.supabase.serviceClient
        .from('guests')
        .select('email, phone, whatsapp_number')
        .eq('id', recipientId)
        .single()

      if (data) {
        email    = email    ?? data.email
        phone    = phone    ?? data.phone
        whatsapp = whatsapp ?? data.whatsapp_number ?? data.phone
      }
    } else if (recipientType === 'client') {
      const { data } = await this.supabase.serviceClient
        .from('client_accounts')
        .select('email, phone')
        .eq('id', recipientId)
        .single()

      if (data) {
        email    = email    ?? data.email
        phone    = phone    ?? data.phone
        whatsapp = whatsapp ?? data.phone
      }
    } else if (recipientType === 'vendor') {
      const { data } = await this.supabase.serviceClient
        .from('vendors')
        .select('email, phone')
        .eq('id', recipientId)
        .single()

      if (data) {
        email    = email    ?? data.email
        phone    = phone    ?? data.phone
        whatsapp = whatsapp ?? data.phone
      }
    }

    return { email, phone, whatsapp, pushToken }
  }

  private async dispatchChannel(params: {
    channel:       NotificationChannel
    tenantId:      string
    recipientId:   string
    recipientType: RecipientType
    templateKey:   string
    eventId:       string | null
    title:         string
    body:          string
    subject:       string
    actionUrl:     string | null
    contact:       { email: string | null; phone: string | null; whatsapp: string | null; pushToken: string | null }
    variables:     Record<string, string | number | boolean | null | undefined>
  }): Promise<void> {
    const { channel, tenantId, recipientId, recipientType, templateKey, eventId, title, body, subject, actionUrl, contact } = params

    let status: DeliveryStatus = 'sent'
    let errorMessage: string | null = null
    let externalId: string | null = null

    try {
      if (channel === 'in_app') {
        // Persist to notifications table via existing RPC
        const notifId = await this.send({
          tenant_id:      tenantId,
          event_id:       eventId,
          recipient_id:   recipientId,
          recipient_type: recipientType,
          module:         (TEMPLATE_CATEGORY[templateKey] as NotificationModule) ?? 'system',
          title,
          body,
          action_url:     actionUrl,
          urgency:        templateKey.includes('alert') ? 'critical' : 'info',
        })
        externalId = notifId
        status = notifId ? 'sent' : 'failed'

      } else if (channel === 'email') {
        if (!contact.email) { status = 'skipped'; return }
        await this.emailService.sendEmail({
          to:      contact.email,
          subject,
          html:    body,
          text:    body.replace(/<[^>]+>/g, ''),
        })

      } else if (channel === 'sms') {
        if (!contact.phone) { status = 'skipped'; return }
        const smsBody = body.replace(/<[^>]+>/g, '').replace(/\*([^*]+)\*/g, '$1')
        await this.smsService.sendSMS({ to: contact.phone, message: smsBody })

      } else if (channel === 'whatsapp') {
        if (!contact.whatsapp) { status = 'skipped'; return }
        const waBody = body.replace(/<[^>]+>/g, '')
        await this.whatsappService.sendMessage({ to: contact.whatsapp, message: waBody })

      } else if (channel === 'push') {
        if (!contact.pushToken) { status = 'skipped'; return }
        await this.sendExpoPush(contact.pushToken, title, body, actionUrl)
      }

    } catch (err) {
      status = 'failed'
      errorMessage = String(err)
      this.logger.error(`[${channel}] dispatch failed for ${recipientId}: ${err}`)
    } finally {
      // Always log to delivery log
      await this.logDelivery({
        tenantId,
        recipientId,
        recipientType,
        templateKey,
        eventId,
        channel,
        status,
        errorMessage,
        externalId,
      })
    }
  }

  private async sendExpoPush(
    token: string,
    title: string,
    body: string,
    actionUrl: string | null,
  ): Promise<void> {
    const plainBody = body.replace(/<[^>]+>/g, '')

    const payload = {
      to:    token,
      title,
      body:  plainBody,
      sound: 'default',
      data:  actionUrl ? { url: actionUrl } : {},
      channelId: 'default',
    }
