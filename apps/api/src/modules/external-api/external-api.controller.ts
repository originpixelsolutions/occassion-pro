import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, Req, UseGuards,
  HttpCode, HttpStatus,
  ParseIntPipe, DefaultValuePipe,
} from '@nestjs/common'
import { ApiKeysService, CreateApiKeyDto, ApproveKeyDto } from './api-keys.service'
import { WebhooksService, CreateWebhookDto } from './webhooks.service'
import { AccessRequestsService, CreateAccessRequestDto, ReviewAccessRequestDto } from './access-requests.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'

@Controller('api-config')
@UseGuards(JwtAuthGuard)
export class ExternalApiController {
  constructor(
    private readonly keysSvc: ApiKeysService,
    private readonly webhookSvc: WebhooksService,
    private readonly accessReqSvc: AccessRequestsService,
  ) {}

  // ═══════════════════════════════════════════
  // API Keys
  // ═══════════════════════════════════════════

  @Get('keys')
  listKeys(@Req() req: any) {
    return this.keysSvc.list(req.user.tenantId)
  }

  @Post('keys')
  createKey(@Req() req: any, @Body() dto: CreateApiKeyDto) {
    return this.keysSvc.create(req.user.tenantId, req.user.id, dto)
  }

  @Delete('keys/:id')
  @HttpCode(HttpStatus.OK)
  revokeKey(@Req() req: any, @Param('id') id: string) {
    return this.keysSvc.revoke(req.user.tenantId, id)
  }

  @Get('keys/:id/usage')
  getKeyUsage(
    @Req() req: any,
    @Param('id') id: string,
    @Query('days', new DefaultValuePipe(7), ParseIntPipe) days: number,
  ) {
    return this.keysSvc.getUsage(req.user.tenantId, id, days)
  }

  @Get('scopes')
  getScopes() {
    return this.keysSvc.getScopes()
  }

  // ═══════════════════════════════════════════
  // Webhooks
  // ═══════════════════════════════════════════

  @Get('webhooks')
  listWebhooks(@Req() req: any) {
    return this.webhookSvc.list(req.user.tenantId)
  }

  @Post('webhooks')
  createWebhook(@Req() req: any, @Body() dto: CreateWebhookDto) {
    return this.webhookSvc.create(req.user.tenantId, req.user.id, dto)
  }

  @Patch('webhooks/:id')
  updateWebhook(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: Partial<CreateWebhookDto> & { status?: string },
  ) {
    return this.webhookSvc.update(req.user.tenantId, id, dto)
  }

  @Delete('webhooks/:id')
  @HttpCode(HttpStatus.OK)
  deleteWebhook(@Req() req: any, @Param('id') id: string) {
    return this.webhookSvc.delete(req.user.tenantId, id)
  }

  @Get('webhooks/:id/deliveries')
  getDeliveries(
    @Req() req: any,
    @Param('id') id: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ) {
    return this.webhookSvc.getDeliveries(req.user.tenantId, id, limit)
  }

  @Post('webhooks/deliveries/:deliveryId/retry')
  retryDelivery(@Req() req: any, @Param('deliveryId') deliveryId: string) {
    return this.webhookSvc.retryDelivery(req.user.tenantId, deliveryId)
  }

  @Get('webhooks/events')
  getWebhookEvents() {
    return this.webhookSvc.getAvailableEvents()
  }

  // ═══════════════════════════════════════════
  // API Access Requests (for tenants)
  // ═══════════════════════════════════════════

  @Get('access-request')
  getAccessRequest(@Req() req: any) {
    return this.accessReqSvc.getForTenant(req.user.tenantId)
  }

  @Post('access-request')
  submitAccessRequest(@Req() req: any, @Body() dto: CreateAccessRequestDto) {
    return this.accessReqSvc.create(req.user.tenantId, req.user.id, dto)
  }

  @Delete('access-request')
  @HttpCode(HttpStatus.OK)
  cancelAccessRequest(@Req() req: any) {
    return this.accessReqSvc.cancel(req.user.tenantId)
  }
}

// ─── Super Admin controller ─────────────────────────────────────────────────
@Controller('super-admin/api-keys')
export class SuperAdminApiKeysController {
  constructor(private readonly keysSvc: ApiKeysService) {}

  @Get('pending')
  listPending() {
    return this.keysSvc.listPending()
  }

  @Post(':id/approve')
  approve(
    @Param('id') id: string,
    @Req() req: any,
    @Body() dto: ApproveKeyDto,
  ) {
    return this.keysSvc.adminApprove(id, req.user?.id ?? 'system', dto)
  }
}
