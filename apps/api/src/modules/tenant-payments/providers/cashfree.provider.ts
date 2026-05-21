import { Injectable } from '@nestjs/common'
import * as crypto from 'crypto'
import {
  ITenantPaymentProvider, CreateOrderPayload, OrderResult,
  VerifyPaymentPayload, VerifyResult, RefundPayload, RefundResult, OrderStatusResult,
} from './provider.interface'

@Injectable()
export class CashfreeProvider implements ITenantPaymentProvider {
  private base(config: Record<string, string>) {
    return config.environment === 'production'
      ? 'https://api.cashfree.com/pg'
      : 'https://sandbox.cashfree.com/pg'
  }

  private headers(config: Record<string, string>) {
    return {
      'Content-Type': 'application/json',
      'x-client-id': config.app_id,
      'x-client-secret': config.secret_key,
      'x-api-version': '2023-08-01',
    }
  }

  async createOrder(payload: CreateOrderPayload, config: Record<string, string>): Promise<OrderResult> {
    const res = await fetch(`${this.base(config)}/orders`, {
      method: 'POST',
      headers: this.headers(config),
      body: JSON.stringify({
        order_id: payload.orderRef,
        order_amount: payload.amount / 100,
        order_currency: payload.currency,
        customer_details: {
          customer_id: payload.guestEmail.replace(/[^a-zA-Z0-9_-]/g, '_'),
          customer_name: payload.guestName,
          customer_email: payload.guestEmail,
          customer_phone: payload.guestPhone ?? '9999999999',
        },
        order_meta: { return_url: payload.callbackUrl },
      }),
    })
    if (!res.ok) throw new Error(`Cashfree createOrder failed: ${await res.text()}`)
    const order = await res.json() as any
    return {
      providerOrderId: order.cf_order_id,
      checkoutPayload: {
        paymentSessionId: order.payment_session_id,
        orderId: payload.orderRef,
        environment: config.environment ?? 'sandbox',
      },
    }
  }

  async verifyPayment(payload: VerifyPaymentPayload, config: Record<string, string>): Promise<VerifyResult> {
    // Cashfree uses webhook signature: timestamp.rawBody
    const { rawBody, headers } = payload
    if (!rawBody || !headers) return { verified: false }
    const ts = headers['x-webhook-timestamp']
    const sig = headers['x-webhook-signature']
    if (!ts || !sig) return { verified: false }
    const expected = crypto
      .createHmac('sha256', config.secret_key)
      .update(`${ts}${rawBody}`)
      .digest('base64')
    return {
      verified: crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig)),
      paymentMethod: 'cashfree',
    }
  }

  async initiateRefund(payload: RefundPayload, config: Record<string, string>): Promise<RefundResult> {
    const res = await fetch(`${this.base(config)}/orders/${payload.providerPaymentId}/refunds`, {
      method: 'POST',
      headers: this.headers(config),
      body: JSON.stringify({
        refund_amount: payload.amount / 100,
        refund_id: payload.refundRef,
        refund_note: payload.reason ?? '',
      }),
    })
    if (!res.ok) throw new Error(`Cashfree refund failed: ${await res.text()}`)
    const refund = await res.json() as any
    return {
      providerRefundId: refund.cf_refund_id,
      status: refund.refund_status === 'SUCCESS' ? 'completed' : 'processing',
    }
  }

  async getOrderStatus(providerOrderId: string, config: Record<string, string>): Promise<OrderStatusResult> {
    const res = await fetch(`${this.base(config)}/orders/${providerOrderId}`, {
      headers: this.headers(config),
    })
    if (!res.ok) throw new Error(`Cashfree getOrder failed`)
    const order = await res.json() as any
    const statusMap: Record<string, OrderStatusResult['status']> = {
      PAID: 'paid', ACTIVE: 'pending', EXPIRED: 'cancelled', CANCELLED: 'cancelled',
    }
    return { status: statusMap[order.order_status] ?? 'pending', providerMetadata: order }
  }
}
