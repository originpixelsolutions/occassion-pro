import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common'
import { SupabaseService } from '../../common/supabase/supabase.service'

@Injectable()
export class DocumentsService {
  constructor(private readonly supabase: SupabaseService) {}

  private db(token: string) {
    return this.supabase.getAuthenticatedClient(token)
  }

  async listDocuments(eventId: string, tenantId: string, token: string, opts: {
    folder?: string; type?: string; visibility?: string
  } = {}) {
    let q = this.db(token)
      .from('event_documents')
      .select('*, uploaded_by_profile:profiles!uploaded_by(id,full_name,avatar_url)')
      .eq('event_id', eventId)
      .eq('tenant_id', tenantId)
      .eq('is_latest', true)
      .order('folder_path')
      .order('created_at', { ascending: false })

    if (opts.folder)     q = q.eq('folder_path', opts.folder)
    if (opts.type)       q = q.eq('document_type', opts.type)
    if (opts.visibility) q = q.eq('visibility', opts.visibility)

    const { data, error } = await q
    if (error) throw new BadRequestException(error.message)
    return data ?? []
  }

  async getDocument(id: string, tenantId: string, token: string) {
    const { data, error } = await this.db(token)
      .from('event_documents')
      .select('*, uploaded_by_profile:profiles!uploaded_by(id,full_name,avatar_url)')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single()
    if (error) throw new NotFoundException('Document not found')
    return data
  }

  async createDocument(tenantId: string, token: string, body: any) {
    const { data, error } = await this.db(token)
      .from('event_documents')
      .insert({
        tenant_id: tenantId,
        event_id: body.event_id,
        folder_path: body.folder_path ?? '/',
        document_name: body.document_name,
        document_type: body.document_type ?? 'other',
        storage_type: body.storage_type ?? 'upload',
        file_url: body.file_url,
        file_name: body.file_name,
        file_size: body.file_size,
        mime_type: body.mime_type,
        version: 1,
        version_notes: body.version_notes,
        is_latest: true,
        visibility: body.visibility ?? 'team',
        requires_approval: body.requires_approval ?? false,
        approval_status: body.requires_approval ? 'pending' : 'not_required',
        description: body.description,
        tags: body.tags ?? [],
        uploaded_by: body.uploaded_by,
      })
      .select()
      .single()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  async uploadNewVersion(id: string, tenantId: string, token: string, body: any) {
    const db = this.db(token)
    const { data: current, error: fetchErr } = await db
      .from('event_documents')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single()
    if (fetchErr) throw new NotFoundException('Document not found')

    await db.from('event_documents').update({ is_latest: false }).eq('id', id)

    const { data, error } = await db
      .from('event_documents')
      .insert({
        ...current,
        id: undefined,
        file_url: body.file_url,
        file_name: body.file_name ?? current.file_name,
        file_size: body.file_size,
        version: current.version + 1,
        version_notes: body.version_notes,
        parent_id: id,
        is_latest: true,
        approval_status: current.requires_approval ? 'pending' : 'not_required',
        uploaded_by: body.uploaded_by,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  async updateDocument(id: string, tenantId: string, token: string, body: any) {
    const { data, error } = await this.db(token)
      .from('event_documents')
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  async approveDocument(id: string, tenantId: string, token: string, body: { status: string; approved_by?: string }) {
    const { data, error } = await this.db(token)
      .from('event_documents')
      .update({
        approval_status: body.status,
        approved_by: body.approved_by,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  async deleteDocument(id: string, tenantId: string, token: string) {
    const { error } = await this.db(token)
      .from('event_documents')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId)
    if (error) throw new BadRequestException(error.message)
    return { deleted: true }
  }

  async getStats(eventId: string, tenantId: string, token: string) {
    const { data } = await this.db(token)
      .from('event_documents')
      .select('document_type, approval_status, storage_type')
      .eq('event_id', eventId)
      .eq('tenant_id', tenantId)
      .eq('is_latest', true)
    const docs = data ?? []
    return {
      total: docs.length,
      pending_approval: docs.filter((d: any) => d.approval_status === 'pending').length,
      uploads: docs.filter((d: any) => d.storage_type === 'upload').length,
      links: docs.filter((d: any) => d.storage_type === 'link').length,
    }
  }
}
