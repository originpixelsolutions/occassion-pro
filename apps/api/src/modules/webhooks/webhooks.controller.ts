import { Controller, Get, Post, Delete, Param, Body, Headers, UseGuards, RawBodyRequest, Req, ForbiddenException, Logger } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { WebhooksService } from './webhooks.service'
import { AuthGuard } from '../../common/guards/auth.guard'
import { Public } from '../../common/decorators/tenant.decorator'
import { TenantId, CurrentUserId, AccessToken } from '../../common/decorators/tenant.decorator'
import { WebhookSecurityService } from '../../common/security/webhook-security.service'
import { SecurityAuditService } from '../../common/security/security-audit.service'

@ApiTags('Webhooks')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard)
@Controller({ path: 'webhooks', version: '1' })
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Get()
  getWebhooks(@TenantId() t: string, @AccessToken() token: string) {
    return this.webhooksService.getWebhooks(t, token)
  }

  @Post()
  register(
    @Body() dto: { url: string; events: string[]; secret?: string },
    @TenantId() t: string,
    @CurrentUserId() u: string,
    @AccessToken() token: string,
  ) {
    return this.webhooksService.registerWebhook({ ...dto, tenantId: t, userId: u }, token)
  }

  @Post(':id/toggle')
  toggle(
    @Param('id') id: string,
    @Body() body: { active: boolean },
    @TenantId() t: string,
    @AccessToken() token: string,
  ) {
    return this.webhooksService.toggleWebhook(id, body.active, t, token)
  }

  @Delete(':id')
  remove(@Param('id') id: string, @TenantId() t: string, @AccessToken() token: string) {
    return this.webhooksService.deleteWebhook(id, t, token)
  }
}

// Internal webhook receiver (from Supabase edge functions / DB triggers)
@ApiTags('Internal Webhooks')
@Controller({ path: 'internal/webhooks', version: '1' })
export class InternalWebhooksController {
  private readonly logger = new Logger(InternalWebhooksController.name)

  constructor(
    private readonly webhooksService: WebhooksService,
    private readonly webhookSecurity: WebhookSecurityService,
    private readonly audit: SecurityAuditService,
  ) {}

  @Public()
  @Post('db-event')
  async handleDbEvent(
    @Body() payload: any,
    @Headers('x-webhook-secret') secret: string,
    @Headers('x-webhook-timestamp') timestamp: string,
    @Headers('x-webhook-nonce') nonce: string,
    @Req() req: any,
  ) {
    const ip = req.ip

    // ── Tier 1: Timestamp validation — reject stale/future payloads (±5 min)
    if (!this.webhookSecurity.validateTimestamp(timestamp)) {
      this.audit.log({
        action: 'webhook.replay_attempt',
        ip,
        metadata: { source: 'internal_db_event', reason: 'timestamp_out_of_window', timestamp },
      })
      throw new ForbiddenException('Webhook timestamp out of acceptable window')
    }

    // ── Tier 2: Timing-safe secret comparison — prevents timing oracle attacks
    const expectedSecret = process.env.INTERNAL_WEBHOOK_SECRET ?? ''
    if (!this.webhookSecurity.timingSafeCompare(secret ?? '', expectedSecret)) {
      this.audit.log({
        action: 'webhook.auth_failed',
        ip,
        metadata: { source: 'internal_db_event', reason: 'invalid_secret' },
      })
      throw new ForbiddenException('Invalid webhook secret')
    }

    // ── Tier 3: Nonce deduplication — prevents replay of valid signed payloads
    if (nonce) {
      const isNew = await this.webhookSecurity.checkAndConsumeNonce(nonce, 'internal_db_event')
      if (!isNew) {
        this.audit.log({
          action: 'webhook.replay_attempt',
          ip,
          metadata: { source: 'internal_db_event', reason: 'nonce_replayed', nonce },
        })
        throw new ForbiddenException('Webhook nonce already used')
      }
    }

    return this.webhooksService.handleSupabaseWebhook(payload)
  }
}
