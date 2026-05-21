import {
  IPaymentProvider, PaymentLinkResult, PaymentVerifyResult, RefundResult,
  TransactionRecord, CreatePaymentLinkOptions, TenantPaymentCredentials,
} from '../interfaces/payment-provider.interface'

export class CashfreeProvider implements IPaymentProvider {
  readonly providerName = 'cashfree'
  readonly supportedCurrencies = ['INR']

  constructor(private readonly credentials: TenantPaymentCredentials) {}

  private get baseUrl() {
    return this.credentials.test_mode ? 'https://sandbox.cashfree.com/pg' : 'https://api.cashfree.com/pg'
  }

  private get headers() {
    return {
      'x-client-id': this.credentials.cashfree_app_id!,
      'x-client-secret': this.credentials.cashfree_secret_key!,
      'x-api-version': '2023-08-01',
      'Content-Type': 'application/json',
    }
  }

  async createPaymentLink(opts: CreatePaymentLinkOptions): Promise<PaymentLinkResult> {
    const body = {
      link_id: `LNK${opts.invoiceId.replace(/-/g, '').slice(0, 10)}${Date.now()}`,
      link_amount: opts.amount / 100, // Cashfree expects rupees
      link_currency: opts.currency,
      link_purpose: opts.description,
      customer_details: {
        customer_name: opts.customerName ?? 'Customer',
        customer_email: opts.customerEmail ?? '',
        customer_phone: opts.customerPhone ?? '9999999999',
      },
      link_notify: { send_sms: !!opts.customerPhone, send_email: !!opts.customerEmail },
      link_auto_reminders: true,
      link_expiry_time: opts.expiryMinutes
        ? new Date(Date.now() + opts.expiryMinutes * 60 * 1000).toISOString()
        : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      link_meta: { return_url: opts.callbackUrl },
    }

    const res = await fetch(`${this.baseUrl}/links`, { method: 'POST', headers: this.headers, body: JSON.stringify(body) })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(`Cashfree error: ${JSON.stringify(err)}`)
    }
    const data = await res.json()
    return { url: data.link_url, paymentId: data.link_id, provider: 'cashfree' }
  }

  async verifyPayment(linkId: string): Promise<PaymentVerifyResult> {
    const res = await fetch(`${this.baseUrl}/links/${linkId}`, { headers: this.headers })
    if (!res.ok) throw new Error('Cashfree verify failed')
    const data = await res.json()
    const statusMap: Record<string, PaymentVerifyResult['status']> = {
      PAID: 'paid', ACTIVE: 'pending', EXPIRED: 'failed', CANCELLED: 'failed',
    }
    return {
      status: statusMap[data.link_status] ?? 'pending',
      amount: data.link_amount_paid ?? 0,
      currency: data.link_currency ?? 'INR',
      timestamp: new Date(data.link_created_at),
      providerPaymentId: data.cf_link_id ?? linkId,
    }
  }

  async refund(orderId: string, amount: number): Promise<RefundResult> {
    const body = { refund_amount: amount, refund_id: `REF${Date.now()}` }
    const res = await fetch(`${this.baseUrl}/orders/${orderId}/refunds`, { method: 'POST', headers: this.headers, body: JSON.stringify(body) })
    if (!res.ok) throw new Error('Cashfree refund failed')
    const data = await res.json()
    return { success: data.refund_status === 'SUCCESS', refundId: data.cf_refund_id, amount }
  }

  async getTransactions(): Promise<TransactionRecord[]> { return [] }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/accounts`, { headers: this.headers })
      return res.ok ? { success: true, message: 'Cashfree connection successful' } : { success: false, message: 'Invalid credentials' }
    } catch {
      return { success: false, message: 'Connection failed' }
    }
  }
}
