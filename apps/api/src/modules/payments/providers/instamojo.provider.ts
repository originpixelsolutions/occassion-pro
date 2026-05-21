import {
  IPaymentProvider, PaymentLinkResult, PaymentVerifyResult, RefundResult,
  TransactionRecord, CreatePaymentLinkOptions, TenantPaymentCredentials,
} from '../interfaces/payment-provider.interface'

export class InstamojoProvider implements IPaymentProvider {
  readonly providerName = 'instamojo'
  readonly supportedCurrencies = ['INR']

  constructor(private readonly credentials: TenantPaymentCredentials) {}

  private get baseUrl() {
    return this.credentials.test_mode ? 'https://test.instamojo.com/api/1.1' : 'https://www.instamojo.com/api/1.1'
  }

  private get headers() {
    return {
      'X-Api-Key': this.credentials.instamojo_api_key!,
      'X-Auth-Token': this.credentials.instamojo_auth_token!,
      'Content-Type': 'application/x-www-form-urlencoded',
    }
  }

  async createPaymentLink(opts: CreatePaymentLinkOptions): Promise<PaymentLinkResult> {
    const amount = (opts.amount / 100).toFixed(2) // paise to rupees
    const body = new URLSearchParams({
      purpose: opts.description.slice(0, 30),
      amount,
      buyer_name: opts.customerName ?? 'Customer',
      email: opts.customerEmail ?? '',
      phone: opts.customerPhone ?? '',
      redirect_url: opts.callbackUrl ?? '',
      allow_repeated_payments: 'False',
      send_email: opts.customerEmail ? 'True' : 'False',
      send_sms: opts.customerPhone ? 'True' : 'False',
    })

    const res = await fetch(`${this.baseUrl}/payment-requests/`, { method: 'POST', headers: this.headers, body })
    if (!res.ok) throw new Error('Instamojo create payment failed')
    const data = await res.json()
    if (!data.success) throw new Error(JSON.stringify(data))
    return { url: data.payment_request.longurl, paymentId: data.payment_request.id, provider: 'instamojo' }
  }

  async verifyPayment(paymentRequestId: string): Promise<PaymentVerifyResult> {
    const res = await fetch(`${this.baseUrl}/payment-requests/${paymentRequestId}/`, { headers: this.headers })
    if (!res.ok) throw new Error('Instamojo verify failed')
    const data = await res.json()
    const payment = data.payment_request?.payments?.[0]
    const statusMap: Record<string, PaymentVerifyResult['status']> = { Credit: 'paid', Pending: 'pending', Failed: 'failed' }
    return {
      status: statusMap[payment?.status ?? 'Pending'] ?? 'pending',
      amount: parseFloat(data.payment_request?.amount ?? '0'),
      currency: 'INR',
      timestamp: new Date(payment?.payment_request_id ?? Date.now()),
      providerPaymentId: payment?.payment_id ?? paymentRequestId,
      method: payment?.instrument_type,
    }
  }

  async refund(paymentId: string, amount: number): Promise<RefundResult> {
    const body = new URLSearchParams({
      payment_id: paymentId,
      type: 'QFL',
      body: 'Customer requested refund',
      refund_amount: amount.toFixed(2),
    })
    const res = await fetch(`${this.baseUrl}/refunds/`, { method: 'POST', headers: this.headers, body })
    if (!res.ok) throw new Error('Instamojo refund failed')
    const data = await res.json()
    return { success: data.success, refundId: data.refund?.id, amount }
  }

  async getTransactions(): Promise<TransactionRecord[]> { return [] }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/payment-requests/?limit=1`, { headers: this.headers })
      return res.ok ? { success: true, message: 'Instamojo connection successful' } : { success: false, message: 'Invalid credentials' }
    } catch {
      return { success: false, message: 'Connection failed' }
    }
  }
}
