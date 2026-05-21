import { Logger } from '@nestjs/common'
import {
  IPaymentProvider, PaymentLinkResult, PaymentVerifyResult, RefundResult,
  TransactionRecord, CreatePaymentLinkOptions, TenantPaymentCredentials,
} from '../interfaces/payment-provider.interface'

export class StripeProvider implements IPaymentProvider {
  readonly providerName = 'stripe'
  readonly supportedCurrencies = ['INR', 'USD', 'EUR', 'GBP', 'AED']
  private readonly logger = new Logger(StripeProvider.name)

  constructor(private readonly credentials: TenantPaymentCredentials) {}

  private get headers() {
    return {
      'Authorization': `Bearer ${this.credentials.stripe_secret_key}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    }
  }

  private get baseUrl() { return 'https://api.stripe.com/v1' }

  private formEncode(obj: Record<string, unknown>): string {
    return Object.entries(obj)
      .filter(([, v]) => v != null)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join('&')
  }

  async createPaymentLink(opts: CreatePaymentLinkOptions): Promise<PaymentLinkResult> {
    // Create a Stripe Payment Link via Checkout Session
    const expiresAt = opts.expiryMinutes
      ? Math.floor(Date.now() / 1000) + opts.expiryMinutes * 60
      : Math.floor(Date.now() / 1000) + 24 * 60 * 60

    const body = this.formEncode({
      'payment_method_types[]': 'card',
      'mode': 'payment',
      'line_items[0][price_data][currency]': opts.currency.toLowerCase(),
      'line_items[0][price_data][unit_amount]': opts.amount, // smallest unit
      'line_items[0][price_data][product_data][name]': opts.description,
      'client_reference_id': opts.invoiceId,
      'customer_email': opts.customerEmail,
      'success_url': `${opts.callbackUrl}?session_id={CHECKOUT_SESSION_ID}&status=success`,
      'cancel_url': `${opts.callbackUrl}?status=cancelled`,
      'expires_at': expiresAt,
    })

    const res = await fetch(`${this.baseUrl}/checkout/sessions`, {
      method: 'POST',
      headers: this.headers,
      body,
    })

    if (!res.ok) {
      const err = await res.json()
      throw new Error(`Stripe error: ${JSON.stringify(err)}`)
    }

    const data = await res.json()
    return { url: data.url, paymentId: data.id, provider: 'stripe', expiresAt: new Date(expiresAt * 1000) }
  }

  async verifyPayment(sessionId: string): Promise<PaymentVerifyResult> {
    const res = await fetch(`${this.baseUrl}/checkout/sessions/${sessionId}`, { headers: this.headers })
    if (!res.ok) throw new Error('Stripe verify failed')
    const data = await res.json()
    const statusMap: Record<string, PaymentVerifyResult['status']> = {
      complete: 'paid', expired: 'failed', open: 'pending',
    }
    return {
      status: statusMap[data.status] ?? 'pending',
      amount: data.amount_total / 100,
      currency: (data.currency as string).toUpperCase(),
      timestamp: new Date(data.created * 1000),
      providerPaymentId: data.payment_intent ?? sessionId,
    }
  }

  async refund(paymentIntentId: string, amount: number): Promise<RefundResult> {
    const body = this.formEncode({ payment_intent: paymentIntentId, amount: Math.round(amount * 100) })
    const res = await fetch(`${this.baseUrl}/refunds`, { method: 'POST', headers: this.headers, body })
    if (!res.ok) throw new Error('Stripe refund failed')
    const data = await res.json()
    return { success: data.status === 'succeeded', refundId: data.id, amount: data.amount / 100 }
  }

  async getTransactions(limit = 20): Promise<TransactionRecord[]> {
    const res = await fetch(`${this.baseUrl}/charges?limit=${limit}`, { headers: this.headers })
    if (!res.ok) return []
    const data = await res.json()
    return (data.data ?? []).map((c: Record<string, unknown>) => ({
      id: c.id as string,
      amount: (c.amount as number) / 100,
      currency: ((c.currency as string) ?? '').toUpperCase(),
      status: c.status as string,
      method: 'card',
      createdAt: new Date((c.created as number) * 1000),
      description: c.description as string,
    }))
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/account`, { headers: this.headers })
      return res.ok
        ? { success: true, message: 'Stripe connection successful' }
        : { success: false, message: 'Invalid credentials' }
    } catch {
      return { success: false, message: 'Connection failed' }
    }
  }
}
