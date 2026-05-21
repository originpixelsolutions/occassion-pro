import * as crypto from 'crypto'
import {
  Injectable, BadRequestException, NotFoundException,
  UnauthorizedException, ConflictException,
} from '@nestjs/common'
import { SupabaseClient, createClient } from '@supabase/supabase-js'
import { RazorpayProvider }  from './providers/razorpay.provider'
import { StripeProvider }    from './providers/stripe.provider'
import { CashfreeProvider }  from './providers/cashfree.provider'
import { PayuProvider }      from './providers/payu.provider'
import { InstamojoProvider } from './providers/instamojo.provider'
import { ManualProvider }    from './providers/manual.provider'
import { ITenantPaymentProvider } from './providers/provider.interface'

const ALGO = 'aes-256-gcm'
const ENC_KEY = Buffer.from(process.env.GATEWAY_ENCRYPTION_KEY ?? '0'.repeat(64), 'hex') // 32 bytes

function encrypt(plain: string): string {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(ALGO, ENC_KEY, iv)
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`
}

function decrypt(ciphertext: string): string {
  const [ivHex, tagHex, encHex] = ciphertext.split(':')
  const iv  = Buffer.from(ivHex, 'hex')
  const tag = Buffer.from(tagHex, 'hex')
  const enc = Buffer.from(encHex, 'hex')
  const decipher = crypto.createDecipheriv(ALGO, ENC_KEY, iv)
  decipher.setAuthTag(tag)
  return decipher.update(enc).toString('utf8') + decipher.final('utf8')
}

function nanoid(len = 12) {
  return crypto.randomBytes(len).toString('base64url').slice(0, len).toUpperCase()
}

function db(token: string): SupabaseClient {
  return createClient(process.env.SUPABASE_URL!, token)
}

@Injectable()
export class TenantPaymentsService {
  private readonly providers: Record<string, ITenantPaymentProvider> = {
    razorpay:  new RazorpayProvider(),
    stripe:    new StripeProvider(),
    cashfree:  new CashfreeProvider(),
    payumoney: new PayuProvider(),
    instamojo: new InstamojoProvider(),
    manual:    new ManualProvider(),
  }

  private getProvider(name: string): ITenantPaymentProvider {
    const p = this.providers[name]
    if (!p) throw new BadRequestException(`Unsupported provider: ${name}`)
    return p
  }

  // ── Gateway Config CRUD ──────────────────────────────────────────────────────

  async listGateways(tenantId: string, token: string) {
    const { data, error } = await db(token)
      .from('tenant_payment_gateways')
      .select('id, provider, display_name, is_active, is_default, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at')
    if (error) throw new BadRequestException(error.message)
    return data
  }

  async upsertGateway(tenantId: string, dto: any, token: string) {
    const encryptedConfig = encrypt(JSON.stringify(dto.config))
    const encryptedSecret = dto.webhook_secret ? encrypt(dto.webhook_secret) : null
    if (dto.is_default) {
      await db(token)
        .from('tenant_payment_gateways')
        .update({ is_default: false })
        .eq('tenant_id', tenantId)
    }
    const { data, error } = await db(token)
      .from('tenant_payment_gateways')
      .upsert({
        tenant_id: tenantId,
        provider: dto.provider,
        display_name: dto.display_name,
        config: encryptedConfig,
        webhook_secret: encryptedSecret,
        is_active: dto.is_active ?? true,
        is_default: dto.is_default ?? false,
      }, { onConflict: 'tenant_id,provider' })
      .select('id, provider, display_name, is_active, is_default')
      .single()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  async deleteGateway(gatewayId: string, tenantId: string, token: string) {
    const { error } = await db(token)
      .from('tenant_payment_gateways')
      .delete()
      .eq('id', gatewayId)
      .eq('tenant_id', tenantId)
    if (error) throw new BadRequestException(error.message)
  }

  async testGateway(gatewayId: string, tenantId: string, token: string) {
    const gw = await this.loadGateway(gatewayId, tenantId, token)
    const config = JSON.parse(decrypt(gw.config)) as Record<string, string>
    try {
      await this.getProvider(gw.provider).createOrder({
        orderRef: `TEST-${nanoid()}`,
        amount: 100,
        currency: 'INR',
        description: 'Gateway test',
        guestName: 'Test User',
        guestEmail: 'test@occasionpro.app',
      }, config)
      return { success: true, provider: gw.provider }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  }

  // ── Event Payment Settings ────────────────────────────────────────────────────

  async getPaymentSettings(eventId: string, tenantId: string, token: string) {
    const { data } = await db(token)
      .from('event_payment_settings')
      .select('*')
      .eq('event_id', eventId)
      .eq('tenant_id', tenantId)
      .maybeSingle()
    return data
  }

  async upsertPaymentSettings(eventId: string, tenantId: string, dto: any, token: string) {
    const { data, error } = await db(token)
      .from('event_payment_settings')
      .upsert({ ...dto, event_id: eventId, tenant_id: tenantId }, { onConflict: 'event_id' })
      .select()
      .single()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  // ── Ticket Types ─────────────────────────────────────────────────────────────

  async listTicketTypes(eventId: string, tenantId: string, token: string) {
    const { data, error } = await db(token)
      .from('event_ticket_types')
      .select('*')
      .eq('event_id', eventId)
      .eq('tenant_id', tenantId)
      .order('sort_order')
    if (error) throw new BadRequestException(error.message)
    return data
  }

  async createTicketType(eventId: string, tenantId: string, dto: any, token: string) {
    const { data, error } = await db(token)
      .from('event_ticket_types')
      .insert({ ...dto, event_id: eventId, tenant_id: tenantId })
      .select()
      .single()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  async updateTicketType(ticketTypeId: string, tenantId: string, dto: any, token: string) {
    const { data, error } = await db(token)
      .from('event_ticket_types')
      .update(dto)
      .eq('id', ticketTypeId)
      .eq('tenant_id', tenantId)
      .select()
      .single()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  async deleteTicketType(ticketTypeId: string, tenantId: string, token: string) {
    const { count } = await db(token)
      .from('event_payment_orders')
      .select('id', { count: 'exact', head: true })
      .contains('line_items', JSON.stringify([{ ticket_type_id: ticketTypeId }]))
    if ((count ?? 0) > 0) throw new ConflictException('Ticket type has existing orders')
    await db(token).from('event_ticket_types').delete().eq('id', ticketTypeId).eq('tenant_id', tenantId)
  }

  async reorderTicketTypes(eventId: string, tenantId: string, orderedIds: string[], token: string) {
    const updates = orderedIds.map((id, i) =>
      db(token).from('event_ticket_types').update({ sort_order: i }).eq('id', id).eq('tenant_id', tenantId),
    )
    await Promise.all(updates)
    return this.listTicketTypes(eventId, tenantId, token)
  }

  // ── Order Creation ────────────────────────────────────────────────────────────

  async createOrder(eventId: string, tenantId: string, dto: any, token: string) {
    const settings = await this.getPaymentSettings(eventId, tenantId, token)
    if (!settings?.is_payments_enabled) throw new BadRequestException('Payments not enabled for this event')
    const gw = await this.loadGateway(settings.gateway_id, tenantId, token)
    const config = JSON.parse(decrypt(gw.config)) as Record<string, string>

    // Inventory check + line items
    let subtotal = 0
    const lineItems: any[] = []
    for (const item of dto.items as { ticket_type_id: string; qty: number }[]) {
      const { data: tt, error } = await db(token)
        .from('event_ticket_types')
        .select('*')
        .eq('id', item.ticket_type_id)
        .eq('event_id', eventId)
        .single()
      if (error || !tt) throw new NotFoundException(`Ticket type ${item.ticket_type_id} not found`)
      if (!tt.is_active) throw new BadRequestException(`Ticket type "${tt.name}" is not available`)
      if (tt.sale_starts_at && new Date(tt.sale_starts_at) > new Date())
        throw new BadRequestException(`"${tt.name}" sales have not started yet`)
      if (tt.sale_ends_at && new Date(tt.sale_ends_at) < new Date())
        throw new BadRequestException(`"${tt.name}" sales have ended`)
      if (tt.total_quantity !== null) {
        const available = tt.total_quantity - tt.sold_quantity - tt.reserved_quantity
        if (available < item.qty) throw new BadRequestException(`Insufficient inventory for "${tt.name}"`)
      }
      if (item.qty < tt.min_per_order || item.qty > tt.max_per_order)
        throw new BadRequestException(`Qty for "${tt.name}" must be ${tt.min_per_order}–${tt.max_per_order}`)
      lineItems.push({ ticket_type_id: tt.id, name: tt.name, qty: item.qty, unit_price: Number(tt.price) })
      subtotal += Number(tt.price) * item.qty

      // Reserve inventory
      await db(token)
        .from('event_ticket_types')
        .update({ reserved_quantity: tt.reserved_quantity + item.qty })
        .eq('id', tt.id)
    }

    // Discount
    let discountAmount = 0
    let discountCodeId: string | null = null
    if (dto.discount_code) {
      const disc = await this.validateDiscountCode(eventId, dto.discount_code, subtotal, dto.items, token)
      discountAmount = disc.discountAmount
      discountCodeId = disc.id
    }

    const gstAmount = settings.collect_gst
      ? (subtotal - discountAmount) * (Number(settings.gst_percentage ?? 0) / 100)
      : 0
    const convFee = (subtotal - discountAmount) * (Number(settings.convenience_fee_pct ?? 0) / 100)
    const total = subtotal - discountAmount + gstAmount + convFee

    const orderRef = `OP-${eventId.slice(0, 6).toUpperCase()}-${nanoid(8)}`
    const amountPaise = Math.round(total * 100)

    const result = await this.getProvider(gw.provider).createOrder({
      orderRef,
      amount: amountPaise,
      currency: settings.currency,
      description: settings.payment_title ?? 'Event Registration',
      guestName: dto.guest_name,
      guestEmail: dto.guest_email,
      guestPhone: dto.guest_phone,
      callbackUrl: settings.success_redirect_url,
    }, config)

    const { data: order, error: oErr } = await db(token)
      .from('event_payment_orders')
      .insert({
        event_id: eventId,
        tenant_id: tenantId,
        gateway_id: gw.id,
        order_ref: orderRef,
        provider_order_id: result.providerOrderId,
        guest_id: dto.guest_id ?? null,
        guest_name: dto.guest_name,
        guest_email: dto.guest_email,
        guest_phone: dto.guest_phone ?? null,
        line_items: lineItems,
        subtotal,
        discount_amount: discountAmount,
        gst_amount: gstAmount,
        convenience_fee: convFee,
        total_amount: total,
        currency: settings.currency,
        discount_code_id: discountCodeId,
        status: 'initiated',
      })
      .select()
      .single()
    if (oErr) throw new BadRequestException(oErr.message)

    return { order, checkoutPayload: result.checkoutPayload }
  }

  // ── Payment Verification ──────────────────────────────────────────────────────

  async verifyPayment(orderRef: string, tenantId: string, dto: any, token: string) {
    const { data: order } = await db(token)
      .from('event_payment_orders')
      .select('*, tenant_payment_gateways(provider, config)')
      .eq('order_ref', orderRef)
      .eq('tenant_id', tenantId)
      .single()
    if (!order) throw new NotFoundException('Order not found')
    if (order.status === 'paid') return { success: true, order }

    const gw = order.tenant_payment_gateways as any
    const config = JSON.parse(decrypt(gw.config)) as Record<string, string>

    const result = await this.getProvider(gw.provider).verifyPayment({
      providerOrderId: order.provider_order_id,
      providerPaymentId: dto.provider_payment_id,
      signature: dto.signature,
      rawBody: dto.raw_body,
      headers: dto.headers,
    }, config)

    if (!result.verified) throw new UnauthorizedException('Payment verification failed')

    // Mark sold inventory
    for (const li of order.line_items as any[]) {
      const { data: tt } = await db(token)
        .from('event_ticket_types')
        .select('sold_quantity, reserved_quantity')
        .eq('id', li.ticket_type_id)
        .single()
      if (tt) {
        await db(token).from('event_ticket_types').update({
          sold_quantity: tt.sold_quantity + li.qty,
          reserved_quantity: Math.max(0, tt.reserved_quantity - li.qty),
        }).eq('id', li.ticket_type_id)
      }
    }

    // Increment discount usage
    if (order.discount_code_id) {
      await db(token)
        .from('event_discount_codes')
        .update({ usage_count: db(token).rpc as any })
        .eq('id', order.discount_code_id)
      // Use raw increment
      await db(token).rpc('increment_discount_usage', { code_id: order.discount_code_id })
    }

    const { data: updated } = await db(token)
      .from('event_payment_orders')
      .update({
        status: 'paid',
        provider_payment_id: dto.provider_payment_id,
        payment_method: result.paymentMethod,
        provider_metadata: result.providerMetadata,
        paid_at: new Date().toISOString(),
      })
      .eq('id', order.id)
      .select()
      .single()

    return { success: true, order: updated }
  }

  // ── Webhook Handler ───────────────────────────────────────────────────────────

  async handleWebhook(provider: string, tenantId: string, rawBody: string, headers: Record<string, string>, token: string) {
    const { data: gws } = await db(token)
      .from('tenant_payment_gateways')
      .select('config, webhook_secret')
      .eq('tenant_id', tenantId)
      .eq('provider', provider)
      .single()
    if (!gws) return { received: true }

    const config = JSON.parse(decrypt(gws.config)) as Record<string, string>
    if (gws.webhook_secret) config.webhook_secret = decrypt(gws.webhook_secret)

    const body = JSON.parse(rawBody)
    let providerOrderId: string | null = null
    let providerPaymentId: string | null = null

    if (provider === 'razorpay') {
      const event = body.event
      if (event === 'payment.captured') {
        providerOrderId = body.payload?.payment?.entity?.order_id
        providerPaymentId = body.payload?.payment?.entity?.id
      }
    } else if (provider === 'stripe') {
      const event = body.type
      if (event === 'payment_intent.succeeded') {
        providerOrderId = body.data?.object?.id
        providerPaymentId = body.data?.object?.id
      }
    } else if (provider === 'cashfree') {
      providerOrderId = body.data?.order?.cf_order_id
      providerPaymentId = body.data?.payment?.cf_payment_id
    }

    if (providerOrderId) {
      const { data: order } = await db(token)
        .from('event_payment_orders')
        .select('id, status, order_ref, tenant_id')
        .eq('provider_order_id', String(providerOrderId))
        .eq('tenant_id', tenantId)
        .maybeSingle()
      if (order && order.status !== 'paid') {
        await this.verifyPayment(order.order_ref, tenantId, {
          provider_payment_id: providerPaymentId,
          raw_body: rawBody,
          headers,
        }, token)
      }
    }

    return { received: true }
  }

  // ── Orders ────────────────────────────────────────────────────────────────────

  async listOrders(eventId: string, tenantId: string, token: string, filters: any = {}) {
    let q = db(token)
      .from('event_payment_orders')
      .select('*')
      .eq('event_id', eventId)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })

    if (filters.status) q = q.eq('status', filters.status)
    if (filters.from)   q = q.gte('created_at', filters.from)
    if (filters.to)     q = q.lte('created_at', filters.to)
    if (filters.search) {
      q = q.or(`guest_name.ilike.%${filters.search}%,guest_email.ilike.%${filters.search}%,order_ref.ilike.%${filters.search}%`)
    }
    const page = Number(filters.page ?? 1)
    const limit = Number(filters.limit ?? 50)
    q = q.range((page - 1) * limit, page * limit - 1)

    const { data, error } = await q
    if (error) throw new BadRequestException(error.message)
    return data
  }

  async getOrder(orderId: string, tenantId: string, token: string) {
    const { data, error } = await db(token)
      .from('event_payment_orders')
      .select('*')
      .eq('id', orderId)
      .eq('tenant_id', tenantId)
      .single()
    if (error) throw new NotFoundException('Order not found')
    return data
  }

  async markOrderPaid(orderId: string, tenantId: string, dto: any, token: string) {
    const { data: order } = await db(token)
      .from('event_payment_orders')
      .select('*, tenant_payment_gateways(provider)')
      .eq('id', orderId)
      .eq('tenant_id', tenantId)
      .single()
    if (!order) throw new NotFoundException('Order not found')
    if (order.tenant_payment_gateways?.provider !== 'manual')
      throw new BadRequestException('Only manual orders can be marked paid this way')
    const { data: updated, error } = await db(token)
      .from('event_payment_orders')
      .update({ status: 'paid', payment_method: 'manual', paid_at: new Date().toISOString(), provider_metadata: dto })
      .eq('id', orderId)
      .select()
      .single()
    if (error) throw new BadRequestException(error.message)
    return updated
  }

  // ── Refunds ───────────────────────────────────────────────────────────────────

  async initiateRefund(orderId: string, tenantId: string, dto: any, initiatedBy: string, token: string) {
    const { data: order } = await db(token)
      .from('event_payment_orders')
      .select('*, tenant_payment_gateways(provider, config)')
      .eq('id', orderId)
      .eq('tenant_id', tenantId)
      .single()
    if (!order) throw new NotFoundException('Order not found')
    if (!['paid', 'partially_refunded'].includes(order.status))
      throw new BadRequestException(`Cannot refund order in status: ${order.status}`)

    const refundRef = `REF-${nanoid(10)}`
    const gw = order.tenant_payment_gateways as any
    const config = JSON.parse(decrypt(gw.config)) as Record<string, string>

    const result = await this.getProvider(gw.provider).initiateRefund({
      providerPaymentId: order.provider_payment_id,
      amount: Math.round(dto.amount * 100),
      reason: dto.reason,
      refundRef,
    }, config)

    const { data: refund, error } = await db(token)
      .from('event_payment_refunds')
      .insert({
        order_id: orderId,
        tenant_id: tenantId,
        refund_ref: refundRef,
        provider_refund_id: result.providerRefundId,
        amount: dto.amount,
        reason: dto.reason,
        status: result.status,
        initiated_by: initiatedBy,
      })
      .select()
      .single()
    if (error) throw new BadRequestException(error.message)

    // Update order status
    const totalRefunded = dto.amount
    const newStatus = totalRefunded >= order.total_amount ? 'refunded' : 'partially_refunded'
    await db(token).from('event_payment_orders').update({ status: newStatus }).eq('id', orderId)

    return refund
  }

  async listRefunds(orderId: string, tenantId: string, token: string) {
    const { data, error } = await db(token)
      .from('event_payment_refunds')
      .select('*')
      .eq('order_id', orderId)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
    if (error) throw new BadRequestException(error.message)
    return data
  }

  // ── Discount Codes ────────────────────────────────────────────────────────────

  async listDiscountCodes(eventId: string, tenantId: string, token: string) {
    const { data, error } = await db(token)
      .from('event_discount_codes')
      .select('*')
      .eq('event_id', eventId)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
    if (error) throw new BadRequestException(error.message)
    return data
  }

  async createDiscountCode(eventId: string, tenantId: string, dto: any, token: string) {
    const code = (dto.code as string).toUpperCase().trim()
    const { data, error } = await db(token)
      .from('event_discount_codes')
      .insert({ ...dto, code, event_id: eventId, tenant_id: tenantId })
      .select()
      .single()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  async updateDiscountCode(codeId: string, tenantId: string, dto: any, token: string) {
    const { data, error } = await db(token)
      .from('event_discount_codes')
      .update(dto)
      .eq('id', codeId)
      .eq('tenant_id', tenantId)
      .select()
      .single()
    if (error) throw new BadRequestException(error.message)
    return data
  }

  async deleteDiscountCode(codeId: string, tenantId: string, token: string) {
    await db(token).from('event_discount_codes').delete().eq('id', codeId).eq('tenant_id', tenantId)
  }

  async validateDiscountCode(eventId: string, code: string, subtotal: number, items: any[], token: string) {
    const serviceClient = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!)
    const { data: disc, error } = await serviceClient
      .from('event_discount_codes')
      .select('*')
      .eq('event_id', eventId)
      .eq('code', code.toUpperCase().trim())
      .single()
    if (error || !disc) throw new BadRequestException('Invalid discount code')
    if (!disc.is_active) throw new BadRequestException('Discount code is inactive')
    const now = new Date()
    if (disc.valid_from && new Date(disc.valid_from) > now) throw new BadRequestException('Code not yet valid')
    if (disc.valid_until && new Date(disc.valid_until) < now) throw new BadRequestException('Code has expired')
    if (disc.usage_limit !== null && disc.usage_count >= disc.usage_limit)
      throw new BadRequestException('Code usage limit reached')
    if (disc.min_order_value && subtotal < disc.min_order_value)
      throw new BadRequestException(`Minimum order value ₹${disc.min_order_value} required`)

    let discountAmount = 0
    if (disc.discount_type === 'percentage') {
      discountAmount = subtotal * (disc.discount_value / 100)
      if (disc.max_discount_cap) discountAmount = Math.min(discountAmount, disc.max_discount_cap)
    } else {
      discountAmount = disc.discount_value
    }
    discountAmount = Math.min(discountAmount, subtotal)
    return { id: disc.id, discountAmount, code: disc.code }
  }

  // ── Dashboard ─────────────────────────────────────────────────────────────────

  async getDashboard(eventId: string, tenantId: string, token: string) {
    const [ordersRes, ticketsRes] = await Promise.all([
      db(token).from('event_payment_orders').select('status, total_amount, created_at').eq('event_id', eventId).eq('tenant_id', tenantId),
      db(token).from('event_ticket_types').select('id, name, price, total_quantity, sold_quantity, category').eq('event_id', eventId).eq('tenant_id', tenantId),
    ])
    const orders = ordersRes.data ?? []
    const tickets = ticketsRes.data ?? []

    const paid = orders.filter(o => o.status === 'paid')
    const totalRevenue = paid.reduce((s, o) => s + Number(o.total_amount), 0)
    const totalOrders = orders.length
    const paidOrders = paid.length
    const failedOrders = orders.filter(o => o.status === 'failed').length
    const pendingOrders = orders.filter(o => ['pending', 'initiated'].includes(o.status)).length

    // Revenue by day (last 30 days)
    const revenueByDay: Record<string, number> = {}
    for (const o of paid) {
      const day = o.created_at.slice(0, 10)
      revenueByDay[day] = (revenueByDay[day] ?? 0) + Number(o.total_amount)
    }

    const totalTicketsSold = tickets.reduce((s, t) => s + t.sold_quantity, 0)

    return {
      revenue: { total: totalRevenue, currency: 'INR' },
      orders: { total: totalOrders, paid: paidOrders, failed: failedOrders, pending: pendingOrders },
      conversion_rate: totalOrders ? Math.round((paidOrders / totalOrders) * 100) : 0,
      tickets_sold: totalTicketsSold,
      revenue_by_day: Object.entries(revenueByDay)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, amount]) => ({ date, amount })),
      ticket_types: tickets.map(t => ({
        ...t,
        available: t.total_quantity !== null ? t.total_quantity - t.sold_quantity : null,
        revenue: Number(t.price) * t.sold_quantity,
      })),
    }
  }

  async exportOrders(eventId: string, tenantId: string, token: string): Promise<string> {
    const orders = await this.listOrders(eventId, tenantId, token, { limit: 10000 })
    const headers = ['order_ref', 'guest_name', 'guest_email', 'guest_phone', 'total_amount', 'currency', 'status', 'payment_method', 'paid_at', 'created_at']
    const rows = orders?.map(o =>
      headers.map(h => JSON.stringify((o as any)[h] ?? '')).join(',')
    ) ?? []
    return [headers.join(','), ...rows].join('\n')
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  private async loadGateway(gatewayId: string, tenantId: string, token: string) {
    const { data, error } = await db(token)
      .from('tenant_payment_gateways')
      .select('*')
      .eq('id', gatewayId)
      .eq('tenant_id', tenantId)
      .single()
    if (error || !data) throw new NotFoundException('Payment gateway not found')
    if (!data.is_active) throw new BadRequestException('Payment gateway is not active')
    return data
  }
}
