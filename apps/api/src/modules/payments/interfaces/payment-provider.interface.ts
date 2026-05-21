/**
 * Payment Provider Interface — Pluggable architecture.
 *
 * Tenants can connect ANY provider or use offline-only (default).
 * Finance module works 100% without any provider connected.
 *
 * Supported providers: Razorpay, Stripe, PayU, Cashfree, PayPal, Instamojo, Manual
 */

export interface PaymentLinkResult {
  url: string
  paymentId: string
  provider: string
  expiresAt?: Date
}

export interface PaymentVerifyResult {
  status: 'paid' | 'pending' | 'failed' | 'refunded'
  amount: number
  currency: string
  timestamp: Date
  providerPaymentId: string
  method?: string
}

export interface RefundResult {
  success: boolean
  refundId?: string
  amount: number
}

export interface TransactionRecord {
  id: string
  amount: number
  currency: string
  status: string
  method?: string
  createdAt: Date
  description?: string
}

export interface CreatePaymentLinkOptions {
  amount: number          // in smallest currency unit (paise for INR, cents for USD)
  currency: string        // 'INR' | 'USD' | 'EUR' | 'GBP' | 'AED'
  description: string
  invoiceId: string
  customerName?: string
  customerEmail?: string
  customerPhone?: string
  callbackUrl?: string
  expiryMinutes?: number
}

export interface IPaymentProvider {
  readonly providerName: string
  readonly supportedCurrencies: string[]

  createPaymentLink(options: CreatePaymentLinkOptions): Promise<PaymentLinkResult>
  verifyPayment(paymentId: string): Promise<PaymentVerifyResult>
  refund(paymentId: string, amount: number): Promise<RefundResult>
  getTransactions(limit?: number): Promise<TransactionRecord[]>
  testConnection(): Promise<{ success: boolean; message: string }>
}

// Provider name enum — matches tenant_payment_config.provider column
export const PAYMENT_PROVIDERS = {
  RAZORPAY: 'razorpay',
  STRIPE: 'stripe',
  PAYU: 'payu',
  CASHFREE: 'cashfree',
  PAYPAL: 'paypal',
  INSTAMOJO: 'instamojo',
  MANUAL: 'manual',   // offline only — always available
} as const

export type PaymentProviderName = typeof PAYMENT_PROVIDERS[keyof typeof PAYMENT_PROVIDERS]

export interface TenantPaymentCredentials {
  provider: PaymentProviderName
  // Razorpay
  razorpay_key_id?: string
  razorpay_key_secret?: string
  // Stripe
  stripe_publishable_key?: string
  stripe_secret_key?: string
  // PayU
  payu_merchant_key?: string
  payu_salt?: string
  // Cashfree
  cashfree_app_id?: string
  cashfree_secret_key?: string
  // PayPal
  paypal_client_id?: string
  paypal_client_secret?: string
  // Instamojo
  instamojo_api_key?: string
  instamojo_auth_token?: string
  // Shared
  test_mode?: boolean
  webhook_secret?: string
}

/**
 * Returns the credential field labels for each provider — used in workspace settings UI.
 */
export const PROVIDER_FIELD_CONFIG: Record<PaymentProviderName, Array<{ key: string; label: string; isSecret: boolean }>> = {
  razorpay: [
    { key: 'razorpay_key_id', label: 'Key ID', isSecret: false },
    { key: 'razorpay_key_secret', label: 'Key Secret', isSecret: true },
  ],
  stripe: [
    { key: 'stripe_publishable_key', label: 'Publishable Key', isSecret: false },
    { key: 'stripe_secret_key', label: 'Secret Key', isSecret: true },
  ],
  payu: [
    { key: 'payu_merchant_key', label: 'Merchant Key', isSecret: false },
    { key: 'payu_salt', label: 'Salt', isSecret: true },
  ],
  cashfree: [
    { key: 'cashfree_app_id', label: 'App ID', isSecret: false },
    { key: 'cashfree_secret_key', label: 'Secret Key', isSecret: true },
  ],
  paypal: [
    { key: 'paypal_client_id', label: 'Client ID', isSecret: false },
    { key: 'paypal_client_secret', label: 'Client Secret', isSecret: true },
  ],
  instamojo: [
    { key: 'instamojo_api_key', label: 'API Key', isSecret: false },
    { key: 'instamojo_auth_token', label: 'Auth Token', isSecret: true },
  ],
  manual: [],
}

export const PROVIDER_DISPLAY_CONFIG: Record<PaymentProviderName, { name: string; logo: string; currencies: string[]; region: string }> = {
  razorpay:   { name: 'Razorpay', logo: '/providers/razorpay.svg', currencies: ['INR'], region: 'India' },
  stripe:     { name: 'Stripe', logo: '/providers/stripe.svg', currencies: ['INR', 'USD', 'EUR', 'GBP', 'AED'], region: 'International' },
  payu:       { name: 'PayU', logo: '/providers/payu.svg', currencies: ['INR'], region: 'India' },
  cashfree:   { name: 'Cashfree', logo: '/providers/cashfree.svg', currencies: ['INR'], region: 'India' },
  paypal:     { name: 'PayPal', logo: '/providers/paypal.svg', currencies: ['USD', 'EUR', 'GBP', 'AED', 'INR'], region: 'International' },
  instamojo:  { name: 'Instamojo', logo: '/providers/instamojo.svg', currencies: ['INR'], region: 'India' },
  manual:     { name: 'Manual / Offline', logo: '', currencies: ['*'], region: 'Any' },
}
