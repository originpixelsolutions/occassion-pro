import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, Version, Headers,
} from '@nestjs/common'
import { IntegrationsService } from './integrations.service'
import { AuthGuard } from '../../common/guards/auth.guard'

@Controller('integrations')
@Version('1')
@UseGuards(AuthGuard)
export class IntegrationsController {
  constructor(private readonly svc: IntegrationsService) {}

  private tok(h: Record<string, string>) {
    return (h['authorization'] ?? '').replace('Bearer ', '')
  }

  // ── DASHBOARD ──────────────────────────────────────────
  @Get('dashboard')
  dashboard(@Headers() h: Record<string, string>) {
    return this.svc.getDashboard(this.tok(h))
  }

  @Get('event-types')
  eventTypes() {
    return this.svc.getEventTypes()
  }

  // ── API KEYS ───────────────────────────────────────────
  @Get('api-keys')
  listKeys(@Headers() h: Record<string, string>) {
    return this.svc.listApiKeys(this.tok(h))
  }

  @Post('api-keys')
  createKey(
    @Headers() h: Record<string, string>,
    @Body() dto: { name: string; scopes?: string[]; environment?: 'live' | 'sandbox'; expires_at?: string },
  ) {
    return this.svc.createApiKey(this.tok(h), dto)
  }

  @Delete('api-keys/:id')
  revokeKey(
    @Headers() h: Record<string, string>,
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    return this.svc.revokeApiKey(this.tok(h), id, body?.reason)
  }

  // ── WEBHOOKS ────────────────────────────────────────────
  @Get('webhooks')
  listWebhooks(@Headers() h: Record<string, string>) {
    return this.svc.listWebhooks(this.tok(h))
  }

  @Post('webhooks')
  createWebhook(
    @Headers() h: Record<string, string>,
    @Body() dto: { name: string; url: string; events: string[]; description?: string; timeout_ms?: number; retry_count?: number },
  ) {
    return this.svc.createWebhook(this.tok(h), dto)
  }

  @Patch('webhooks/:id')
  updateWebhook(
    @Headers() h: Record<string, string>,
    @Param('id') id: string,
    @Body() dto: any,
  ) {
    return this.svc.updateWebhook(this.tok(h), id, dto)
  }

  @Delete('webhooks/:id')
  deleteWebhook(@Headers() h: Record<string, string>, @Param('id') id: string) {
    return this.svc.deleteWebhook(this.tok(h), id)
  }

  @Post('webhooks/:id/rotate-secret')
  rotateSecret(@Headers() h: Record<string, string>, @Param('id') id: string) {
    return this.svc.rotateWebhookSecret(this.tok(h), id)
  }

  @Post('webhooks/:id/test')
  testWebhook(@Headers() h: Record<string, string>, @Param('id') id: string) {
    return this.svc.testWebhook(this.tok(h), id)
  }

  @Get('webhooks/:id/deliveries')
  deliveries(
    @Headers() h: Record<string, string>,
    @Param('id') id: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.svc.getWebhookDeliveries(this.tok(h), id, +page, +limit)
  }

  @Post('deliveries/:id/retry')
  retryDelivery(@Headers() h: Record<string, string>, @Param('id') id: string) {
    return this.svc.retryDelivery(this.tok(h), id)
  }

  // ── THIRD-PARTY INTEGRATIONS ───────────────────────────
  @Get()
  listIntegrations(@Headers() h: Record<string, string>) {
    return this.svc.listIntegrations(this.tok(h))
  }

  @Post(':provider/connect')
  connect(
    @Headers() h: Record<string, string>,
    @Param('provider') provider: string,
    @Body() dto: { config?: Record<string, unknown>; secrets?: Record<string, unknown> },
  ) {
    return this.svc.connectIntegration(this.tok(h), provider, dto)
  }

  @Post(':provider/disconnect')
  disconnect(@Headers() h: Record<string, string>, @Param('provider') provider: string) {
    return this.svc.disconnectIntegration(this.tok(h), provider)
  }

  @Post(':provider/test')
  testIntegration(@Headers() h: Record<string, string>, @Param('provider') provider: string) {
    return this.svc.testIntegration(this.tok(h), provider)
  }

  @Get('logs')
  logs(
    @Headers() h: Record<string, string>,
    @Query('provider') provider?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '50',
  ) {
    return this.svc.getIntegrationLogs(this.tok(h), provider, +page, +limit)
  }
}
