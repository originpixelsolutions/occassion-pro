import { createHash } from 'crypto'
import {
  IPaymentProvider, PaymentLinkResult, PaymentVerifyResult, RefundResult,
  TransactionRecord, CreatePaymentLinkOptions, TenantPaymentCredentials,
} from '../interfaces/payment-provider.interface'

export class PayUProvider implements IPaymentProvider {
  readonly providerName = 'payu'
  readonly supportedCurrencies = ['INR']

  constructor(private readonly credentials: TenantPaymentCredentials) {}

  private get baseUrl() {
    return this.credentials.test_mode ? 'https://test.payu.in' : 'https://secure.payu.in'
  }

  private generateHash(txnId: string, amount: number, productInfo: string, firstname: string, email: string): string {
    const key = this.credentials.payu_merchant_key!
    const salt = this.credentials.payu_salt!
    const str = `${key}|${txnId}|${amount.toFixed(2)}|${productInfo}|${firstname}|${email}|||||||||||${salt}`
    return createHash('sha512').update(str).digest('hex')
  }

  async createPaymentLink(opts: CreatePaymentLinkOptions): Promise<PaymentLinkResult> {
    const txnId = `TXN${opts.invoiceId.replace(/-/g, '').slice(0, 12)}${Date.now()}`
    const amount = opts.amount / 100 // PayU expects rupees, not paise
    const hash = this.generateHash(txnId, amount, opts.description, opts.customerName ?? 'Customer', opts.customerEmail ?? '')

    const params = new URLSearchParams({
      key: this.credentials.payu_merchant_key!,
      txnid: txnId,
      amount: amount.toFixed(2),
      productinfo: opts.description,
      firstname: opts.customerName ?? 'Customer',
      email: opts.customerEmail ?? '',
      phone: opts.customerPhone ?? '',
      surl: `${opts.callbackUrl}?status=success`,
      furl: `${opts.callbackUrl}?status=failed`,
      hash,
    })

    // PayU uses a form POST redirect, so we return the POST URL + params
    const url = `${this.baseUrl}/_payment?${params.toString()}`
    return { url, paymentId: txnId, provider: 'payu' }
  }

  async verifyPayment(txnId: string): Promise<PaymentVerifyResult> {
    // PayU verification via transaction query API
    const hash = createHash('sha512').update(`${this.credentials.payu_merchant_key}|verify_payment|${txnId}|${this.credentials.payu_salt}`).digest('hex')
    const body = new URLSearchParams({ key: this.credentials.payu_merchant_key!, command: 'verify_payment', var1: txnId, hash })
    const res = await fetch(`${this.baseUrl}/merchant/postservice.php?form=2`, { method: 'POST', body })
    if (!res.ok) throw new Error('PayU verify failed')
    const data = await res.json()
    const txn = data.transaction_details?.[txnId]
    return {
      status: txn?.status === 'success' ? 'paid' : 'pending',
      amount: parseFloat(txn?.amt ?? '0'),
      currency: 'INR',
      timestamp: new Date(txn?.addedon ?? Date.now()),
      providerPaymentId: txn?.mihpayid ?? txnId,
      method: txn?.mode,
    }
  }

  async refund(txnId: string, amount: number): Promise<RefundResult> {
    const hash = createHash('sha512').update(`${this.credentials.payu_merchant_key}|cancel_refund_transaction|${txnId}|${amount.toFixed(2)}|${this.credentials.payu_salt}`).digest('hex')
    const body = new URLSearchParams({ key: this.credentials.payu_merchant_key!, command: 'cancel_refund_transaction', var1: txnId, var2: `REF${Date.now()}`, var3: amount.toFixed(2), hash })
    const res = await fetch(`${this.baseUrl}/merchant/postservice.php?form=2`, { method: 'POST', body })
    if (!res.ok) throw new Error('PayU refund failed')
    const data = await res.json()
    return { success: data.status === '0', amount }
  }

  async getTransactions(limit = 20): Promise<TransactionRecord[]> {
    return [] // PayU transaction history requires date range queries — implement as needed
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const hash = createHash('sha512').update(`${this.credentials.payu_merchant_key}|get_merchant_ibibo_codes||${this.credentials.payu_salt}`).digest('hex')
      const body = new URLSearchParams({ key: this.credentials.payu_merchant_key!, command: 'get_merchant_ibibo_codes', var1: 'default', hash })
      const res = await fetch(`${this.baseUrl}/merchant/postservice.php?form=2`, { method: 'POST', body })
      return res.ok ? { success: true, message: 'PayU connection successful' } : { success: false, message: 'Invalid credentials' }
    } catch {
      return { success: false, message: 'Connection failed' }
    }
  }
}
