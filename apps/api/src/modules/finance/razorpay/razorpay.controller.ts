import { Controller, Post, Body, Headers, RawBodyRequest, Req } from '@nestjs/common'
import { ApiTags, ApiOperation } from '@nestjs/swagger'
import { Public } from '../../../common/decorators/public.decorator'
import { RazorpayService } from './razorpay.service'
import { SupabaseService } from '../../../common/supabase/supabase.service'
import type { FastifyRequest } from 'fastify'

@ApiTags('Finance')
@Controller({ path: 'webhooks/razorpay', version: '1' })
export class RazorpayController {
  constructor(
    private readonly razorpay: RazorpayService,
    private readonly supabase: SupabaseService,
  ) {}

  @Public()
  @Post()
  @ApiOperation({ summary: 'Razorpay webhook handler' })
  async handleWebhook(
    @Body() body: any,
    @Headers('x-razorpay-signature') signature: string,
    @Req() req: FastifyRequest,
  ) {
    const rawBody = JSON.stringify(body)
    const isValid = this.razorpay.verifyWebhookSignature(rawBody, signature)
    if (!isValid) return { received: false, reason: 'invalid signature' }

    const { event, payload } = body

    switch (event) {
      case 'payment.captured': {
        const payment = payload.payment.entity
        // Update payment record in Supabase
        await this.supabase.serviceClient
          .from('payments')
          .update({ status: 'completed', completed_at: new Date().toISOString() })
          .eq('razorpay_payment_id', payment.id)
        break
      }
      case 'payment.failed': {
        const payment = payload.payment.entity
        await this.supabase.serviceClient
          .from('payments')
          .update({ status: 'failed' })
          .eq('razorpay_payment_id', payment.id)
        break
      }
      case 'order.paid': {
        const order = payload.order.entity
        // Update ticket purchase status
        await this.supabase.serviceClient
          .from('ticket_purchases')
          .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
          .eq('razorpay_order_id', order.id)
        break
      }
    }

    return { received: true }
  }
}
