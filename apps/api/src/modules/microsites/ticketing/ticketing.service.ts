import { Injectable } from '@nestjs/common'
import { SupabaseService } from '../../../common/supabase/supabase.service'
import { RazorpayService } from '../../finance/razorpay/razorpay.service'

@Injectable()
export class TicketingService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly razorpay: RazorpayService,
  ) {}

  async initiateTicketPurchase(dto: {
    microsite_id: string
    tier_id: string
    quantity: number
    attendee_name: string
    attendee_email: string
    attendee_phone?: string
    tenant_id: string
  }) {
    const client = this.supabase.serviceClient

    // Get tier details
    const { data: tier, error: tierErr } = await client
      .from('ticket_tiers')
      .select('*, microsites(event_id, tenants(name))')
      .eq('id', dto.tier_id)
      .single()
    if (tierErr) throw new Error('Ticket tier not found')

    // Check availability
    if (tier.quantity_sold + dto.quantity > tier.quantity_total) {
      throw new Error('Not enough tickets available')
    }

    const totalAmount = tier.price * dto.quantity * 100 // paise

    // Create Razorpay order
    const order = await this.razorpay.createOrder({
      amount: totalAmount,
      currency: 'INR',
      receipt: `ticket_${dto.tier_id}_${Date.now()}`,
      notes: {
        microsite_id: dto.microsite_id,
        tier_id: dto.tier_id,
        quantity: String(dto.quantity),
        attendee_email: dto.attendee_email,
      },
    })

    // Create pending ticket record
    const { data: ticket, error } = await client
      .from('tickets')
      .insert({
        microsite_id: dto.microsite_id,
        tier_id: dto.tier_id,
        tenant_id: dto.tenant_id,
        attendee_name: dto.attendee_name,
        attendee_email: dto.attendee_email,
        attendee_phone: dto.attendee_phone,
        quantity: dto.quantity,
        total_amount: tier.price * dto.quantity,
        status: 'pending',
        payment_order_id: order.id,
      })
      .select()
      .single()
    if (error) throw new Error(error.message)

    return {
      ticket_id: ticket.id,
      order_id: order.id,
      amount: totalAmount,
      currency: 'INR',
      key_id: process.env.RAZORPAY_KEY_ID,
    }
  }

  async confirmTicketPayment(ticketId: string, paymentId: string, signature: string) {
    const client = this.supabase.serviceClient

    const { data: ticket, error: fetchErr } = await client
      .from('tickets')
      .select('*')
      .eq('id', ticketId)
      .single()
    if (fetchErr) throw new Error('Ticket not found')

    // Verify signature
    const isValid = this.razorpay.verifyWebhookSignature(
      `${ticket.payment_order_id}|${paymentId}`,
      signature,
      process.env.RAZORPAY_KEY_SECRET!,
    )
    if (!isValid) throw new Error('Invalid payment signature')

    // Update ticket status
    const { data, error } = await client
      .from('tickets')
      .update({
        status: 'confirmed',
        payment_id: paymentId,
        confirmed_at: new Date().toISOString(),
        qr_code: await this.generateTicketQr(ticketId),
      })
      .eq('id', ticketId)
      .select()
      .single()
    if (error) throw new Error(error.message)

    // Sold count is updated by DB trigger increment_ticket_sold_count — no explicit call needed

    return data
  }

  async getEventTickets(eventId: string, tenantId: string, token: string) {
    const client = this.supabase.forRequest(token)
    const { data, error } = await client
      .from('tickets')
      .select(`*, ticket_tiers(name, price)`)
      .eq('tenant_id', tenantId)
      .in(
        'microsite_id',
        (
          await client
            .from('microsites')
            .select('id')
            .eq('event_id', eventId)
            .eq('tenant_id', tenantId)
        ).data?.map((m: any) => m.id) ?? [],
      )
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return data ?? []
  }

  async getTicketByQr(qrCode: string) {
    const client = this.supabase.serviceClient
    const { data, error } = await client
      .from('tickets')
      .select(`*, ticket_tiers(name, microsites(events(name, start_date)))`)
      .eq('qr_code', qrCode)
      .single()
    if (error) throw new Error('Ticket not found')
    return data
  }

  private async generateTicketQr(ticketId: string): Promise<string> {
    // Returns a unique QR string — actual QR image rendered client-side
    return `TICKET:${ticketId}:${Date.now()}`
  }
}
