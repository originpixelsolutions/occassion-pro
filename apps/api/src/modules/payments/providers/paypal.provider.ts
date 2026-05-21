import {
  IPaymentProvider, PaymentLinkResult, PaymentVerifyResult, RefundResult,
  TransactionRecord, CreatePaymentLinkOptions, TenantPaymentCredentials,
} from '../interfaces/payment-provider.interface'

export class PayPalProvider implements IPaymentProvider {
  readonly providerName = 'paypal'
  readonly supportedCurrencies = ['USD', 'EUR', 'GBP', 'AUD', 'CAD', 'INR', 'SGD', 'AED']

  constructor(private readonly credentials: TenantPaymentCredentials) {}

  private get baseUrl() {
    return this.credentials.test_mode
      ? 'https://api-m.sandbox.paypal.com'
      : 'https://api-m.paypal.com'
  }

  private async getAccessToken(): Promise<string> {
    const creds = Buffer.from(
      `${this.credentials.paypal_client_id}:${this.credentials.paypal_client_secret}`,
    ).toString('base64')

    const res = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${creds}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    })

    if (!res.ok) throw new Error('PayPal auth failed')
    const data = await res.json()
    return data.access_token
  }

  async createPaymentLink(opts: CreatePaymentLinkOptions): Promise<PaymentLinkResult> {
    const token = await this.getAccessToken()
    const amount = (opts.amount / 100).toFixed(2) // convert smallest unit to major

    const body = {
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: opts.invoiceId,
          description: opts.description,
          amount: {
            currency_code: opts.currency,
            value: amount,
          },
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            payment_method_preference: 'IMMEDIATE_PAYMENT_REQUIRED',
            brand_name: 'OccasionPro',
            locale: 'en-US',
            landing_page: 'LOGIN',
            user_action: 'PAY_NOW',
            return_url: `${opts.callbackUrl}?status=success`,
            cancel_url: `${opts.callbackUrl}?status=cancel`,
          },
        },
      },
    }

    const res = await fetch(`${this.baseUrl}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'PayPal-Request-Id': `ORDER-${opts.invoiceId}-${Date.now()}`,
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const err = await res.json()
      throw new Error(`PayPal error: ${JSON.stringify(err)}`)
    }

    const data = await res.json()
    const approveLink = data.links?.find((l: { rel: string; href: string }) => l.rel === 'payer-action')?.href
      ?? data.links?.find((l: { rel: string; href: string }) => l.rel === 'approve')?.href

    if (!approveLink) throw new Error('PayPal did not return approval URL')

    return { url: approveLink, paymentId: data.id, provider: 'paypal' }
  }

  async verifyPayment(orderId: string): Promise<PaymentVerifyResult> {
    const token = await this.getAccessToken()
    const res = await fetch(`${this.baseUrl}/v2/checkout/orders/${orderId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!res.ok) throw new Error('PayPal verify failed')
    const data = await res.json()

    const statusMap: Record<string, PaymentVerifyResult['status']> = {
      COMPLETED: 'paid',
      APPROVED: 'pending',
      CREATED: 'pending',
      SAVED: 'pending',
      VOIDED: 'failed',
      PAYER_ACTION_REQUIRED: 'pending',
    }

    const unit = data.purchase_units?.[0]
    const capture = unit?.payments?.captures?.[0]

    return {
      status: statusMap[data.status] ?? 'pending',
      amount: parseFloat(capture?.amount?.value ?? unit?.amount?.value ?? '0'),
      currency: capture?.amount?.currency_code ?? unit?.amount?.currency_code ?? opts_currency(data),
      timestamp: new Date(capture?.create_time ?? data.create_time ?? Date.now()),
      providerPaymentId: capture?.id ?? orderId,
      method: 'paypal',
    }
  }

  async refund(captureId: string, amount: number): Promise<RefundResult> {
    const token = await this.getAccessToken()

    const body: Record<string, unknown> = {}
    if (amount > 0) {
      body.amount = { value: (amount / 100).toFixed(2), currency_code: 'USD' }
    }

    const res = await fetch(`${this.baseUrl}/v2/payments/captures/${captureId}/refund`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'PayPal-Request-Id': `REFUND-${captureId}-${Date.now()}`,
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) throw new Error('PayPal refund failed')
    const data = await res.json()

    return {
      success: data.status === 'COMPLETED' || data.status === 'PENDING',
      refundId: data.id,
      amount,
    }
  }

  async getTransactions(limit = 20): Promise<TransactionRecord[]> {
    try {
      const token = await this.getAccessToken()
      const endDate = new Date().toISOString()
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

      const res = await fetch(
        `${this.baseUrl}/v1/reporting/transactions?start_date=${startDate}&end_date=${endDate}&page_size=${limit}`,
        { headers: { Authorization: `Bearer ${token}` } },
      )

      if (!res.ok) return []
      const data = await res.json()

      return (data.transaction_details ?? []).map((t: Record<string, Record<string, string>>) => ({
        id: t.transaction_info?.transaction_id,
        amount: parseFloat(t.transaction_info?.transaction_amount?.value ?? '0'),
        currency: t.transaction_info?.transaction_amount?.currency_code,
        status: t.transaction_info?.transaction_status === 'S' ? 'paid' : 'pending',
        createdAt: new Date(t.transaction_info?.transaction_initiation_date ?? Date.now()),
        customerEmail: t.payer_info?.email_address,
        customerName: `${t.payer_info?.payer_name?.given_name ?? ''} ${t.payer_info?.payer_name?.surname ?? ''}`.trim(),
      }))
    } catch {
      return []
    }
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      await this.getAccessToken()
      return { success: true, message: 'PayPal connection successful' }
    } catch {
      return { success: false, message: 'PayPal authentication failed — check Client ID and Secret' }
    }
  }
}

// helper: extract currency from order object when capture not present
function opts_currency(data: Record<string, unknown>): string {
  const units = data.purchase_units as Array<{ amount?: { currency_code?: string } }> | undefined
  return units?.[0]?.amount?.currency_code ?? 'USD'
}
