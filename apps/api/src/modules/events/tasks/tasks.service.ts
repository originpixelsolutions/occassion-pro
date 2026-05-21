import { Injectable, NotFoundException } from '@nestjs/common'
import { SupabaseService } from '../../../common/supabase/supabase.service'

@Injectable()
export class TasksService {
  constructor(private readonly supabase: SupabaseService) {}

  async findByEvent(eventId: string, tenantId: string, token: string) {
    const client = this.supabase.forRequest(token)
    const { data, error } = await client
      .from('event_tasks')
      .select(`
        *,
        assignee:profiles!event_tasks_assigned_to_fkey(id, full_name, avatar_url),
        subtasks:event_tasks!event_tasks_parent_task_id_fkey(id, title, status, priority)
      `)
      .eq('event_id', eventId)
      .eq('tenant_id', tenantId)
      .is('parent_task_id', null)
      .order('priority', { ascending: false })
      .order('due_date', { ascending: true })

    if (error) throw new Error(error.message)
    return data ?? []
  }

  async create(dto: any, token: string) {
    const client = this.supabase.forRequest(token)
    const { data, error } = await client
      .from('event_tasks')
      .insert(dto)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data
  }

  async updateStatus(id: string, tenantId: string, status: string, token: string) {
    const client = this.supabase.forRequest(token)
    const update: any = {
      status,
      updated_at: new Date().toISOString(),
    }
    if (status === 'completed') update.completed_at = new Date().toISOString()

    const { data, error } = await client
      .from('event_tasks')
      .update(update)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single()

    if (error || !data) throw new NotFoundException(`Task ${id} not found`)
    return data
  }

  async bulkCreate(tasks: any[], token: string) {
    const client = this.supabase.forRequest(token)
    const { data, error } = await client
      .from('event_tasks')
      .insert(tasks)
      .select()
    if (error) throw new Error(error.message)
    return data ?? []
  }
}
