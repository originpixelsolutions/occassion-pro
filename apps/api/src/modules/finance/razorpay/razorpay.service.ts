import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as crypto from 'crypto'
// Razorpay types
interface RazorpayOrder {
  id: string
  amount: number
  currency: string
  receipt: string
  status: string
}

@Injectable()
export class RazorpayService {
  private readonly logger = new Logger(RazorpayService.name)
  private readonly keyId: string
  private readonly keySecret: string
  private readonly webhookSecret: string

  constructor(private readonly config: ConfigService) {
    this.keyId = config.getOrThrow<string>('razorpay.keyId')
    this.keySecret = config.getOrThrow<string>('razorpay.keySecret')
    this.webhookSecret = config.get<string>('razorpay.webhookSecret', '')
  }

  /**
   * Create a Razorpay order for ticket purchase or invoice
   */
  async createOrder(
    amountPaise: number, // Amount in paise (1 INR = 100 paise)
    currency: string = 'INR',
    receipt: string,
    notes: Record<string, string> = {},
  ): Promise<RazorpayOrder> {
    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: Math.round(amountPaise),
        currency,
        receipt,
        notes,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Razorpay order creation failed: ${JSON.stringify(error)}`)
    }

    return response.json()
  }

  /**
   * Create a Razorpay Payment Link for invoices
   */
  async createPaymentLink(params: {
    amount: number
    currency: string
    description: string
    customerName: string
    customerEmail: string
    customerPhone?: string
    callbackUrl: string
    referenceId: string
  }) {
    const response = await fetch('https://api.razorpay.com/v1/payment_links', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: Math.round(params.amount * 100), // Convert to paise
        currency: params.currency,
        description: params.description,
        customer: {
          name: params.customerName,
          email: params.customerEmail,
          ...(params.customerPhone ? { contact: params.customerPhone } : {}),
        },
        callback_url: params.callbackUrl,
        callback_method: 'get',
        reference_id: params.referenceId,
        notify: { sms: false, email: true },
        reminder_enable: true,
      }),
    })

    if (!response.ok) throw new Error('Razorpay payment link creation failed')
    return response.json()
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(body: string, signature: string): boolean {
    const expectedSignature = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(body)
      .digest('hex')
    return expectedSignature === signature
  }

  /**
   * Verify payment signature (client-side payment verification)
   */
  verifyPaymentSignature(
    orderId: string,
    paymentId: string,
    signature: string,
  ): boolean {
    const body = `${orderId}|${paymentId}`
    const expectedSignature = crypto
      .createHmac('sha256', this.keySecret)
      .update(body)
      .digest('hex')
    return expectedSignature === signature
  }

  /**
   * Initiate vendor payout via Razorpay Route
   */
  async createPayout(params: {
    fundAccountId: string
    amount: number
    currency: string
    purpose: string
    narration: string
    referenceId: string
  }) {
    const response = await fetch('https://api.razorpay.com/v1/payouts', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64')}`,
        'Content-Type': 'application/json',
        'X-Payout-Idempotency': params.referenceId,
      },
      body: JSON.stringify({
        account_number: process.env.RAZORPAY_ACCOUNT_NUMBER,
        fund_account_id: params.fundAccountId,
        amount: Math.round(params.amount * 100),
        currency: params.currency,
        mode: 'IMPS',
        purpose: params.purpose,
        queue_if_low_balance: true,
        narration: params.narration,
        reference_id: params.referenceId,
      }),
    })

    if (!response.ok) throw new Error('Razorpay payout failed')
    return response.json()
  }
}
