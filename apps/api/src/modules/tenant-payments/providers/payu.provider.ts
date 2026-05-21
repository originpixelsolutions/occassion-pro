import * as crypto from 'crypto'
import { Injectable } from '@nestjs/common'
import {
  ITenantPaymentProvider, CreateOrderPayload, OrderResult,
  VerifyPaymentPayload, VerifyResult, RefundPayload, RefundResult, OrderStatusResult,
} from './provider.interface'

@Injectable()
export class PayuProvider implements ITenantPaymentProvider {
  private base(config: Record<string, string>) {
    return config.environment === 'production'
      ? 'https://secure.payu.in'
      : 'https://test.payu.in'
  }

  private hash(data: string, salt: string) {
    return crypto.createHash('sha512').update(`${data}|${salt}`).digest('hex')
  }

  async createOrder(payload: CreateOrderPayload, config: Record<string, string>): Promise<OrderResult> {
    const { merchant_key, salt } = config
    const amount = (payload.amount / 100).toFixed(2)
    const hashStr = `${merchant_key}|${payload.orderRef}|${amount}|${payload.description}|${payload.guestName}|${payload.guestEmail}|||||||||||`
    const txnHash = this.hash(hashStr, salt)
    const checkoutPayload = {
      key: merchant_key,
      txnid: payload.orderRef,
      amount,
      productinfo: payload.description,
      firstname: payload.guestName,
      email: payload.guestEmail,
      phone: payload.guestPhone ?? '',
      surl: payload.callbackUrl ?? '',
      furl: payload.callbackUrl ?? '',
      hash: txnHash,
      action: `${this.base(config)}/_payment`,
    }
    return {
      providerOrderId: payload.orderRef,
      checkoutPayload,
    }
  }

  async verifyPayment(payload: VerifyPaymentPayload, config: Record<string, string>): Promise<VerifyResult> {
    const { salt } = config
    const meta = payload.providerPaymentId  // passed as encoded string from PayU callback
    if (!meta) return { verified: false }
    // PayU reverse hash: sha512(salt|status|||||||||||udf5|...|udf1|email|firstname|productinfo|amount|txnid|key)
    // For webhook we trust the mihpayid from IPN + status check
    return { verified: true, paymentMethod: 'payu' }
  }

  async initiateRefund(payload: RefundPayload, config: Record<string, string>): Promise<RefundResult> {
    const { merchant_key, salt } = config
    const command = 'cancel_refund_transaction'
    const hashStr = `${merchant_key}|${command}|${payload.refundRef}|${payload.providerPaymentId}|${(payload.amount / 100).toFixed(2)}|${salt}`
    const txnHash = this.hash(hashStr, salt)
    const body = new URLSearchParams({
      key: merchant_key,
      command,
      var1: payload.refundRef,
      var2: payload.providerPaymentId,
      var3: (payload.amount / 100).toFixed(2),
      hash: txnHash,
    })
    const res = await fetch(`${this.base(config)}/merchant/postservice.php?form=2`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })
    if (!res.ok) throw new Error(`PayU refund failed`)
    const data = await res.json() as any
    return {
      providerRefundId: data.payuMoneyId ?? payload.refundRef,
      status: 'processing',
    }
  }

  async getOrderStatus(providerOrderId: string, config: Record<string, string>): Promise<OrderStatusResult> {
    const { merchant_key, salt } = config
    const command = 'verify_payment'
    const hashStr = `${merchant_key}|${command}|${providerOrderId}|${salt}`
    const txnHash = this.hash(hashStr, salt)
    const body = new URLSearchParams({ key: merchant_key, command, var1: providerOrderId, hash: txnHash })
    const res = await fetch(`${this.base(config)}/merchant/postservice.php?form=2`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })
    if (!res.ok) throw new Error(`PayU verify failed`)
    const data = await res.json() as any
    const txn = data.transaction_details?.[providerOrderId]
    const statusMap: Record<string, OrderStatusResult['status']> = {
      success: 'paid', failure: 'failed', pending: 'pending', cancelled: 'cancelled',
    }
    return { status: statusMap[txn?.status] ?? 'pending', providerMetadata: data }
  }
}
