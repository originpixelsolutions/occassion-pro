import { Logger } from '@nestjs/common'
import {
  IPaymentProvider, PaymentLinkResult, PaymentVerifyResult, RefundResult,
  TransactionRecord, CreatePaymentLinkOptions, TenantPaymentCredentials,
} from '../interfaces/payment-provider.interface'

export class RazorpayProvider implements IPaymentProvider {
  readonly providerName = 'razorpay'
  readonly supportedCurrencies = ['INR']
  private readonly logger = new Logger(RazorpayProvider.name)

  constructor(private readonly credentials: TenantPaymentCredentials) {}

  private get headers() {
    const token = Buffer.from(`${this.credentials.razorpay_key_id}:${this.credentials.razorpay_key_secret}`).toString('base64')
    return { 'Authorization': `Basic ${token}`, 'Content-Type': 'application/json' }
  }

  private get baseUrl() {
    return 'https://api.razorpay.com/v1'
  }

  async createPaymentLink(opts: CreatePaymentLinkOptions): Promise<PaymentLinkResult> {
    const expiresAt = opts.expiryMinutes
      ? Math.floor(Date.now() / 1000) + opts.expiryMinutes * 60
      : Math.floor(Date.now() / 1000) + 24 * 60 * 60

    const body = {
      amount: opts.amount, // Razorpay expects paise
      currency: opts.currency,
      description: opts.description,
      reference_id: opts.invoiceId,
      customer: {
        name: opts.customerName,
        email: opts.customerEmail,
        contact: opts.customerPhone,
      },
      notify: { sms: !!opts.customerPhone, email: !!opts.customerEmail },
      reminder_enable: true,
      callback_url: opts.callbackUrl,
      callback_method: 'get',
      expire_by: expiresAt,
    }

    const res = await fetch(`${this.baseUrl}/payment_links`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const err = await res.json()
      throw new Error(`Razorpay error: ${JSON.stringify(err)}`)
    }

    const data = await res.json()
    return {
      url: data.short_url,
      paymentId: data.id,
      provider: 'razorpay',
      expiresAt: new Date(expiresAt * 1000),
    }
  }

  async verifyPayment(paymentId: string): Promise<PaymentVerifyResult> {
    const res = await fetch(`${this.baseUrl}/payment_links/${paymentId}`, { headers: this.headers })
    if (!res.ok) throw new Error(`Razorpay verify failed`)
    const data = await res.json()

    const statusMap: Record<string, PaymentVerifyResult['status']> = {
      paid: 'paid', created: 'pending', expired: 'failed', cancelled: 'failed',
    }

    return {
      status: statusMap[data.status] ?? 'pending',
      amount: data.amount_paid / 100, // convert paise to rupees
      currency: data.currency,
      timestamp: new Date(data.updated_at * 1000),
      providerPaymentId: data.payments?.[0]?.payment_id ?? paymentId,
      method: data.payments?.[0]?.method,
    }
  }

  async refund(paymentId: string, amount: number): Promise<RefundResult> {
    const body = { amount: Math.round(amount * 100) } // convert to paise
    const res = await fetch(`${this.baseUrl}/payments/${paymentId}/refund`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(`Razorpay refund error: ${JSON.stringify(err)}`)
    }
    const data = await res.json()
    return { success: data.status === 'processed', refundId: data.id, amount: data.amount / 100 }
  }

  async getTransactions(limit = 20): Promise<TransactionRecord[]> {
    const res = await fetch(`${this.baseUrl}/payments?count=${limit}`, { headers: this.headers })
    if (!res.ok) return []
    const data = await res.json()
    return (data.items ?? []).map((p: Record<string, unknown>) => ({
      id: p.id as string,
      amount: (p.amount as number) / 100,
      currency: p.currency as string,
      status: p.status as string,
      method: p.method as string,
      createdAt: new Date((p.created_at as number) * 1000),
      description: p.description as string,
    }))
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/payments?count=1`, { headers: this.headers })
      return res.ok
        ? { success: true, message: 'Razorpay connection successful' }
        : { success: false, message: 'Invalid credentials' }
    } catch {
      return { success: false, message: 'Connection failed' }
    }
  }
}
