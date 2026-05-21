import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common'
import { SupabaseService } from '../../common/supabase/supabase.service'
import {
  IPaymentProvider, TenantPaymentCredentials, PaymentProviderName,
  PAYMENT_PROVIDERS, PROVIDER_FIELD_CONFIG, PROVIDER_DISPLAY_CONFIG,
  CreatePaymentLinkOptions,
} from './interfaces/payment-provider.interface'
import { RazorpayProvider } from './providers/razorpay.provider'
import { StripeProvider } from './providers/stripe.provider'
import { PayUProvider } from './providers/payu.provider'
import { CashfreeProvider } from './providers/cashfree.provider'
import { InstamojoProvider } from './providers/instamojo.provider'
import { PayPalProvider } from './providers/paypal.provider'
import { ManualProvider } from './providers/manual.provider'

/**
 * PaymentService — Resolves the correct payment provider at runtime.
 *
 * Finance works 100% without any provider.
 * Tenant selects provider in workspace settings.
 * "Send Payment Link" is hidden when manual is the provider.
 * "Record Payment" (offline) is always visible.
 */
@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name)

  constructor(private readonly supabase: SupabaseService) {}

  private get db() { return this.supabase.serviceClient }

  // ─── Provider Resolution ──────────────────────────────────────────────────

  private resolveProvider(credentials: TenantPaymentCredentials): IPaymentProvider {
    switch (credentials.provider) {
      case PAYMENT_PROVIDERS.RAZORPAY:   return new RazorpayProvider(credentials)
      case PAYMENT_PROVIDERS.STRIPE:     return new StripeProvider(credentials)
      case PAYMENT_PROVIDERS.PAYU:       return new PayUProvider(credentials)
      case PAYMENT_PROVIDERS.CASHFREE:   return new CashfreeProvider(credentials)
      case PAYMENT_PROVIDERS.INSTAMOJO:  return new InstamojoProvider(credentials)
      case PAYMENT_PROVIDERS.PAYPAL:     return new PayPalProvider(credentials)
      case PAYMENT_PROVIDERS.MANUAL:
      default:                           return new ManualProvider()
    }
  }

  async getProvider(tenantId: string): Promise<IPaymentProvider> {
    const { data } = await this.db
      .from('tenant_payment_config')
      .select('*')
      .eq('tenant_id', tenantId)
      .single()

    if (!data || !data.provider || data.provider === PAYMENT_PROVIDERS.MANUAL) {
      return new ManualProvider()
    }

    // Credentials are fetched from Vault in production
    // For now, read from tenant_payment_config (keys should be encrypted at rest via Vault)
    const credentials: TenantPaymentCredentials = {
      provider: data.provider as PaymentProviderName,
      razorpay_key_id: data.razorpay_key_id,
      razorpay_key_secret: data.razorpay_key_secret,
      stripe_publishable_key: data.stripe_publishable_key,
      stripe_secret_key: data.stripe_secret_key,
      payu_merchant_key: data.payu_merchant_key,
      payu_salt: data.payu_salt,
      cashfree_app_id: data.cashfree_app_id,
      cashfree_secret_key: data.cashfree_secret_key,
      paypal_client_id: data.paypal_client_id,
      paypal_client_secret: data.paypal_client_secret,
      instamojo_api_key: data.instamojo_api_key,
      instamojo_auth_token: data.instamojo_auth_token,
      test_mode: data.test_mode ?? false,
    }

    return this.resolveProvider(credentials)
  }

  // ─── Tenant Payment Config ────────────────────────────────────────────────

  async getConfig(tenantId: string) {
    const { data } = await this.db
      .from('tenant_payment_config')
      .select('tenant_id, provider, test_mode, payment_enabled, last_payment_at')
      .eq('tenant_id', tenantId)
      .single()
    return {
      ...data,
      isConnected: !!data && data.provider !== PAYMENT_PROVIDERS.MANUAL,
      providerConfig: PROVIDER_DISPLAY_CONFIG[data?.provider as PaymentProviderName ?? 'manual'],
    }
  }

  async saveConfig(tenantId: string, body: Record<string, unknown>): Promise<void> {
    const { data, error } = await this.db
      .from('tenant_payment_config')
      .upsert({ ...body, tenant_id: tenantId, updated_at: new Date().toISOString() }, { onConflict: 'tenant_id' })
      .select()
    if (error) throw error
  }

  async disconnectProvider(tenantId: string): Promise<void> {
    await this.db.from('tenant_payment_config').upsert({
      tenant_id: tenantId,
      provider: PAYMENT_PROVIDERS.MANUAL,
      razorpay_key_id: null, razorpay_key_secret: null,
      stripe_publishable_key: null, stripe_secret_key: null,
      payu_merchant_key: null, payu_salt: null,
      cashfree_app_id: null, cashfree_secret_key: null,
      paypal_client_id: null, paypal_client_secret: null,
      instamojo_api_key: null, instamojo_auth_token: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'tenant_id' })
  }

  async testConnection(tenantId: string): Promise<{ success: boolean; message: string }> {
    const provider = await this.getProvider(tenantId)
    return provider.testConnection()
  }

  // ─── Payment Link ─────────────────────────────────────────────────────────

  async createPaymentLink(tenantId: string, opts: CreatePaymentLinkOptions) {
    const provider = await this.getProvider(tenantId)
    if (provider.providerName === PAYMENT_PROVIDERS.MANUAL) {
      throw new BadRequestException('No payment provider connected. Record payment manually.')
    }

    const result = await provider.createPaymentLink(opts)

    // Record payment attempt in invoice
    await this.db.from('invoice_payment_attempts').insert({
      invoice_id: opts.invoiceId,
      provider: provider.providerName,
      provider_payment_id: result.paymentId,
      amount: opts.amount / 100,
      currency: opts.currency,
      status: 'pending',
      payment_url: result.url,
      created_at: new Date().toISOString(),
    }).select()

    return result
  }

  // ─── Offline Payment Recording ────────────────────────────────────────────
  // Always available regardless of payment provider

  async recordOfflinePayment(tenantId: string, data: {
    invoiceId: string
    amount: number
    currency?: string
    method: 'cash' | 'cheque' | 'neft' | 'rtgs' | 'upi' | 'other'
    referenceNumber?: string
    paymentDate: string
    notes?: string
    receivedBy?: string
  }) {
    const { data: payment, error } = await this.db.from('invoice_payments').insert({
      invoice_id: data.invoiceId,
      tenant_id: tenantId,
      amount: data.amount,
      currency: data.currency ?? 'INR',
      method: data.method,
      reference_number: data.referenceNumber,
      payment_date: data.paymentDate,
      notes: data.notes,
      received_by: data.receivedBy,
      is_offline: true,
      status: 'confirmed',
      created_at: new Date().toISOString(),
    }).select().single()

    if (error) throw error

    // Recalculate invoice payment status
    await this.updateInvoicePaymentStatus(data.invoiceId)
    return payment
  }

  private async updateInvoicePaymentStatus(invoiceId: string) {
    const [invoiceRes, paymentsRes] = await Promise.all([
      this.db.from('invoices').select('total_amount').eq('id', invoiceId).single(),
      this.db.from('invoice_payments').select('amount').eq('invoice_id', invoiceId).eq('status', 'confirmed'),
    ])

    if (!invoiceRes.data) return
    const totalPaid = (paymentsRes.data ?? []).reduce((s, p) => s + Number(p.amount ?? 0), 0)
    const totalDue = Number(invoiceRes.data.total_amount ?? 0)
    const status = totalPaid >= totalDue ? 'paid' : totalPaid > 0 ? 'partial' : 'unpaid'

    await this.db.from('invoices').update({ status, amount_paid: totalPaid, paid_at: status === 'paid' ? new Date().toISOString() : null }).eq('id', invoiceId)
  }

  // ─── Invoice Payment History ──────────────────────────────────────────────

  async getInvoicePayments(tenantId: string, invoiceId: string) {
    const { data, error } = await this.db
      .from('invoice_payments')
      .select('*')
      .eq('invoice_id', invoiceId)
      .eq('tenant_id', tenantId)
      .eq('status', 'confirmed')
      .order('payment_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) throw error
    return data ?? []
  }

  // ─── Provider Metadata (for UI) ───────────────────────────────────────────

  getProvidersList() {
    return Object.entries(PROVIDER_DISPLAY_CONFIG).map(([key, config]) => ({
      id: key as PaymentProviderName,
      ...config,
      fields: PROVIDER_FIELD_CONFIG[key as PaymentProviderName],
    }))
  }
}
