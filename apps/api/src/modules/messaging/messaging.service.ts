import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common'
import { SupabaseService } from '../../common/supabase/supabase.service'

@Injectable()
export class MessagingService {
  constructor(private readonly supabase: SupabaseService) {}

  private db(token: string) {
    return this.supabase.getAuthenticatedClient(token)
  }

  // ── Threads ──────────────────────────────────────────────────────────────

  async listThreads(tenantId: string, token: string, eventId?: string, type?: string) {
    let q = this.db(token)
      .from('message_threads')
      .select('*, message_count:event_messages(count), created_by_profile:profiles!created_by(id,full_name,avatar_url)')
      .eq('tenant_id', tenantId)
      .order('last_message_at', { ascending: false })

    if (eventId) q = q.eq('event_id', eventId)
    if (type)    q = q.eq('thread_type', type)

    const { data, error } = await q
    if (error) throw new BadRequestException(error.message)
    return data ?? []
  }

  async getThread(id: string, tenantId: string, token: string) {
    const { data, error } = await this.db(token)
      .from('message_threads')
      .select('*, created_by_profile:profiles!created_by(id,full_name,avatar_url)')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single()
    if (error) throw new NotFoundException('Thread not found')
    return data
  }

  async createThread(tenantId: string, token: string, body: {
    event_id?: string
    subject: string
    thread_type?: string
    participants?: string[]
    initial_message?: string
    created_by?: string
  }) {
    const db = this.db(token)
    const { data: thread, error } = await db
      .from('message_threads')
      .insert({
        tenant_id: tenantId,
        event_id: body.event_id,
        subject: body.subject,
        thread_type: body.thread_type ?? 'internal',
        participants: body.participants ?? [],
        created_by: body.created_by,
        last_message_at: new Date().toISOString(),
      })
      .select()
      .single()
    if (error) throw new BadRequestException(error.message)

    if (body.initial_message) {
      await db.from('event_messages').insert({
        thread_id: thread.id,
        tenant_id: tenantId,
        event_id: body.event_id,
        sender_id: body.created_by,
        message: body.initial_message,
        message_type: 'text',
      })
    }
    return thread
  }

  async updateThread(id: string, tenantId: string, token: string, body: {
    subject?: string
    status?: string
    participants?: string[]
  }) {
    const { data, error } = await this.db(token)
      .from('message_threads')
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  async deleteThread(id: string, tenantId: string, token: string) {
    const { error } = await this.db(token)
      .from('message_threads')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId)
    if (error) throw new BadRequestException(error.message)
    return { deleted: true }
  }

  // ── Messages ─────────────────────────────────────────────────────────────

  async getMessages(threadId: string, tenantId: string, token: string, limit = 50, before?: string) {
    let q = this.db(token)
      .from('event_messages')
      .select('*, sender:profiles!sender_id(id,full_name,avatar_url)')
      .eq('thread_id', threadId)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (before) q = q.lt('created_at', before)

    const { data, error } = await q
    if (error) throw new BadRequestException(error.message)
    return (data ?? []).reverse()
  }

  async sendMessage(threadId: string, tenantId: string, token: string, body: {
    sender_id?: string
    sender_name?: string
    message: string
    message_type?: string
    attachments?: any[]
    reply_to_id?: string
    event_id?: string
  }) {
    const { data, error } = await this.db(token)
      .from('event_messages')
      .insert({
        thread_id: threadId,
        tenant_id: tenantId,
        event_id: body.event_id,
        sender_id: body.sender_id,
        sender_name: body.sender_name,
        message: body.message,
        message_type: body.message_type ?? 'text',
        attachments: body.attachments ?? [],
        reply_to_id: body.reply_to_id,
      })
      .select('*, sender:profiles!sender_id(id,full_name,avatar_url)')
      .single()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  async markRead(threadId: string, profileId: string, tenantId: string, token: string) {
    // Mark all unread messages in thread as read by this profile
    const { data: msgs } = await this.db(token)
      .from('event_messages')
      .select('id, is_read_by')
      .eq('thread_id', threadId)
      .eq('tenant_id', tenantId)

    if (!msgs?.length) return { marked: 0 }

    const updates = msgs
      .filter(m => !m.is_read_by?.includes(profileId))
      .map(m => ({
        id: m.id,
        is_read_by: [...(m.is_read_by ?? []), profileId],
      }))

    if (!updates.length) return { marked: 0 }

    const { error } = await this.db(token)
      .from('event_messages')
      .upsert(updates, { onConflict: 'id' })
    if (error) throw new BadRequestException(error.message)
    return { marked: updates.length }
  }

  async deleteMessage(id: string, tenantId: string, token: string) {
    const { error } = await this.db(token)
      .from('event_messages')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId)
    if (error) throw new BadRequestException(error.message)
    return { deleted: true }
  }

  // ── Broadcasts ───────────────────────────────────────────────────────────

  async listBroadcasts(tenantId: string, token: string, eventId?: string) {
    let q = this.db(token)
      .from('broadcast_messages')
      .select('*, created_by_profile:profiles!created_by(id,full_name,avatar_url)')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })

    if (eventId) q = q.eq('event_id', eventId)

    const { data, error } = await q
    if (error) throw new BadRequestException(error.message)
    return data ?? []
  }

  async createBroadcast(tenantId: string, token: string, body: {
    event_id?: string
    title: string
    message: string
    audience: string
    audience_filter?: any
    channels?: string[]
    scheduled_at?: string
    created_by?: string
  }) {
    const { data, error } = await this.db(token)
      .from('broadcast_messages')
      .insert({
        tenant_id: tenantId,
        event_id: body.event_id,
        title: body.title,
        message: body.message,
        audience: body.audience,
        audience_filter: body.audience_filter ?? {},
        channels: body.channels ?? ['in_app'],
        status: body.scheduled_at ? 'scheduled' : 'draft',
        scheduled_at: body.scheduled_at,
        created_by: body.created_by,
      })
      .select()
      .single()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  async sendBroadcast(id: string, tenantId: string, token: string) {
    const { data, error } = await this.db(token)
      .from('broadcast_messages')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  async deleteBroadcast(id: string, tenantId: string, token: string) {
    const { error } = await this.db(token)
      .from('broadcast_messages')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId)
    if (error) throw new BadRequestException(error.message)
    return { deleted: true }
  }

  // ── Announcements ─────────────────────────────────────────────────────────

  async listAnnouncements(tenantId: string, token: string, eventId?: string) {
    let q = this.db(token)
      .from('event_announcements')
      .select('*, created_by_profile:profiles!created_by(id,full_name,avatar_url)')
      .eq('tenant_id', tenantId)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })

    if (eventId) q = q.eq('event_id', eventId)

    const { data, error } = await q
    if (error) throw new BadRequestException(error.message)
    return data ?? []
  }

  async createAnnouncement(tenantId: string, token: string, body: {
    event_id: string
    title: string
    body: string
    priority?: string
    is_pinned?: boolean
    expires_at?: string
    created_by?: string
  }) {
    const { data, error } = await this.db(token)
      .from('event_announcements')
      .insert({
        tenant_id: tenantId,
        event_id: body.event_id,
        title: body.title,
        body: body.body,
        priority: body.priority ?? 'normal',
        is_pinned: body.is_pinned ?? false,
        expires_at: body.expires_at,
        created_by: body.created_by,
      })
      .select()
      .single()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  async updateAnnouncement(id: string, tenantId: string, token: string, body: {
    title?: string; body?: string; priority?: string; is_pinned?: boolean; expires_at?: string
  }) {
    const { data, error } = await this.db(token)
      .from('event_announcements')
      .update(body)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  async deleteAnnouncement(id: string, tenantId: string, token: string) {
    const { error } = await this.db(token)
      .from('event_announcements')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId)
    if (error) throw new BadRequestException(error.message)
    return { deleted: true }
  }

  // ── Unread count ──────────────────────────────────────────────────────────

  async getUnreadCount(profileId: string, tenantId: string, token: string, eventId?: string) {
    let q = this.db(token)
      .from('event_messages')
      .select('id, is_read_by', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .not('sender_id', 'eq', profileId)

    if (eventId) q = q.eq('event_id', eventId)

    const { data, error } = await q
    if (error) throw new BadRequestException(error.message)

    const unread = (data ?? []).filter(m => !m.is_read_by?.includes(profileId)).length
    return { unread }
  }
}
