import {
  Controller, Get, Put, Post, Body, Param, Query,
  UseGuards, Request, HttpCode, HttpStatus,
} from '@nestjs/common'
import { InvitationsService } from './invitations.service'
import { AuthGuard } from '../../common/guards/auth.guard'

@Controller({ path: 'invitations', version: '1' })
@UseGuards(AuthGuard)
export class InvitationsController {
  constructor(private readonly svc: InvitationsService) {}

  // ── Templates ─────────────────────────────────────────────

  @Get('templates')
  async listTemplates(@Request() req: { user: { tenantId: string } }) {
    return this.svc.listTemplates(req.user.tenantId)
  }

  @Get('templates/:id')
  async getTemplate(@Param('id') id: string) {
    return this.svc.getTemplate(id)
  }

  // ── Event Invitation ──────────────────────────────────────

  @Get('events/:eventId/invitation')
  async getEventInvitation(@Param('eventId') eventId: string) {
    const inv = await this.svc.getEventInvitation(eventId)
    return inv ?? { exists: false }
  }

  @Put('events/:eventId/invitation')
  async createOrUpdate(
    @Param('eventId') eventId: string,
    @Body() dto: { templateId: string; customConfig?: Record<string, unknown> },
    @Request() req: { user: { id: string } },
  ) {
    return this.svc.createOrUpdateInvitation(eventId, dto, req.user.id)
  }

  @Post('events/:eventId/invitation/publish')
  @HttpCode(HttpStatus.OK)
  async publish(@Param('eventId') eventId: string) {
    return this.svc.publishInvitation(eventId)
  }

  // ── Guest Links ───────────────────────────────────────────

  @Post('events/:eventId/invitation/generate-links')
  @HttpCode(HttpStatus.OK)
  async generateLinks(
    @Param('eventId') eventId: string,
    @Body() dto: { guestIds: string[] | 'all' },
  ) {
    return this.svc.generateGuestLinks(eventId, dto.guestIds ?? 'all')
  }

  @Post('events/:eventId/invitation/send')
  @HttpCode(HttpStatus.OK)
  async sendInvitations(
    @Param('eventId') eventId: string,
    @Body() dto: {
      guestIds: string[] | 'all'
      channels: Array<'whatsapp' | 'sms' | 'email'>
    },
  ) {
    return this.svc.sendInvitations(eventId, dto.guestIds ?? 'all', dto.channels ?? ['whatsapp'])
  }

  @Get('events/:eventId/invitation/stats')
  async getStats(@Param('eventId') eventId: string) {
    return this.svc.getDeliveryStats(eventId)
  }

  // ── Public endpoints (no auth needed) ────────────────────

  @Get('public/:shortCode')
  async getPublicInvitation(@Param('shortCode') shortCode: string) {
    return this.svc.getInvitationByShortCode(shortCode)
  }

  @Post('public/:shortCode/open')
  @HttpCode(HttpStatus.OK)
  async trackOpen(@Param('shortCode') shortCode: string) {
    await this.svc.trackOpenDirect(shortCode)
    return { ok: true }
  }

  @Post('public/:shortCode/rsvp')
  @HttpCode(HttpStatus.OK)
  async submitRsvp(
    @Param('shortCode') shortCode: string,
    @Body() dto: { response: 'attending' | 'not_attending' },
  ) {
    return this.svc.submitRsvp(shortCode, dto.response)
  }
}
