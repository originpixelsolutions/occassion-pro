import * as crypto from 'crypto'
import { Injectable } from '@nestjs/common'
import {
  ITenantPaymentProvider, CreateOrderPayload, OrderResult,
  VerifyPaymentPayload, VerifyResult, RefundPayload, RefundResult, OrderStatusResult,
} from './provider.interface'

@Injectable()
export class StripeProvider implements ITenantPaymentProvider {
  private async stripePost(path: string, params: Record<string, unknown>, secretKey: string) {
    const body = new URLSearchParams()
    const flatten = (obj: Record<string, unknown>, prefix = '') => {
      for (const [k, v] of Object.entries(obj)) {
        const key = prefix ? `${prefix}[${k}]` : k
        if (v && typeof v === 'object' && !Array.isArray(v)) {
          flatten(v as Record<string, unknown>, key)
        } else {
          body.append(key, String(v))
        }
      }
    }
    flatten(params)
    const res = await fetch(`https://api.stripe.com/v1${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    })
    if (!res.ok) throw new Error(`Stripe error: ${await res.text()}`)
    return res.json() as Promise<any>
  }

  async createOrder(payload: CreateOrderPayload, config: Record<string, string>): Promise<OrderResult> {
    const { secret_key, publishable_key } = config
    const pi = await this.stripePost('/payment_intents', {
      amount: payload.amount,
      currency: payload.currency.toLowerCase(),
      description: payload.description,
      receipt_email: payload.guestEmail,
      metadata: { order_ref: payload.orderRef },
    }, secret_key)
    return {
      providerOrderId: pi.id,
      checkoutPayload: {
        publishableKey: publishable_key,
        clientSecret: pi.client_secret,
        appearance: { theme: 'night' },
      },
    }
  }

  async verifyPayment(payload: VerifyPaymentPayload, config: Record<string, string>): Promise<VerifyResult> {
    const { webhook_secret } = config
    const { rawBody, headers } = payload
    if (!rawBody || !headers) return { verified: false }
    const sigHeader = headers['stripe-signature']
    if (!sigHeader) return { verified: false }
    try {
      const parts = sigHeader.split(',').reduce((acc, p) => {
        const [k, v] = p.split('=')
        acc[k] = v
        return acc
      }, {} as Record<string, string>)
      const timestamp = parts['t']
      const v1Sig = parts['v1']
      const signed = `${timestamp}.${rawBody}`
      const expected = crypto.createHmac('sha256', webhook_secret).update(signed).digest('hex')
      const verified = crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1Sig))
      return { verified, paymentMethod: 'stripe' }
    } catch {
      return { verified: false }
    }
  }

  async initiateRefund(payload: RefundPayload, config: Record<string, string>): Promise<RefundResult> {
    const { secret_key } = config
    const refund = await this.stripePost('/refunds', {
      payment_intent: payload.providerPaymentId,
      amount: payload.amount,
      reason: 'requested_by_customer',
      metadata: { refund_ref: payload.refundRef },
    }, secret_key)
    const statusMap: Record<string, RefundResult['status']> = {
      succeeded: 'completed', pending: 'pending', failed: 'processing',
    }
    return { providerRefundId: refund.id, status: statusMap[refund.status] ?? 'processing' }
  }

  async getOrderStatus(providerOrderId: string, config: Record<string, string>): Promise<OrderStatusResult> {
    const res = await fetch(`https://api.stripe.com/v1/payment_intents/${providerOrderId}`, {
      headers: { Authorization: `Bearer ${config.secret_key}` },
    })
    if (!res.ok) throw new Error(`Stripe getPI failed`)
    const pi = await res.json() as any
    const statusMap: Record<string, OrderStatusResult['status']> = {
      succeeded: 'paid', canceled: 'cancelled',
      requires_payment_method: 'pending', requires_confirmation: 'pending',
      processing: 'pending',
    }
    return { status: statusMap[pi.status] ?? 'pending', providerMetadata: pi }
  }
}
