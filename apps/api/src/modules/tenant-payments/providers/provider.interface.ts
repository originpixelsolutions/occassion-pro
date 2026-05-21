export interface CreateOrderPayload {
  orderRef: string
  amount: number          // in smallest currency unit (paise / cents)
  currency: string
  description: string
  guestName: string
  guestEmail: string
  guestPhone?: string
  receipt?: string
  notes?: Record<string, string>
  callbackUrl?: string
}

export interface OrderResult {
  providerOrderId: string
  checkoutPayload: Record<string, unknown>  // sent to frontend for SDK init
}

export interface VerifyPaymentPayload {
  providerOrderId: string
  providerPaymentId: string
  signature?: string
  rawBody?: string
  headers?: Record<string, string>
}

export interface VerifyResult {
  verified: boolean
  paymentMethod?: string
  providerMetadata?: Record<string, unknown>
}

export interface RefundPayload {
  providerPaymentId: string
  amount: number
  reason?: string
  refundRef: string
}

export interface RefundResult {
  providerRefundId: string
  status: 'pending' | 'processing' | 'completed'
}

export interface OrderStatusResult {
  status: 'pending' | 'paid' | 'failed' | 'cancelled'
  providerMetadata?: Record<string, unknown>
}

export interface ITenantPaymentProvider {
  createOrder(payload: CreateOrderPayload, config: Record<string, string>): Promise<OrderResult>
  verifyPayment(payload: VerifyPaymentPayload, config: Record<string, string>): Promise<VerifyResult>
  initiateRefund(payload: RefundPayload, config: Record<string, string>): Promise<RefundResult>
  getOrderStatus(providerOrderId: string, config: Record<string, string>): Promise<OrderStatusResult>
}
