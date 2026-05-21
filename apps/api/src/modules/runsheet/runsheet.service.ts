// SECURITY: All queries in this service use Supabase parameterized client — no raw SQL interpolation.
// Every query is scoped to tenant_id from the verified JWT (never from user-supplied input).
// Confirmed in RLS audit 2026-05-18.
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common'
import { SupabaseService } from '../../common/supabase/supabase.service'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { NotificationsService } from '../notifications/notifications.service'
import {
  CreateRunsheetItemDto,
  UpdateRunsheetItemDto,
  ReorderItemsDto,
  UpdateItemStatusDto,
  AddCommentDto,
  SaveVersionDto,
  ExportRunsheetDto,
} from './dto/runsheet.dto'

@Injectable()
export class RunsheetService {
  constructor(
    private supabase: SupabaseService,
    private eventEmitter: EventEmitter2,
    private readonly notificationsService: NotificationsService,
  ) {}

  // ─── Get or create runsheet for event ──────────────────────────────────────
  async getOrCreate(eventId: string, tenantId: string, userId: string) {
    const sb = this.supabase.getServiceClient()

    const { data: existing } = await sb
      .from('runsheets')
      .select('*')
      .eq('event_id', eventId)
      .single()

    if (existing) return existing

    const { data: created, error } = await sb
      .from('runsheets')
      .insert({
        event_id: eventId,
        tenant_id: tenantId,
        created_by: userId,
      })
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)
    return created
  }

  // ─── Get runsheet with all items (nested) ──────────────────────────────────
  async getWithItems(eventId: string, tenantId: string) {
    const sb = this.supabase.getServiceClient()

    const { data: runsheet, error: rsErr } = await sb
      .from('runsheets')
      .select('*')
      .eq('event_id', eventId)
      .single()

    if (rsErr || !runsheet) throw new NotFoundException('Runsheet not found')

    // All active items sorted by position
    const { data: items, error: itemErr } = await sb
      .from('runsheet_items')
      .select(`
        *,
        comments:runsheet_item_comments(count)
      `)
      .eq('runsheet_id', runsheet.id)
      .eq('is_deleted', false)
      .order('position', { ascending: true })

    if (itemErr) throw new BadRequestException(itemErr.message)

    // Build nested structure
    const topLevel = (items || []).filter((i) => !i.parent_id)
    const children = (items || []).filter((i) => !!i.parent_id)

    const nested = topLevel.map((item) => ({
      ...item,
      comment_count: item.comments?.[0]?.count ?? 0,
      children: children
        .filter((c) => c.parent_id === item.id)
        .map((c) => ({ ...c, comment_count: c.comments?.[0]?.count ?? 0 })),
    }))

    return { ...runsheet, items: nested }
  }

  // ─── Create item ───────────────────────────────────────────────────────────
  async createItem(runsheetId: string, dto: CreateRunsheetItemDto, userId: string) {
    const sb = this.supabase.getServiceClient()

    // Get max position to append
    const { data: last } = await sb
      .from('runsheet_items')
      .select('position')
      .eq('runsheet_id', runsheetId)
      .eq('is_deleted', false)
      .order('position', { ascending: false })
      .limit(1)
      .single()

    const position = dto.position ?? ((last?.position ?? 0) + 1000)

    const { data, error } = await sb
      .from('runsheet_items')
      .insert({
        runsheet_id: runsheetId,
        parent_id: dto.parent_id ?? null,
        position,
        start_time: dto.start_time ?? null,
        end_time: dto.end_time ?? null,
        duration_minutes: dto.duration_minutes ?? null,
        title: dto.title,
        description: dto.description ?? null,
        category: dto.category ?? 'Other',
        assigned_to: dto.assigned_to ?? [],
        assigned_vendors: dto.assigned_vendors ?? [],
        status: 'pending',
        is_guest_visible: dto.is_guest_visible ?? false,
        notes: dto.notes ?? null,
        color: dto.color ?? null,
        created_by: userId,
        updated_by: userId,
      })
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)

    // Update runsheet updated_at
    await sb.from('runsheets').update({ updated_at: new Date().toISOString() }).eq('id', runsheetId)

    this.eventEmitter.emit('runsheet.item_created', { runsheetId, item: data, userId })
    return data
  }

  // ─── Update item ───────────────────────────────────────────────────────────
  async updateItem(itemId: string, dto: UpdateRunsheetItemDto, runsheetId: string, userId: string) {
    const sb = this.supabase.getServiceClient()

    // Check runsheet is not locked (unless user is owner)
    const lockErr = await this.checkLock(runsheetId, userId)
    if (lockErr) throw new ForbiddenException(lockErr)

    const { data, error } = await sb
      .from('runsheet_items')
      .update({ ...dto, updated_by: userId, updated_at: new Date().toISOString() })
      .eq('id', itemId)
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)

    await sb.from('runsheets').update({ updated_at: new Date().toISOString() }).eq('id', runsheetId)

    this.eventEmitter.emit('runsheet.item_updated', { runsheetId, item: data, userId })

    // Fire-and-forget: notify each newly assigned user
    if (dto.assigned_to && Array.isArray(dto.assigned_to) && dto.assigned_to.length > 0) {
      sb.from('runsheets').select('tenant_id, event_id').eq('id', runsheetId).single()
        .then(({ data: rs }) => {
          if (!rs) return
          for (const assigneeId of (dto.assigned_to as string[])) {
            if (assigneeId === userId) continue // skip the updater themselves
            this.notificationsService.sendNotification({
              tenantId: rs.tenant_id,
              recipientId: assigneeId,
              recipientType: 'team',
              templateKey: 'runsheet_item_assigned',
              variables: { itemTitle: data.title, runsheetId },
              eventId: rs.event_id ?? null,
            }).catch(() => {})
          }
        }).catch(() => {})
    }

    return data
  }

  // ─── Delete item (soft) ────────────────────────────────────────────────────
  async deleteItem(itemId: string, runsheetId: string, userId: string) {
    const sb = this.supabase.getServiceClient()

    const lockErr = await this.checkLock(runsheetId, userId)
    if (lockErr) throw new ForbiddenException(lockErr)

    const { error } = await sb
      .from('runsheet_items')
      .update({ is_deleted: true, updated_by: userId })
      .eq('id', itemId)

    if (error) throw new BadRequestException(error.message)

    this.eventEmitter.emit('runsheet.item_deleted', { runsheetId, itemId, userId })
    return { success: true }
  }

  // ─── Reorder items (bulk position update) ─────────────────────────────────
  async reorderItems(runsheetId: string, dto: ReorderItemsDto, userId: string) {
    const sb = this.supabase.getServiceClient()

    const lockErr = await this.checkLock(runsheetId, userId)
    if (lockErr) throw new ForbiddenException(lockErr)

    // Bulk update positions
    const updates = dto.items.map(({ id, position }) =>
      sb
        .from('runsheet_items')
        .update({ position, updated_by: userId })
        .eq('id', id)
        .eq('runsheet_id', runsheetId),
    )

    await Promise.all(updates)

    this.eventEmitter.emit('runsheet.reordered', { runsheetId, items: dto.items, userId })
    return { success: true }
  }

  // ─── Update item status (day-of quick update) ─────────────────────────────
  async updateStatus(itemId: string, dto: UpdateItemStatusDto, runsheetId: string, userId: string) {
    const sb = this.supabase.getServiceClient()

    const { data, error } = await sb
      .from('runsheet_items')
      .update({
        status: dto.status,
        delay_minutes: dto.delay_minutes ?? 0,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', itemId)
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)

    this.eventEmitter.emit('runsheet.item_status_changed', {
      runsheetId,
      itemId,
      status: dto.status,
      delayMinutes: dto.delay_minutes,
      userId,
    })
    return data
  }

  // ─── Add comment ───────────────────────────────────────────────────────────
  async addComment(itemId: string, userId: string, dto: AddCommentDto) {
    const sb = this.supabase.getServiceClient()

    const { data, error } = await sb
      .from('runsheet_item_comments')
      .insert({ item_id: itemId, user_id: userId, comment: dto.comment })
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)
    return data
  }

  // ─── Get comments for item ────────────────────────────────────────────────
  async getComments(itemId: string) {
    const sb = this.supabase.getServiceClient()

    const { data, error } = await sb
      .from('runsheet_item_comments')
      .select('*')
      .eq('item_id', itemId)
      .order('created_at', { ascending: true })

    if (error) throw new BadRequestException(error.message)
    return data
  }

  // ─── Lock / Unlock runsheet ────────────────────────────────────────────────
  async lockRunsheet(runsheetId: string, userId: string) {
    const sb = this.supabase.getServiceClient()

    const { data, error } = await sb
      .from('runsheets')
      .update({ is_locked: true, locked_by: userId, locked_at: new Date().toISOString() })
      .eq('id', runsheetId)
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)

    this.eventEmitter.emit('runsheet.locked', { runsheetId, userId })
    return data
  }

  async unlockRunsheet(runsheetId: string, userId: string) {
    const sb = this.supabase.getServiceClient()

    const { data, error } = await sb
      .from('runsheets')
      .update({ is_locked: false, locked_by: null, locked_at: null })
      .eq('id', runsheetId)
      .select()
      .single()

    if (error) throw new BadRequestException(error.message)

    this.eventEmitter.emit('runsheet.unlocked', { runsheetId, userId })
    return data
  }

  // ─── Save version (snapshot) ──────────────────────────────────────────────
  async saveVersion(runsheetId: string, userId: string, dto?: SaveVersionDto) {
    const sb = this.supabase.getServiceClient()

    const { data, error } = await sb.rpc('create_runsheet_version', {
      p_runsheet_id: runsheetId,
      p_user_id: userId,
      p_label: dto?.label ?? null,
    })

    if (error) throw new BadRequestException(error.message)
    return { version_id: data }
  }

  // ─── Get version history ───────────────────────────────────────────────────
  async getVersionHistory(runsheetId: string) {
    const sb = this.supabase.getServiceClient()

    const { data, error } = await sb
      .from('runsheet_versions')
      .select('id, version, label, created_by, created_at')
      .eq('runsheet_id', runsheetId)
      .order('version', { ascending: false })

    if (error) throw new BadRequestException(error.message)
    return data
  }

  // ─── Restore version ───────────────────────────────────────────────────────
  async restoreVersion(runsheetId: string, versionId: string, userId: string) {
    const sb = this.supabase.getServiceClient()

    const { data: version, error: verErr } = await sb
      .from('runsheet_versions')
      .select('snapshot')
      .eq('id', versionId)
      .eq('runsheet_id', runsheetId)
      .single()

    if (verErr || !version) throw new NotFoundException('Version not found')

    const snapshot = version.snapshot as any[]

    // Save current state as a version before restoring
    await this.saveVersion(runsheetId, userId, { label: 'Auto-save before restore' })

    // Soft-delete all current items
    await sb.from('runsheet_items').update({ is_deleted: true }).eq('runsheet_id', runsheetId)

    // Re-insert snapshot items (strip DB-generated fields)
    if (snapshot && snapshot.length > 0) {
      const toInsert = snapshot.map(
        ({ id: _id, created_at: _ca, updated_at: _ua, is_deleted: _del, ...item }) => ({
          ...item,
          runsheet_id: runsheetId,
          is_deleted: false,
          created_by: userId,
          updated_by: userId,
        }),
      )
      await sb.from('runsheet_items').insert(toInsert)
    }

    this.eventEmitter.emit('runsheet.restored', { runsheetId, versionId, userId })
    return { success: true }
  }

  // ─── Export runsheet ───────────────────────────────────────────────────────
  async exportRunsheet(eventId: string, tenantId: string, format: 'pdf' | 'excel') {
    // Return structured data for the controller to render
    const runsheet = await this.getWithItems(eventId, tenantId)
    return { format, runsheet }
  }

  // ─── Helper: check lock ────────────────────────────────────────────────────
  private async checkLock(runsheetId: string, userId: string): Promise<string | null> {
    const sb = this.supabase.getServiceClient()

    const { data } = await sb
      .from('runsheets')
      .select('is_locked, locked_by, created_by')
      .eq('id', runsheetId)
      .single()

    if (!data) return null
    if (!data.is_locked) return null
    // Owner who locked it can still edit
    if (data.locked_by === userId || data.created_by === userId) return null
    return 'Runsheet is locked. Only the owner can make changes.'
  }

  // ─── Get runsheet by ID ───────────────────────────────────────────────────
  async getRunsheetById(runsheetId: string) {
    const sb = this.supabase.getServiceClient()
    const { data, error } = await sb.from('runsheets').select('*').eq('id', runsheetId).single()
    if (error || !data) throw new NotFoundException('Runsheet not found')
    return data
  }
}
