import { Injectable, NotFoundException } from '@nestjs/common'
import { SupabaseService } from '../../../common/supabase/supabase.service'
import { RazorpayService } from '../razorpay/razorpay.service'
import { ConfigService } from '@nestjs/config'
import { NotificationsService } from '../../notifications/notifications.service'

@Injectable()
export class InvoicesService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly razorpay: RazorpayService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
  ) {}

  async findAll(tenantId: string, token: string, options: any = {}) {
    const { page = 1, pageSize = 25, status } = options
    const from = (page - 1) * pageSize
    const client = this.supabase.forRequest(token)
    let query = client
      .from('invoices')
      .select(`*, client_companies(id, name), events(id, name)`, { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('issue_date', { ascending: false })
      .range(from, from + pageSize - 1)
    if (status) query = query.eq('status', status)
    const { data, count, error } = await query
    if (error) throw new Error(error.message)
    return { data: data ?? [], count: count ?? 0, page, pageSize, totalPages: Math.ceil((count ?? 0) / pageSize) }
  }

  async create(dto: any, token: string) {
    const client = this.supabase.forRequest(token)
    const { data, error } = await client.from('invoices').insert(dto).select().single()
    if (error) throw new Error(error.message)

    // Fire-and-forget invoice creation notification to the tenant's finance team
    if (data && dto.tenant_id) {
      this.notifications.sendNotification({
        tenantId:      dto.tenant_id,
        recipientType: 'team',
        recipientId:   dto.created_by ?? dto.tenant_id,
        templateKey:   'invoice_created',
        variables: {
          event_name: data.invoice_number ?? data.id,
          event_start: new Date(data.issue_date ?? Date.now()).toLocaleDateString('en-IN'),
        },
        eventId: dto.event_id ?? null,
      }).catch(() => undefined) // Never let notification errors block invoice creation
    }

    return data
  }

  async sendPaymentLink(id: string, tenantId: string, token: string) {
    const client = this.supabase.forRequest(token)
    const { data: invoice } = await client
      .from('invoices')
      .select(`*, client_companies(name), contacts(full_name, email, phone)`)
      .eq('id', id).eq('tenant_id', tenantId).single()
    if (!invoice) throw new NotFoundException(`Invoice ${id} not found`)

    const domain = this.config.get<string>('app.domain', 'occasionpro.in')
    const link = await this.razorpay.createPaymentLink({
      amount: invoice.balance_due,
      currency: invoice.currency,
      description: `Invoice ${invoice.invoice_number}`,
      customerName: invoice.contacts?.full_name ?? invoice.client_companies?.name ?? 'Client',
      customerEmail: invoice.contacts?.email ?? '',
      callbackUrl: `https://${domain}/client/invoices/${id}/success`,
      referenceId: invoice.invoice_number,
    })

    await this.supabase.serviceClient
      .from('invoices')
      .update({ razorpay_payment_link_id: link.id, razorpay_payment_link_url: link.short_url, status: 'sent' })
      .eq('id', id)

    return { paymentLink: link.short_url }
  }

  async findOne(id: string, token: string) {
    const client = this.supabase.forRequest(token)
    const { data, error } = await client
      .from('invoices')
      .select('*')
      .eq('id', id)
      .single()
    if (error) throw new Error(error.message)
    return data
  }

  async update(id: string, dto: any, token: string) {
    const client = this.supabase.forRequest(token)
    const { data, error } = await client
      .from('invoices')
      .update({ ...dto, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return data
  }

  async remove(id: string, token: string) {
    const client = this.supabase.forRequest(token)
    const { error } = await client.from('invoices').delete().eq('id', id)
    if (error) throw new Error(error.message)
  }
}
