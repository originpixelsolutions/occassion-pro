import {
  Controller, Get, Post, Patch, Param, Body, UseGuards, ParseUUIDPipe,
} from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { HospitalityService } from './hospitality.service'
import { AuthGuard } from '../../common/guards/auth.guard'
import { TenantId, AccessToken } from '../../common/decorators/tenant.decorator'

@ApiTags('Hospitality')
@Controller({ path: 'hospitality', version: '1' })
@UseGuards(AuthGuard)
@ApiBearerAuth('access-token')
export class HospitalityController {
  constructor(private readonly hospitalityService: HospitalityService) {}

  @Get('events/:eventId/dashboard')
  @ApiOperation({ summary: 'Full hospitality dashboard for an event' })
  getDashboard(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.hospitalityService.getHospitalityDashboard(eventId, tenantId, token)
  }

  @Get('events/:eventId/readiness')
  @ApiOperation({ summary: 'Hospitality readiness report' })
  getReadiness(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.hospitalityService.getHospitalityReadiness(eventId, tenantId, token)
  }

  // ── Room Blocks ──────────────────────────────────────────────────────────────

  @Get('events/:eventId/room-blocks')
  getRoomBlocks(@Param('eventId', ParseUUIDPipe) eventId: string, @TenantId() tenantId: string, @AccessToken() token: string) {
    return this.hospitalityService.getRoomBlocks(eventId, tenantId, token)
  }

  @Post('events/:eventId/room-blocks')
  upsertRoomBlock(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() dto: any,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.hospitalityService.upsertRoomBlock(eventId, dto, tenantId, token)
  }

  @Patch('room-blocks/:id/status')
  updateRoomBlockStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { status: string },
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.hospitalityService.updateRoomBlockStatus(id, dto.status, tenantId, token)
  }

  // ── Accommodation ────────────────────────────────────────────────────────────

  @Get('events/:eventId/accommodation')
  getAccommodation(@Param('eventId', ParseUUIDPipe) eventId: string, @TenantId() tenantId: string, @AccessToken() token: string) {
    return this.hospitalityService.getAccommodation(eventId, tenantId, token)
  }

  @Post('events/:eventId/accommodation')
  upsertAccommodation(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() dto: any,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.hospitalityService.upsertAccommodation(eventId, dto, tenantId, token)
  }

  @Patch('accommodation/:id/checkin')
  checkIn(@Param('id', ParseUUIDPipe) id: string, @TenantId() tenantId: string, @AccessToken() token: string) {
    return this.hospitalityService.checkInGuest(id, tenantId, token)
  }

  @Patch('accommodation/:id/checkout')
  checkOut(@Param('id', ParseUUIDPipe) id: string, @TenantId() tenantId: string, @AccessToken() token: string) {
    return this.hospitalityService.checkOutGuest(id, tenantId, token)
  }

  // ── F&B ──────────────────────────────────────────────────────────────────────

  @Get('events/:eventId/fnb')
  getFnb(@Param('eventId', ParseUUIDPipe) eventId: string, @TenantId() tenantId: string, @AccessToken() token: string) {
    return this.hospitalityService.getFnbPlans(eventId, tenantId, token)
  }

  @Post('events/:eventId/fnb')
  upsertFnb(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() dto: any,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.hospitalityService.upsertFnbPlan(eventId, dto, tenantId, token)
  }

  @Patch('fnb/:id/status')
  updateFnbStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { status: string },
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.hospitalityService.updateFnbStatus(id, dto.status, tenantId, token)
  }

  // ── VIPs ─────────────────────────────────────────────────────────────────────

  @Get('events/:eventId/vips')
  getVips(@Param('eventId', ParseUUIDPipe) eventId: string, @TenantId() tenantId: string, @AccessToken() token: string) {
    return this.hospitalityService.getVips(eventId, tenantId, token)
  }

  @Post('events/:eventId/vips')
  upsertVip(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() dto: any,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.hospitalityService.upsertVip(eventId, dto, tenantId, token)
  }

  @Patch('vips/:id/status')
  updateVipStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { status: string },
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.hospitalityService.updateVipStatus(id, dto.status, tenantId, token)
  }

  // ── Transport ────────────────────────────────────────────────────────────────

  @Get('events/:eventId/transport')
  getTransport(@Param('eventId', ParseUUIDPipe) eventId: string, @TenantId() tenantId: string, @AccessToken() token: string) {
    return this.hospitalityService.getTransport(eventId, tenantId, token)
  }

  @Post('events/:eventId/transport')
  upsertTransport(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() dto: any,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.hospitalityService.upsertTransport(eventId, dto, tenantId, token)
  }

  @Patch('transport/:id/status')
  updateTransportStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { status: string },
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.hospitalityService.updateTransportStatus(id, dto.status, tenantId, token)
  }
}
