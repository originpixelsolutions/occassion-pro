import {
  Controller, Get, Post, Put, Delete, Patch, Body, Param,
  Query, Req, UseGuards, HttpCode, HttpStatus,
  BadRequestException, RawBodyRequest,
} from '@nestjs/common'
import type { Request } from 'express'
import { ConfigService } from '@nestjs/config'
import * as crypto from 'crypto'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { TenantGuard } from '../../common/guards/tenant.guard'
import { WhatsAppBroadcastService, CreateBroadcastDto } from './whatsapp-broadcast.service'

@Controller('whatsapp')
export class WhatsAppBroadcastController {
  constructor(
    private readonly svc: WhatsAppBroadcastService,
    private readonly config: ConfigService,
  ) {}

  // ── Meta Cloud API Webhook ─────────────────────────────────────────────────
  // These endpoints are public — Meta calls them from their servers.

  /** Webhook verification (GET) — Meta sends a challenge to verify the endpoint */
  @Get('webhook')
  verifyWebhook(@Query() query: Record<string, string>) {
    const mode      = query['hub.mode']
    const token     = query['hub.verify_token']
    const challenge = query['hub.challenge']
    const expected  = this.config.get<string>('WHATSAPP_WEBHOOK_VERIFY_TOKEN')

    if (mode === 'subscribe' && token === expected) {
      return Number(challenge)
    }
    throw new BadRequestException('Webhook verification failed')
  }

  /** Webhook event handler (POST) — delivery receipts + inbound messages */
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async receiveWebhook(@Req() req: RawBodyRequest<Request>, @Body() body: any) {
    // Verify Meta signature (X-Hub-Signature-256)
    const appSecret = this.config.get<string>('WHATSAPP_APP_SECRET')
    if (appSecret) {
      const sig = req.headers['x-hub-signature-256'] as string
      const raw = (req as any).rawBody as Buffer
      if (raw && sig) {
        const expected = 'sha256=' + crypto.createHmac('sha256', appSecret).update(raw).digest('hex')
        if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
          throw new BadRequestException('Invalid webhook signature')
        }
      }
    }

    await this.svc.handleDeliveryWebhook(body)
    return { ok: true }
  }

  // ── Broadcasts (staff — JWT protected) ────────────────────────────────────

  @Get('broadcasts')
  @UseGuards(JwtAuthGuard, TenantGuard)
  async listBroadcasts(@Req() req: any, @Query('event_id') eventId?: string) {
    return this.svc.listBroadcasts(req.user.tenant_id, eventId)
  }

  @Get('broadcasts/:id')
  @UseGuards(JwtAuthGuard, TenantGuard)
  async getBroadcast(@Req() req: any, @Param('id') id: string) {
    return this.svc.getBroadcast(req.user.tenant_id, id)
  }

  @Post('broadcasts')
  @UseGuards(JwtAuthGuard, TenantGuard)
  @HttpCode(HttpStatus.CREATED)
  async createBroadcast(@Req() req: any, @Body() dto: CreateBroadcastDto) {
    if (!dto.name?.trim()) throw new BadRequestException('name is required')
    return this.svc.createBroadcast(req.user.tenant_id, req.user.sub, dto)
  }

  @Put('broadcasts/:id')
  @UseGuards(JwtAuthGuard, TenantGuard)
  async updateBroadcast(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: Partial<CreateBroadcastDto>,
  ) {
    return this.svc.updateBroadcast(req.user.tenant_id, id, dto)
  }

  @Delete('broadcasts/:id')
  @UseGuards(JwtAuthGuard, TenantGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteBroadcast(@Req() req: any, @Param('id') id: string) {
    await this.svc.deleteBroadcast(req.user.tenant_id, id)
  }

  @Post('broadcasts/:id/send')
  @UseGuards(JwtAuthGuard, TenantGuard)
  @HttpCode(HttpStatus.OK)
  async sendBroadcast(@Req() req: any, @Param('id') id: string) {
    return this.svc.sendBroadcast(req.user.tenant_id, id)
  }

  @Post('broadcasts/:id/cancel')
  @UseGuards(JwtAuthGuard, TenantGuard)
  @HttpCode(HttpStatus.OK)
  async cancelBroadcast(@Req() req: any, @Param('id') id: string) {
    return this.svc.updateBroadcast(req.user.tenant_id, id, { scheduled_at: undefined })
  }

  // ── Audience Preview ───────────────────────────────────────────────────────

  @Post('broadcasts/preview-audience')
  @UseGuards(JwtAuthGuard, TenantGuard)
  @HttpCode(HttpStatus.OK)
  async previewAudience(
    @Req() req: any,
    @Body() body: { event_id: string; audience_filter: any },
  ) {
    return this.svc.previewAudience(req.user.tenant_id, body.event_id, body.audience_filter ?? {})
  }

  // ── Analytics ──────────────────────────────────────────────────────────────

  @Get('analytics')
  @UseGuards(JwtAuthGuard, TenantGuard)
  async getAnalytics(@Req() req: any, @Query('event_id') eventId?: string) {
    return this.svc.getBroadcastAnalytics(req.user.tenant_id, eventId)
  }

  // ── Inbox ──────────────────────────────────────────────────────────────────

  @Get('inbox')
  @UseGuards(JwtAuthGuard, TenantGuard)
  async getInbox(
    @Req() req: any,
    @Query('event_id') eventId?: string,
    @Query('unread') unread?: string,
  ) {
    return this.svc.getInbox(req.user.tenant_id, eventId, unread === 'true')
  }

  @Get('inbox/:phone/thread')
  @UseGuards(JwtAuthGuard, TenantGuard)
  async getThread(@Req() req: any, @Param('phone') phone: string) {
    return this.svc.getThread(req.user.tenant_id, decodeURIComponent(phone))
  }

  @Post('inbox/:phone/reply')
  @UseGuards(JwtAuthGuard, TenantGuard)
  @HttpCode(HttpStatus.CREATED)
  async replyToThread(
    @Req() req: any,
    @Param('phone') phone: string,
    @Body() body: { message: string; event_id?: string },
  ) {
    if (!body.message?.trim()) throw new BadRequestException('message is required')
    return this.svc.replyToThread(
      req.user.tenant_id,
      req.user.sub,
      decodeURIComponent(phone),
      body.message,
      body.event_id,
    )
  }

  // ── Opt-out management ─────────────────────────────────────────────────────

  @Get('opt-outs')
  @UseGuards(JwtAuthGuard, TenantGuard)
  async listOptOuts(@Req() req: any) {
    return this.svc.listOptOuts(req.user.tenant_id)
  }

  @Post('opt-outs')
  @UseGuards(JwtAuthGuard, TenantGuard)
  @HttpCode(HttpStatus.CREATED)
  async manualOptOut(@Req() req: any, @Body() body: { phone: string; notes?: string }) {
    if (!body.phone) throw new BadRequestException('phone is required')
    return this.svc.manualOptOut(req.user.tenant_id, body.phone, body.notes)
  }

  @Patch('opt-outs/:phone/re-opt-in')
  @UseGuards(JwtAuthGuard, TenantGuard)
  async reOptIn(@Req() req: any, @Param('phone') phone: string) {
    return this.svc.reOptIn(req.user.tenant_id, decodeURIComponent(phone))
  }
}
