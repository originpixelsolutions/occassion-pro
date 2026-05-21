import {
  Controller, Get, Post, Patch, Delete, Param, Body, Query,
  UseGuards, HttpCode, HttpStatus, Headers, RawBodyRequest, Req,
} from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { Request } from 'express'
import { TenantPaymentsService } from './tenant-payments.service'
import { AuthGuard } from '../../common/guards/auth.guard'
import { TenantId, AccessToken, CurrentUserId } from '../../common/decorators/tenant.decorator'

@ApiTags('Tenant Payments')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard)
@Controller({ version: '1' })
export class TenantPaymentsController {
  constructor(private readonly svc: TenantPaymentsService) {}

  // ── Gateway Config ────────────────────────────────────────────────────────────

  @Get('tenants/:tenantId/gateways')
  listGateways(
    @Param('tenantId') tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.svc.listGateways(tenantId, token)
  }

  @Post('tenants/:tenantId/gateways')
  upsertGateway(
    @Param('tenantId') tenantId: string,
    @Body() dto: any,
    @AccessToken() token: string,
  ) {
    return this.svc.upsertGateway(tenantId, dto, token)
  }

  @Delete('tenants/:tenantId/gateways/:gatewayId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteGateway(
    @Param('tenantId') tenantId: string,
    @Param('gatewayId') gatewayId: string,
    @AccessToken() token: string,
  ) {
    return this.svc.deleteGateway(gatewayId, tenantId, token)
  }

  @Post('tenants/:tenantId/gateways/:gatewayId/test')
  testGateway(
    @Param('tenantId') tenantId: string,
    @Param('gatewayId') gatewayId: string,
    @AccessToken() token: string,
  ) {
    return this.svc.testGateway(gatewayId, tenantId, token)
  }

  // ── Event Payment Settings ────────────────────────────────────────────────────

  @Get('events/:eventId/payments/settings')
  getPaymentSettings(
    @Param('eventId') eventId: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.svc.getPaymentSettings(eventId, tenantId, token)
  }

  @Post('events/:eventId/payments/settings')
  upsertPaymentSettings(
    @Param('eventId') eventId: string,
    @Body() dto: any,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.svc.upsertPaymentSettings(eventId, tenantId, dto, token)
  }

  // ── Ticket Types ─────────────────────────────────────────────────────────────

  @Get('events/:eventId/payments/ticket-types')
  listTicketTypes(
    @Param('eventId') eventId: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.svc.listTicketTypes(eventId, tenantId, token)
  }

  @Post('events/:eventId/payments/ticket-types')
  createTicketType(
    @Param('eventId') eventId: string,
    @Body() dto: any,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.svc.createTicketType(eventId, tenantId, dto, token)
  }

  @Patch('events/:eventId/payments/ticket-types/:typeId')
  updateTicketType(
    @Param('typeId') typeId: string,
    @Body() dto: any,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.svc.updateTicketType(typeId, tenantId, dto, token)
  }

  @Delete('events/:eventId/payments/ticket-types/:typeId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteTicketType(
    @Param('typeId') typeId: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.svc.deleteTicketType(typeId, tenantId, token)
  }

  @Post('events/:eventId/payments/ticket-types/reorder')
  reorderTicketTypes(
    @Param('eventId') eventId: string,
    @Body() body: { ordered_ids: string[] },
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.svc.reorderTicketTypes(eventId, tenantId, body.ordered_ids, token)
  }

  // ── Orders ────────────────────────────────────────────────────────────────────

  @Get('events/:eventId/payments/orders')
  listOrders(
    @Param('eventId') eventId: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.listOrders(eventId, tenantId, token, { status, from, to, search, page, limit })
  }

  @Post('events/:eventId/payments/orders')
  createOrder(
    @Param('eventId') eventId: string,
    @Body() dto: any,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.svc.createOrder(eventId, tenantId, dto, token)
  }

  @Get('events/:eventId/payments/orders/:orderId')
  getOrder(
    @Param('orderId') orderId: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.svc.getOrder(orderId, tenantId, token)
  }

  @Post('events/:eventId/payments/orders/verify/:orderRef')
  verifyPayment(
    @Param('orderRef') orderRef: string,
    @Body() dto: any,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.svc.verifyPayment(orderRef, tenantId, dto, token)
  }

  @Post('events/:eventId/payments/orders/:orderId/mark-paid')
  markOrderPaid(
    @Param('orderId') orderId: string,
    @Body() dto: any,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.svc.markOrderPaid(orderId, tenantId, dto, token)
  }

  @Get('events/:eventId/payments/orders/export/csv')
  async exportOrders(
    @Param('eventId') eventId: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.svc.exportOrders(eventId, tenantId, token)
  }

  // ── Refunds ───────────────────────────────────────────────────────────────────

  @Get('events/:eventId/payments/orders/:orderId/refunds')
  listRefunds(
    @Param('orderId') orderId: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.svc.listRefunds(orderId, tenantId, token)
  }

  @Post('events/:eventId/payments/orders/:orderId/refunds')
  initiateRefund(
    @Param('orderId') orderId: string,
    @Body() dto: any,
    @TenantId() tenantId: string,
    @CurrentUserId() uid: string,
    @AccessToken() token: string,
  ) {
    return this.svc.initiateRefund(orderId, tenantId, dto, uid, token)
  }

  // ── Discount Codes ────────────────────────────────────────────────────────────

  @Get('events/:eventId/payments/discount-codes')
  listDiscountCodes(
    @Param('eventId') eventId: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.svc.listDiscountCodes(eventId, tenantId, token)
  }

  @Post('events/:eventId/payments/discount-codes')
  createDiscountCode(
    @Param('eventId') eventId: string,
    @Body() dto: any,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.svc.createDiscountCode(eventId, tenantId, dto, token)
  }

  @Patch('events/:eventId/payments/discount-codes/:codeId')
  updateDiscountCode(
    @Param('codeId') codeId: string,
    @Body() dto: any,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.svc.updateDiscountCode(codeId, tenantId, dto, token)
  }

  @Delete('events/:eventId/payments/discount-codes/:codeId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteDiscountCode(
    @Param('codeId') codeId: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.svc.deleteDiscountCode(codeId, tenantId, token)
  }

  @Post('events/:eventId/payments/discount-codes/validate')
  validateDiscountCode(
    @Param('eventId') eventId: string,
    @Body() body: { code: string; subtotal: number; items: any[] },
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.svc.validateDiscountCode(eventId, body.code, body.subtotal, body.items, token)
  }

  // ── Dashboard ─────────────────────────────────────────────────────────────────

  @Get('events/:eventId/payments/dashboard')
  getDashboard(
    @Param('eventId') eventId: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.svc.getDashboard(eventId, tenantId, token)
  }

  // ── Webhooks (no auth guard — signature verified internally) ─────────────────

  @Post('webhooks/payments/:provider/:tenantId')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Param('provider') provider: string,
    @Param('tenantId') tenantId: string,
    @Req() req: RawBodyRequest<Request>,
    @Headers() headers: Record<string, string>,
    @AccessToken() token: string,
  ) {
    const rawBody = req.rawBody?.toString('utf8') ?? JSON.stringify(req.body)
    return this.svc.handleWebhook(provider, tenantId, rawBody, headers, token)
  }
}
