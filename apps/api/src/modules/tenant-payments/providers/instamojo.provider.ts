import { Injectable } from '@nestjs/common'
import * as crypto from 'crypto'
import {
  ITenantPaymentProvider, CreateOrderPayload, OrderResult,
  VerifyPaymentPayload, VerifyResult, RefundPayload, RefundResult, OrderStatusResult,
} from './provider.interface'

@Injectable()
export class InstamojoProvider implements ITenantPaymentProvider {
  private base(config: Record<string, string>) {
    return config.environment === 'production'
      ? 'https://api.instamojo.com/v2'
      : 'https://test.instamojo.com/v2'
  }

  private headers(config: Record<string, string>) {
    return {
      'Content-Type': 'application/json',
      'X-Api-Key': config.api_key,
      'X-Auth-Token': config.auth_token,
    }
  }

  async createOrder(payload: CreateOrderPayload, config: Record<string, string>): Promise<OrderResult> {
    const res = await fetch(`${this.base(config)}/payment_requests/`, {
      method: 'POST',
      headers: this.headers(config),
      body: JSON.stringify({
        purpose: payload.description,
        amount: (payload.amount / 100).toFixed(2),
        buyer_name: payload.guestName,
        email: payload.guestEmail,
        phone: payload.guestPhone ?? '',
        redirect_url: payload.callbackUrl ?? '',
        send_email: false,
        send_sms: false,
        allow_repeated_payments: false,
      }),
    })
    if (!res.ok) throw new Error(`Instamojo createOrder failed: ${await res.text()}`)
    const data = await res.json() as any
    return {
      providerOrderId: data.id,
      checkoutPayload: {
        paymentUrl: data.longurl,
        orderId: data.id,
      },
    }
  }

  async verifyPayment(payload: VerifyPaymentPayload, config: Record<string, string>): Promise<VerifyResult> {
    const { salt } = config
    const { providerPaymentId, signature } = payload
    if (!signature || !salt) return { verified: false }
    const hmac = crypto.createHmac('sha1', salt).update(providerPaymentId).digest('hex')
    return {
      verified: crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(signature)),
      paymentMethod: 'instamojo',
    }
  }

  async initiateRefund(payload: RefundPayload, config: Record<string, string>): Promise<RefundResult> {
    const res = await fetch(`${this.base(config)}/refunds/`, {
      method: 'POST',
      headers: this.headers(config),
      body: JSON.stringify({
        payment_id: payload.providerPaymentId,
        type: 'RFD',
        body: payload.reason ?? 'Requested refund',
        refund_amount: (payload.amount / 100).toFixed(2),
      }),
    })
    if (!res.ok) throw new Error(`Instamojo refund failed: ${await res.text()}`)
    const data = await res.json() as any
    return {
      providerRefundId: data.refund?.id ?? payload.refundRef,
      status: 'processing',
    }
  }

  async getOrderStatus(providerOrderId: string, config: Record<string, string>): Promise<OrderStatusResult> {
    const res = await fetch(`${this.base(config)}/payment_requests/${providerOrderId}/`, {
      headers: this.headers(config),
    })
    if (!res.ok) throw new Error(`Instamojo getOrder failed`)
    const data = await res.json() as any
    const statusMap: Record<string, OrderStatusResult['status']> = {
      Completed: 'paid', Pending: 'pending', Failed: 'failed',
    }
    return { status: statusMap[data.status] ?? 'pending', providerMetadata: data }
  }
}
