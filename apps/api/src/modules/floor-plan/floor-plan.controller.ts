import {
  Controller, Get, Put, Post, Delete,
  Param, Body, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common'
import { AuthGuard } from '../../common/guards/auth.guard'
import { TenantId, AccessToken } from '../../common/decorators/tenant.decorator'
import { FloorPlanService, SaveFloorPlanDto, CreateTableDto, UpdateTableDto } from './floor-plan.service'

@Controller({ path: 'floor-plan', version: '1' })
@UseGuards(AuthGuard)
export class FloorPlanController {
  constructor(private readonly svc: FloorPlanService) {}

  // ── Init / get-or-create ────────────────────────────────────────────────────
  @Post('events/:eventId/init')
  @HttpCode(HttpStatus.OK)
  init(
    @Param('eventId') eventId: string,
    @TenantId() tenantId: string,
  ) {
    return this.svc.initFloorPlan(eventId, tenantId)
  }

  // ── Get full plan ───────────────────────────────────────────────────────────
  @Get('events/:eventId')
  get(
    @Param('eventId') eventId: string,
    @TenantId() tenantId: string,
  ) {
    return this.svc.getFloorPlan(eventId, tenantId)
  }

  // ── Save shapes + canvas props ──────────────────────────────────────────────
  @Put('events/:eventId')
  save(
    @Param('eventId') eventId: string,
    @TenantId() tenantId: string,
    @Body() dto: SaveFloorPlanDto,
  ) {
    return this.svc.saveFloorPlan(eventId, tenantId, dto)
  }

  // ── Publish ─────────────────────────────────────────────────────────────────
  @Post('events/:eventId/publish')
  @HttpCode(HttpStatus.OK)
  publish(
    @Param('eventId') eventId: string,
    @TenantId() tenantId: string,
  ) {
    return this.svc.publishFloorPlan(eventId, tenantId)
  }

  // ── Unassigned guests ───────────────────────────────────────────────────────
  @Get('events/:eventId/unassigned')
  unassigned(
    @Param('eventId') eventId: string,
    @TenantId() tenantId: string,
  ) {
    return this.svc.getUnassignedGuests(eventId, tenantId)
  }

  // ── Auto-assign ─────────────────────────────────────────────────────────────
  @Post('events/:eventId/auto-assign')
  @HttpCode(HttpStatus.OK)
  autoAssign(
    @Param('eventId') eventId: string,
    @TenantId() tenantId: string,
  ) {
    return this.svc.autoAssign(eventId, tenantId)
  }

  // ── Export seating chart ────────────────────────────────────────────────────
  @Get('events/:eventId/export/seating-chart')
  exportSeatingChart(
    @Param('eventId') eventId: string,
    @TenantId() tenantId: string,
  ) {
    return this.svc.exportSeatingChart(eventId, tenantId)
  }

  // ── Tables ──────────────────────────────────────────────────────────────────
  @Post('events/:eventId/tables')
  createTable(
    @Param('eventId') eventId: string,
    @TenantId() tenantId: string,
    @Body() dto: CreateTableDto,
  ) {
    return this.svc.createTable(eventId, tenantId, dto)
  }

  @Put('events/:eventId/tables/:tableId')
  updateTable(
    @Param('eventId') eventId: string,
    @Param('tableId') tableId: string,
    @TenantId() tenantId: string,
    @Body() dto: UpdateTableDto,
  ) {
    return this.svc.updateTable(eventId, tenantId, tableId, dto)
  }

  @Delete('events/:eventId/tables/:tableId')
  @HttpCode(HttpStatus.OK)
  deleteTable(
    @Param('eventId') eventId: string,
    @Param('tableId') tableId: string,
    @TenantId() tenantId: string,
  ) {
    return this.svc.deleteTable(eventId, tenantId, tableId)
  }

  // ── Guest assignment ────────────────────────────────────────────────────────
  @Post('events/:eventId/tables/:tableId/assign')
  @HttpCode(HttpStatus.OK)
  assignGuest(
    @Param('eventId') eventId: string,
    @Param('tableId') tableId: string,
    @TenantId() tenantId: string,
    @Body() body: { guestId: string },
  ) {
    return this.svc.assignGuest(eventId, tenantId, tableId, body.guestId)
  }

  @Delete('events/:eventId/tables/:tableId/guests/:guestId')
  @HttpCode(HttpStatus.OK)
  unassignGuest(
    @Param('eventId') eventId: string,
    @Param('tableId') tableId: string,
    @Param('guestId') guestId: string,
    @TenantId() tenantId: string,
  ) {
    return this.svc.unassignGuest(eventId, tenantId, tableId, guestId)
  }
}
