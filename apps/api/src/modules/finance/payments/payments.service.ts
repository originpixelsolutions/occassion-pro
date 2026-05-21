import { Injectable } from '@nestjs/common'
import { SupabaseService } from '../../../common/supabase/supabase.service'
import { NotificationsService } from '../../notifications/notifications.service'

@Injectable()
export class PaymentsService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async findAll(tenantId: string, token: string) {
    const client = this.supabase.forRequest(token)
    const { data, error } = await client.from('payments').select(`*, invoices(invoice_number), client_companies(name)`)
      .eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(50)
    if (error) throw new Error(error.message)
    return data ?? []
  }

  async record(dto: any, token: string) {
    const client = this.supabase.forRequest(token)
    const { data, error } = await client.from('payments').insert(dto).select().single()
    if (error) throw new Error(error.message)
    // Update invoice paid amount
    if (dto.invoice_id) {
      const { data: invoice } = await client.from('invoices').select('paid_amount, total').eq('id', dto.invoice_id).single()
      if (invoice) {
        const newPaidAmount = (invoice.paid_amount ?? 0) + dto.amount
        const newStatus = newPaidAmount >= invoice.total ? 'paid' : 'partially_paid'
        await client.from('invoices').update({ paid_amount: newPaidAmount, status: newStatus }).eq('id', dto.invoice_id)
      }
    }
    // Fire-and-forget: notify workspace owner of new payment
    if (dto.tenant_id) {
      this.resolveOwnerIds(dto.tenant_id).then(ownerIds => {
        const formatted = `₹${(dto.amount ?? 0).toLocaleString('en-IN')}`
        for (const ownerId of ownerIds) {
          this.notificationsService.sendNotification({
            tenantId: dto.tenant_id,
            recipientId: ownerId,
            recipientType: 'team',
            templateKey: 'payment_confirmed',
            variables: {
              amount: formatted,
              paymentId: data?.id ?? '',
              invoiceId: dto.invoice_id ?? '',
            },
            eventId: dto.event_id ?? null,
          }).catch(() => {})
        }
      }).catch(() => {})
    }
    return data
  }

  private async resolveOwnerIds(tenantId: string): Promise<string[]> {
    const { data } = await this.supabase.serviceClient
      .from('user_roles')
      .select('user_id')
      .eq('tenant_id', tenantId)
      .eq('role', 'owner')
    return (data ?? []).map((r: any) => r.user_id)
  }
}
