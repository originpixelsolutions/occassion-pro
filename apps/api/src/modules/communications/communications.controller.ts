import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common'
import type { Response } from 'express'
import { ConfigService } from '@nestjs/config'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { WhatsAppService } from './whatsapp.service'
import { WhatsAppConnectionStatus } from './interfaces/whatsapp-provider.interface'

/**
 * CommunicationsController
 *
 * Protected routes (Super Admin only):
 *   GET  /communications/whatsapp/status       — connection status (+ QR if Baileys mode)
 *   POST /communications/whatsapp/connect      — initiate connection
 *   POST /communications/whatsapp/disconnect   — disconnect + clear session
 *
 * Public routes (no auth — required by Meta):
 *   GET  /communications/whatsapp/webhook      — Meta webhook verification (hub.challenge)
 *   POST /communications/whatsapp/webhook      — Incoming Meta webhook events (delivery receipts, replies)
 */
@Controller('communications')
export class CommunicationsController {
  constructor(
    private readonly whatsapp: WhatsAppService,
    private readonly config:   ConfigService,
  ) {}

  // ── Admin routes (Super Admin only) ────────────────────────────────────────

  /**
   * GET /communications/whatsapp/status
   * Returns the current WhatsApp connection status.
   * For Meta Cloud API: always returns 'connected' when credentials are set.
   * For Baileys: returns status + QR code when status === 'qr_pending'.
   */
  @Get('whatsapp/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  async getWhatsAppStatus(): Promise<WhatsAppConnectionStatus> {
    return this.whatsapp.getConnectionStatus()
  }

  /**
   * POST /communications/whatsapp/connect
   * For Baileys: initiates connection and generates QR code.
   * For Meta Cloud API: no-op (always connected when credentials are configured).
   */
  @Post('whatsapp/connect')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @HttpCode(HttpStatus.ACCEPTED)
  async connectWhatsApp(): Promise<{ message: string }> {
    await this.whatsapp.connect()
    return { message: 'Connection initiated — poll /status for details' }
  }

  /**
   * POST /communications/whatsapp/disconnect
   * For Baileys: logs out and deletes session files.
   * For Meta Cloud API: no-op.
   */
  @Post('whatsapp/disconnect')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @HttpCode(HttpStatus.OK)
  async disconnectWhatsApp(): Promise<{ message: string }> {
    await this.whatsapp.disconnect()
    return { message: 'WhatsApp disconnected' }
  }

  // ── Meta Cloud API Webhook (public — no auth) ──────────────────────────────

  /**
   * GET /communications/whatsapp/webhook
   *
   * Meta webhook verification handshake.
   * Meta calls this URL when you configure a webhook in Meta Business Manager.
   * Must respond with hub.challenge when hub.verify_token matches META_WA_VERIFY_TOKEN.
   *
   * Docs: https://developers.facebook.com/docs/graph-api/webhooks/getting-started
   */
  @Get('whatsapp/webhook')
  @HttpCode(HttpStatus.OK)
  verifyMetaWebhook(
    @Query('hub.mode')         mode:      string,
    @Query('hub.verify_token') token:     string,
    @Query('hub.challenge')    challenge: string,
    @Res() res: Response,
  ): void {
    const verifyToken = this.config.get<string>('META_WA_VERIFY_TOKEN') ?? ''

    if (mode === 'subscribe' && token === verifyToken) {
      res.status(200).send(challenge)
    } else {
      res.status(403).send('Forbidden')
    }
  }

  /**
   * POST /communications/whatsapp/webhook
   *
   * Receives incoming Meta webhook events:
   *   - messages: inbound messages from users (currently logged only)
   *   - statuses: delivery receipts (sent, delivered, read, failed)
   *
   * This endpoint must be publicly accessible and registered in Meta Business Manager.
   * Meta expects a 200 response within 20 seconds.
   *
   * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-examples
   */
  @Post('whatsapp/webhook')
  @HttpCode(HttpStatus.OK)
  handleMetaWebhook(@Body() payload: any): { status: string } {
    // Process entry array from Meta
    const entries: any[] = payload?.entry ?? []

    for (const entry of entries) {
      const changes: any[] = entry?.changes ?? []
      for (const change of changes) {
        const value = change?.value

        // Incoming messages
        const messages: any[] = value?.messages ?? []
        for (const msg of messages) {
          // Future: emit event, trigger auto-reply, or log to DB
          void msg
        }

        // Delivery status updates
        const statuses: any[] = value?.statuses ?? []
        for (const status of statuses) {
          // Future: update message delivery status in DB
          void status
        }
      }
    }

    return { status: 'ok' }
  }
}
