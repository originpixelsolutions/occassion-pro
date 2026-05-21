import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger'
import { SmsService, CreateBroadcastDto, InboundWebhookDto } from './sms.service'
import { AuthGuard } from '../../common/guards/auth.guard'
import { TenantId, CurrentUserId, AccessToken } from '../../common/decorators/tenant.decorator'

// ─── Authenticated endpoints ──────────────────────────────────────────────────
@ApiTags('SMS')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard)
@Controller({ path: 'sms', version: '1' })
export class SmsController {
  constructor(private readonly smsService: SmsService) {}

  // ── Provider config ─────────────────────────────────────────────────────────

  @Get('config')
  @ApiOperation({ summary: 'Get SMS provider config for this tenant' })
  getConfig(
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.smsService.getProviderConfig(tenantId, token)
  }

  @Post('config')
  @ApiOperation({ summary: 'Create or update SMS provider config' })
  upsertConfig(
    @Body() body: any,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.smsService.upsertProviderConfig(body, tenantId, token)
  }

  // ── Broadcasts ──────────────────────────────────────────────────────────────

  @Get('broadcasts')
  @ApiOperation({ summary: 'List SMS broadcasts for this tenant' })
  @ApiQuery({ name: 'event_id', required: false })
  getBroadcasts(
    @TenantId() tenantId: string,
    @AccessToken() token: string,
    @Query('event_id') eventId?: string,
  ) {
    return this.smsService.getBroadcasts(tenantId, token, eventId)
  }

  @Post('broadcasts')
  @ApiOperation({ summary: 'Create a new SMS broadcast (draft)' })
  createBroadcast(
    @Body() dto: CreateBroadcastDto,
    @TenantId() tenantId: string,
    @CurrentUserId() userId: string,
    @AccessToken() token: string,
  ) {
    return this.smsService.createBroadcast(dto, tenantId, userId, token)
  }

  @Get('broadcasts/:id')
  @ApiOperation({ summary: 'Get single broadcast with messages' })
  getBroadcast(
    @Param('id', ParseUUIDPipe) id: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.smsService.getBroadcast(id, tenantId, token)
  }

  @Patch('broadcasts/:id')
  @ApiOperation({ summary: 'Update a draft broadcast' })
  updateBroadcast(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Partial<CreateBroadcastDto>,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.smsService.updateBroadcast(id, dto, tenantId, token)
  }

  @Post('broadcasts/:id/send')
  @ApiOperation({ summary: 'Send / dispatch a broadcast to all resolved recipients' })
  sendBroadcast(
    @Param('id', ParseUUIDPipe) id: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.smsService.sendBroadcast(id, tenantId, token)
  }

  @Post('broadcasts/:id/cancel')
  @ApiOperation({ summary: 'Cancel a draft or scheduled broadcast' })
  cancelBroadcast(
    @Param('id', ParseUUIDPipe) id: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.smsService.cancelBroadcast(id, tenantId, token)
  }

  @Get('broadcasts/:id/stats')
  @ApiOperation({ summary: 'Delivery stats for a broadcast' })
  getBroadcastStats(
    @Param('id', ParseUUIDPipe) id: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.smsService.getBroadcastStats(id, tenantId, token)
  }

  // ── Replies inbox ────────────────────────────────────────────────────────────

  @Get('replies')
  @ApiOperation({ summary: 'Inbound replies inbox' })
  @ApiQuery({ name: 'broadcast_id', required: false })
  @ApiQuery({ name: 'unread_only', required: false })
  getReplies(
    @TenantId() tenantId: string,
    @AccessToken() token: string,
    @Query('broadcast_id') broadcastId?: string,
    @Query('unread_only') unreadOnly?: string,
  ) {
    return this.smsService.getReplies(tenantId, token, broadcastId, unreadOnly === 'true')
  }

  @Patch('replies/:id/read')
  @ApiOperation({ summary: 'Mark a reply as read' })
  markReplyRead(
    @Param('id', ParseUUIDPipe) id: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.smsService.markReplyRead(id, tenantId, token)
  }

  // ── Opt-out management ───────────────────────────────────────────────────────

  @Get('optouts')
  @ApiOperation({ summary: 'List opted-out phone numbers' })
  getOptouts(
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.smsService.getOptouts(tenantId, token)
  }

  @Post('optouts')
  @ApiOperation({ summary: 'Manually add a phone to opt-out list' })
  addOptout(
    @Body('phone') phone: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.smsService.addOptout(phone, tenantId, token)
  }

  @Delete('optouts/:phone')
  @ApiOperation({ summary: 'Remove a phone from opt-out list (re-subscribe)' })
  removeOptout(
    @Param('phone') phone: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.smsService.removeOptout(decodeURIComponent(phone), tenantId, token)
  }
}

// ─── Webhook endpoints (no auth — called by SMS providers) ───────────────────
@ApiTags('SMS Webhooks')
@Controller({ path: 'sms/webhook', version: '1' })
export class SmsWebhookController {
  constructor(private readonly smsService: SmsService) {}

  @Post(':tenantId/twilio')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Twilio delivery receipt + inbound reply webhook' })
  twilioWebhook(
    @Param('tenantId') tenantId: string,
    @Body() body: any,
  ) {
    const dto: InboundWebhookDto = {
      provider: 'twilio',
      from_phone: body.From,
      body: body.Body ?? '',
      provider_message_id: body.MessageSid ?? body.SmsSid,
      to_phone: body.To,
      status: body.MessageStatus ?? body.SmsStatus,
      message_id: body.MessageSid,
      timestamp: body.DateCreated,
    }
    return this.smsService.handleInboundWebhook(tenantId, dto)
  }

  @Post(':tenantId/msg91')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'MSG91 delivery receipt + inbound webhook' })
  msg91Webhook(
    @Param('tenantId') tenantId: string,
    @Body() body: any,
  ) {
    const dto: InboundWebhookDto = {
      provider: 'msg91',
      from_phone: `+${body.mobile ?? body.from ?? ''}`,
      body: body.message ?? body.text ?? '',
      provider_message_id: body.request_id ?? body.msgid,
      status: body.report?.[0]?.status,
      message_id: body.request_id,
      timestamp: body.reportAt,
    }
    return this.smsService.handleInboundWebhook(tenantId, dto)
  }

  @Post(':tenantId/exotel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exotel delivery receipt + inbound webhook' })
  exotelWebhook(
    @Param('tenantId') tenantId: string,
    @Body() body: any,
  ) {
    const dto: InboundWebhookDto = {
      provider: 'exotel',
      from_phone: body.From ?? body.SmsSid,
      body: body.Body ?? '',
      provider_message_id: body.SmsSid,
      status: body.Status,
      message_id: body.SmsSid,
    }
    return this.smsService.handleInboundWebhook(tenantId, dto)
  }
}
