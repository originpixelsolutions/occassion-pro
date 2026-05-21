import {
  Controller, Get, Post, Body, Req, UseGuards, HttpCode, RawBodyRequest,
  Headers, BadRequestException,
} from '@nestjs/common'
import { JwtAuthGuard } from '../../guards/jwt-auth.guard'
import { RolesGuard, Roles } from '../../guards/roles.guard'
import { Public } from '../../guards/jwt-auth.guard'
import { SubscriptionService, PlanSlug } from './subscription.service'

@Controller('subscription')
export class SubscriptionController {
  constructor(private readonly svc: SubscriptionService) {}

  // ── PUBLIC ────────────────────────────────────────────────────────────────

  /** GET /subscription/plans — all public plans (no auth required) */
  @Get('plans')
  listPlans() {
    return this.svc.listPlans()
  }

  /** POST /subscription/webhook/razorpay — raw body required for HMAC */
  @Post('webhook/razorpay')
  @Public()
  @HttpCode(200)
  async razorpayWebhook(
    @Req() req: RawBodyRequest<any>,
    @Headers('x-razorpay-signature') signature: string,
  ) {
    if (!req.rawBody) throw new BadRequestException('Raw body missing')
    await this.svc.handleRazorpayWebhook(req.rawBody, signature ?? '')
    return { received: true }
  }

  // ── AUTHENTICATED ─────────────────────────────────────────────────────────

  /** GET /subscription/current — tenant's current plan + usage */
  @Get('current')
  @UseGuards(JwtAuthGuard, RolesGuard)
  getCurrent(@Req() req: any) {
    return this.svc.getTenantPlan(req.user.tenantId)
  }

  /** POST /subscription/checkout-order — create Razorpay order for upgrade */
  @Post('checkout-order')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('workspace_owner')
  createCheckoutOrder(
    @Req() req: any,
    @Body() body: { plan: PlanSlug; billing_period?: 'monthly' | 'yearly' },
  ) {
    return this.svc.createCheckoutOrder(
      req.user.tenantId,
      body.plan,
      body.billing_period ?? 'monthly',
    )
  }

  /** POST /subscription/trial — start 14-day Growth trial */
  @Post('trial')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('workspace_owner')
  startTrial(@Req() req: any, @Body() body: { plan?: string }) {
    return this.svc.startTrial(req.user.tenantId, body.plan ?? 'growth')
  }

  /** POST /subscription/cancel */
  @Post('cancel')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('workspace_owner')
  cancel(@Req() req: any, @Body() body: { reason?: string }) {
    return this.svc.cancelSubscription(req.user.tenantId, req.user.id, body.reason)
  }

  /** POST /subscription/refresh-usage — update usage counters */
  @Post('refresh-usage')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard, RolesGuard)
  refreshUsage(@Req() req: any) {
    return this.svc.refreshUsage(req.user.tenantId)
  }
}
