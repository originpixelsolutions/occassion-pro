import { Injectable } from '@nestjs/common'
import {
  ITenantPaymentProvider, CreateOrderPayload, OrderResult,
  VerifyPaymentPayload, VerifyResult, RefundPayload, RefundResult, OrderStatusResult,
} from './provider.interface'

/**
 * Manual / offline payment provider.
 * Orders are created and must be marked paid manually by an admin.
 * No external API calls are made.
 */
@Injectable()
export class ManualProvider implements ITenantPaymentProvider {
  async createOrder(payload: CreateOrderPayload, _config: Record<string, string>): Promise<OrderResult> {
    return {
      providerOrderId: `MANUAL-${payload.orderRef}`,
      checkoutPayload: {
        type: 'manual',
        orderRef: payload.orderRef,
        instructions: _config.instructions ?? 'Please transfer the amount and share the reference.',
        bankDetails: _config.bank_details ?? '',
        upiId: _config.upi_id ?? '',
        amount: payload.amount,
        currency: payload.currency,
      },
    }
  }

  async verifyPayment(_payload: VerifyPaymentPayload, _config: Record<string, string>): Promise<VerifyResult> {
    // Manual payments are verified by admin action, not signature
    return { verified: true, paymentMethod: 'manual' }
  }

  async initiateRefund(payload: RefundPayload, _config: Record<string, string>): Promise<RefundResult> {
    return {
      providerRefundId: `MANUAL-REFUND-${payload.refundRef}`,
      status: 'pending',
    }
  }

  async getOrderStatus(providerOrderId: string, _config: Record<string, string>): Promise<OrderStatusResult> {
    return { status: 'pending' }
  }
}
