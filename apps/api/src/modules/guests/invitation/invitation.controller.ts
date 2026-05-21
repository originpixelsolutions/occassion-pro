import {
  Controller, Get, Post, Patch, Delete, Param, Body, Query,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { InvitationService } from './invitation.service'
import { AuthGuard } from '../../../common/guards/auth.guard'
import { TenantId, AccessToken } from '../../../common/decorators/tenant.decorator'

@ApiTags('Invitations')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard)
@Controller({ path: 'events/:eventId/invitations', version: '1' })
export class InvitationController {
  constructor(private readonly svc: InvitationService) {}

  // ── Templates (event-scoped — designs are per event, never global) ──────────

  @Get('templates')
  @ApiOperation({ summary: 'List invitation templates for this event' })
  listTemplates(
    @Param('eventId') eventId: string,
    @TenantId() t: string,
    @AccessToken() token: string,
  ) {
    return this.svc.listTemplates(eventId, t, token)
  }

  @Get('templates/default')
  @ApiOperation({ summary: 'Get or create the default template for this event' })
  getOrCreateDefault(
    @Param('eventId') eventId: string,
    @TenantId() t: string,
    @AccessToken() token: string,
  ) {
    return this.svc.getOrCreateDefaultTemplate(eventId, t, token)
  }

  @Get('templates/:templateId')
  getTemplate(
    @Param('templateId') id: string,
    @Param('eventId') eventId: string,
    @TenantId() t: string,
    @AccessToken() token: string,
  ) {
    return this.svc.getTemplate(id, eventId, t, token)
  }

  @Post('templates')
  createTemplate(
    @Param('eventId') eventId: string,
    @Body() dto: any,
    @TenantId() t: string,
    @AccessToken() token: string,
  ) {
    return this.svc.createTemplate(eventId, t, dto, token)
  }

  @Patch('templates/:templateId')
  updateTemplate(
    @Param('templateId') id: string,
    @Param('eventId') eventId: string,
    @Body() dto: any,
    @TenantId() t: string,
    @AccessToken() token: string,
  ) {
    return this.svc.updateTemplate(id, eventId, t, dto, token)
  }

  @Delete('templates/:templateId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteTemplate(
    @Param('templateId') id: string,
    @Param('eventId') eventId: string,
    @TenantId() t: string,
    @AccessToken() token: string,
  ) {
    return this.svc.deleteTemplate(id, eventId, t, token)
  }

  // ── Master Template Library (global, copy-on-use) ──────────────────────────

  @Get('master-templates')
  @ApiOperation({ summary: 'List master templates from global library' })
  listMasterTemplates(@AccessToken() token: string) {
    return this.svc.listMasterTemplates(token)
  }

  @Post('templates/copy-from-master/:masterId')
  @ApiOperation({ summary: 'Copy a master template into this event (creates independent copy)' })
  copyFromMaster(
    @Param('masterId') masterId: string,
    @Param('eventId') eventId: string,
    @TenantId() t: string,
    @AccessToken() token: string,
  ) {
    return this.svc.copyMasterToEvent(masterId, eventId, t, token)
  }

  @Get()
  list(
    @Param('eventId') eventId: string,
    @TenantId() t: string,
    @AccessToken() token: string,
    @Query('status') status?: string,
    @Query('channel') channel?: string,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ) {
    return this.svc.listInvitations(eventId, t, token, { status, channel, page, pageSize })
  }

  @Post('bulk-create')
  @ApiOperation({ summary: 'Create invitations for multiple guests' })
  bulkCreate(
    @Param('eventId') eventId: string,
    @Body() body: {
      guestIds: string[]
      templateId: string
      channel: string
      scheduledAt?: string
    },
    @TenantId() t: string,
    @AccessToken() token: string,
  ) {
    return this.svc.bulkCreate(
      eventId, t, body.guestIds, body.templateId,
      body.channel, body.scheduledAt ?? null, token,
    )
  }

  @Post(':id/send')
  @HttpCode(HttpStatus.OK)
  markSent(
    @Param('id') id: string,
    @TenantId() t: string,
    @AccessToken() token: string,
  ) {
    return this.svc.markSent(id, t, token)
  }

  @Get('stats')
  getStats(
    @Param('eventId') eventId: string,
    @TenantId() t: string,
    @AccessToken() token: string,
  ) {
    return this.svc.getStats(eventId, t, token)
  }
}

// Public endpoint — no auth guard
@ApiTags('Invitations — Public')
@Controller({ path: 'public/invitations', version: '1' })
export class PublicInvitationController {
  constructor(private readonly svc: InvitationService) {}

  @Get(':token')
  @ApiOperation({ summary: 'Get invitation by token (public)' })
  getByToken(@Param('token') token: string) {
    return this.svc.getByToken(token)
  }

  @Post(':token/open')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Track invitation open' })
  trackOpen(@Param('token') token: string) {
    return this.svc.trackOpen(token)
  }
}
