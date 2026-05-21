import {
  IPaymentProvider, PaymentLinkResult, PaymentVerifyResult, RefundResult,
  TransactionRecord, CreatePaymentLinkOptions,
} from '../interfaces/payment-provider.interface'

/**
 * ManualProvider — Default provider when no payment gateway is connected.
 *
 * Finance works 100% offline. Tenants record payments manually:
 * - amount, date, method (Cash/Cheque/NEFT/RTGS/UPI/Other), reference, notes
 *
 * createPaymentLink() throws — button should be hidden in UI when manual is the provider.
 * All other methods return sensible defaults.
 */
export class ManualProvider implements IPaymentProvider {
  readonly providerName = 'manual'
  readonly supportedCurrencies = ['*'] // any currency

  async createPaymentLink(_opts: CreatePaymentLinkOptions): Promise<PaymentLinkResult> {
    throw new Error('Manual payment provider does not support payment links. Record payments manually.')
  }

  async verifyPayment(_paymentId: string): Promise<PaymentVerifyResult> {
    return { status: 'pending', amount: 0, currency: 'INR', timestamp: new Date(), providerPaymentId: _paymentId }
  }

  async refund(_paymentId: string, amount: number): Promise<RefundResult> {
    // Manual refund — just mark it in the system
    return { success: true, amount }
  }

  async getTransactions(): Promise<TransactionRecord[]> {
    return []
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    return { success: true, message: 'Manual/offline mode — no connection required' }
  }
}
