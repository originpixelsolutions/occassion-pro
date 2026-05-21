import {
  Controller, Get, Post, Patch, Param, Body, Query,
  UseGuards, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { GuestsAdvancedService } from './guests-advanced.service'
import { AuthGuard } from '../../common/guards/auth.guard'
import { TenantId, AccessToken, CurrentUserId } from '../../common/decorators/tenant.decorator'

@ApiTags('Guests Advanced — Check-in & Seating')
@Controller({ path: 'guests-advanced', version: '1' })
@UseGuards(AuthGuard)
@ApiBearerAuth('access-token')
export class GuestsAdvancedController {
  constructor(private readonly service: GuestsAdvancedService) {}

  // ── Dashboard ───────────────────────────────────────────────────────────────

  @Get('events/:eventId/dashboard')
  @ApiOperation({ summary: 'Full check-in & guest dashboard' })
  getDashboard(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.getCheckInDashboard(eventId, tenantId, token)
  }

  @Get('events/:eventId/live-stats')
  @ApiOperation({ summary: 'Live check-in statistics (for realtime refresh)' })
  getLiveStats(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.getLiveStats(eventId, tenantId, token)
  }

  // ── Guest Details ────────────────────────────────────────────────────────────

  @Get('events/:eventId/details')
  @ApiOperation({ summary: 'List guests with full detail, filters' })
  getGuests(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
    @Query('rsvp') rsvp?: string,
    @Query('checked_in') checkedIn?: string,
    @Query('table') table?: string,
    @Query('group') group?: string,
    @Query('vip') vip?: string,
  ) {
    return this.service.getGuestsWithDetails(eventId, tenantId, token, {
      rsvp,
      checked_in: checkedIn !== undefined ? checkedIn === 'true' : undefined,
      table, group,
      vip: vip === 'true',
    })
  }

  @Post('events/:eventId/guests/:guestId/details')
  @ApiOperation({ summary: 'Create or update guest details (dietary, seating, QR)' })
  upsertDetails(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Param('guestId', ParseUUIDPipe) guestId: string,
    @Body() dto: any,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.upsertGuestDetails(guestId, eventId, dto, tenantId, token)
  }

  // ── QR Check-in ─────────────────────────────────────────────────────────────

  @Post('checkin/qr')
  @ApiOperation({ summary: 'QR code scan check-in' })
  @HttpCode(HttpStatus.OK)
  checkInByQR(
    @Body() dto: { qr_code: string; event_id: string; gate_name?: string; device_id?: string },
    @TenantId() tenantId: string,
    @AccessToken() token: string,
    @CurrentUserId() userId: string,
  ) {
    return this.service.checkInByQR(dto, tenantId, token, userId)
  }

  @Patch('details/:id/checkin')
  @ApiOperation({ summary: 'Manual check-in by detail ID' })
  checkInManual(
    @Param('id', ParseUUIDPipe) id: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
    @CurrentUserId() userId: string,
  ) {
    return this.service.checkInManual(id, tenantId, token, userId)
  }

  @Patch('details/:id/checkout')
  @ApiOperation({ summary: 'Undo check-in' })
  checkOut(
    @Param('id', ParseUUIDPipe) id: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.checkOut(id, tenantId, token)
  }

  @Get('events/:eventId/checkin-log')
  getCheckinLog(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.getCheckinLog(eventId, tenantId, token)
  }

  // ── RSVP ────────────────────────────────────────────────────────────────────

  @Patch('details/:id/rsvp')
  updateRsvp(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { status: string; notes?: string },
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.updateRsvp(id, dto, tenantId, token)
  }

  @Post('events/:eventId/bulk-rsvp')
  @HttpCode(HttpStatus.OK)
  bulkRsvp(
    @Param('eventId', ParseUUIDPipe) _eventId: string,
    @Body() dto: { ids: string[]; status: string },
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.bulkUpdateRsvp(dto.ids, dto.status, tenantId, token)
  }

  // ── Seating ─────────────────────────────────────────────────────────────────

  @Get('events/:eventId/tables')
  getTables(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.getTables(eventId, tenantId, token)
  }

  @Post('events/:eventId/tables')
  upsertTable(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() dto: any,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.upsertTable(eventId, dto, tenantId, token)
  }

  @Patch('details/:id/seat')
  assignSeat(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { table_number: string; seat_number?: string; seating_zone?: string },
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.assignSeat(id, dto, tenantId, token)
  }

  @Post('events/:eventId/bulk-assign-table')
  @HttpCode(HttpStatus.OK)
  bulkAssign(
    @Param('eventId', ParseUUIDPipe) _eventId: string,
    @Body() dto: { ids: string[]; table_number: string },
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.bulkAssignTable(dto.ids, dto.table_number, tenantId, token)
  }

  // ── Groups ──────────────────────────────────────────────────────────────────

  @Get('events/:eventId/groups')
  getGroups(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.getGroups(eventId, tenantId, token)
  }

  @Post('events/:eventId/groups')
  upsertGroup(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() dto: any,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.upsertGroup(eventId, dto, tenantId, token)
  }

  // ── Gifting ─────────────────────────────────────────────────────────────────

  @Patch('details/:id/gift')
  recordGift(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { description?: string; amount?: number },
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.recordGift(id, dto, tenantId, token)
  }

  @Patch('details/:id/gift/acknowledge')
  acknowledgeGift(
    @Param('id', ParseUUIDPipe) id: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.acknowledgeGift(id, tenantId, token)
  }

  @Get('events/:eventId/registry')
  getRegistry(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.getGiftRegistry(eventId, tenantId, token)
  }

  @Post('events/:eventId/registry')
  upsertRegistry(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() dto: any,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.upsertGiftRegistryItem(eventId, dto, tenantId, token)
  }

  // ── QR Generation ───────────────────────────────────────────────────────────

  @Post('events/:eventId/generate-qr')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate QR codes for all guests without one' })
  generateQR(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.generateQRCodes(eventId, tenantId, token)
  }

  // ── Invite Tracking ─────────────────────────────────────────────────────────

  @Post('events/:eventId/mark-invited')
  @HttpCode(HttpStatus.OK)
  markInvited(
    @Param('eventId', ParseUUIDPipe) _eventId: string,
    @Body() dto: { ids: string[]; channel: string },
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.markInviteSent(dto.ids, dto.channel, tenantId, token)
  }
}
