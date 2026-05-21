import * as crypto from 'crypto'
import { Injectable } from '@nestjs/common'
import {
  ITenantPaymentProvider, CreateOrderPayload, OrderResult,
  VerifyPaymentPayload, VerifyResult, RefundPayload, RefundResult, OrderStatusResult,
} from './provider.interface'

@Injectable()
export class RazorpayProvider implements ITenantPaymentProvider {
  private base64Auth(keyId: string, keySecret: string) {
    return Buffer.from(`${keyId}:${keySecret}`).toString('base64')
  }

  async createOrder(payload: CreateOrderPayload, config: Record<string, string>): Promise<OrderResult> {
    const { key_id, key_secret } = config
    const body = {
      amount: payload.amount,
      currency: payload.currency,
      receipt: payload.orderRef,
      notes: { ...payload.notes, guest_email: payload.guestEmail },
    }
    const res = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${this.base64Auth(key_id, key_secret)}`,
      },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Razorpay createOrder failed: ${err}`)
    }
    const order = await res.json() as any
    return {
      providerOrderId: order.id,
      checkoutPayload: {
        key: key_id,
        order_id: order.id,
        name: payload.description,
        prefill: {
          name: payload.guestName,
          email: payload.guestEmail,
          contact: payload.guestPhone ?? '',
        },
        theme: { color: '#6366f1' },
      },
    }
  }

  async verifyPayment(payload: VerifyPaymentPayload, config: Record<string, string>): Promise<VerifyResult> {
    const { key_secret } = config
    const { providerOrderId, providerPaymentId, signature } = payload
    if (!signature) return { verified: false }
    const data = `${providerOrderId}|${providerPaymentId}`
    const expected = crypto
      .createHmac('sha256', key_secret)
      .update(data)
      .digest('hex')
    return {
      verified: crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature)),
      paymentMethod: 'razorpay',
    }
  }

  async initiateRefund(payload: RefundPayload, config: Record<string, string>): Promise<RefundResult> {
    const { key_id, key_secret } = config
    const res = await fetch(`https://api.razorpay.com/v1/payments/${payload.providerPaymentId}/refund`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${this.base64Auth(key_id, key_secret)}`,
      },
      body: JSON.stringify({ amount: payload.amount, notes: { reason: payload.reason ?? '' } }),
    })
    if (!res.ok) throw new Error(`Razorpay refund failed: ${await res.text()}`)
    const refund = await res.json() as any
    return {
      providerRefundId: refund.id,
      status: refund.status === 'processed' ? 'completed' : 'processing',
    }
  }

  async getOrderStatus(providerOrderId: string, config: Record<string, string>): Promise<OrderStatusResult> {
    const { key_id, key_secret } = config
    const res = await fetch(`https://api.razorpay.com/v1/orders/${providerOrderId}`, {
      headers: { Authorization: `Basic ${this.base64Auth(key_id, key_secret)}` },
    })
    if (!res.ok) throw new Error(`Razorpay getOrder failed`)
    const order = await res.json() as any
    const statusMap: Record<string, OrderStatusResult['status']> = {
      created: 'pending', attempted: 'pending', paid: 'paid',
    }
    return { status: statusMap[order.status] ?? 'pending', providerMetadata: order }
  }
}
