import {
  Controller, Get, Post, Patch, Delete, Param, Body, Query,
  UseGuards, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { WorkforceService } from './workforce.service'
import { AuthGuard } from '../../common/guards/auth.guard'
import { TenantId, AccessToken, CurrentUserId } from '../../common/decorators/tenant.decorator'

@ApiTags('Workforce Management')
@Controller({ path: 'workforce', version: '1' })
@UseGuards(AuthGuard)
@ApiBearerAuth('access-token')
export class WorkforceController {
  constructor(private readonly service: WorkforceService) {}

  // ── Tenant-level stats ────────────────────────────────────────────────────

  @Get('stats')
  @ApiOperation({ summary: 'Tenant-wide workforce statistics' })
  getTenantStats(
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.getTenantWorkforceStats(tenantId, token)
  }

  // ── Staff Roles ────────────────────────────────────────────────────────────

  @Get('roles')
  listRoles(
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.listRoles(tenantId, token)
  }

  @Post('roles')
  upsertRole(
    @Body() dto: any,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.upsertRole(dto, tenantId, token)
  }

  // ── Staff Members ─────────────────────────────────────────────────────────

  @Get('staff')
  @ApiOperation({ summary: 'List all staff members with optional filters' })
  listStaff(
    @TenantId() tenantId: string,
    @AccessToken() token: string,
    @Query('status') status?: string,
    @Query('department') department?: string,
    @Query('role_id') roleId?: string,
    @Query('search') search?: string,
  ) {
    return this.service.listStaff(tenantId, token, { status, department, role_id: roleId, search })
  }

  @Post('staff')
  @ApiOperation({ summary: 'Create or update a staff member' })
  upsertStaff(
    @Body() dto: any,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.upsertStaffMember(dto, tenantId, token)
  }

  @Get('staff/:id')
  getStaff(
    @Param('id', ParseUUIDPipe) id: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.getStaffMember(id, tenantId, token)
  }

  @Patch('staff/:id/status')
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('status') status: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.updateStaffStatus(id, status, tenantId, token)
  }

  @Post('staff/:id/reviews')
  createReview(
    @Param('id', ParseUUIDPipe) staffId: string,
    @Body() dto: any,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
    @CurrentUserId() userId: string,
  ) {
    return this.service.createReview({ ...dto, staff_id: staffId }, tenantId, token, userId)
  }

  @Post('staff/:id/unavailability')
  setUnavailability(
    @Param('id', ParseUUIDPipe) staffId: string,
    @Body() dto: any,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.setUnavailability({ ...dto, staff_id: staffId }, tenantId, token)
  }

  // ── Event-scoped Workforce ────────────────────────────────────────────────

  @Get('events/:eventId/dashboard')
  @ApiOperation({ summary: 'Full workforce dashboard for an event' })
  getDashboard(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.getEventWorkforceDashboard(eventId, tenantId, token)
  }

  @Get('events/:eventId/live')
  @ApiOperation({ summary: 'Real-time on-site staff status' })
  getLiveStatus(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.getLiveStaffStatus(eventId, tenantId, token)
  }

  @Get('events/:eventId/availability')
  getAvailability(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.getStaffAvailability(eventId, tenantId, token)
  }

  @Get('events/:eventId/payroll')
  @ApiOperation({ summary: 'Payroll summary for completed event shifts' })
  getPayroll(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.getPayrollSummary(eventId, tenantId, token)
  }

  // ── Plans ─────────────────────────────────────────────────────────────────

  @Get('events/:eventId/plan')
  getPlan(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.getOrCreatePlan(eventId, tenantId, token)
  }

  @Patch('plans/:planId')
  updatePlan(
    @Param('planId', ParseUUIDPipe) planId: string,
    @Body() dto: any,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.updatePlan(planId, dto, tenantId, token)
  }

  // ── Shifts ─────────────────────────────────────────────────────────────────

  @Get('events/:eventId/shifts')
  @ApiOperation({ summary: 'All shifts for an event grouped by date' })
  getShifts(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.getEventShifts(eventId, tenantId, token)
  }

  @Post('events/:eventId/shifts')
  upsertShift(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() dto: any,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.upsertShift(dto, eventId, tenantId, token)
  }

  @Delete('shifts/:shiftId')
  deleteShift(
    @Param('shiftId', ParseUUIDPipe) shiftId: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.deleteShift(shiftId, tenantId, token)
  }

  // ── Assignments ────────────────────────────────────────────────────────────

  @Post('shifts/:shiftId/assign')
  @ApiOperation({ summary: 'Assign one or more staff to a shift' })
  assignStaff(
    @Param('shiftId', ParseUUIDPipe) shiftId: string,
    @Body('staff_ids') staffIds: string[],
    @TenantId() tenantId: string,
    @AccessToken() token: string,
    @CurrentUserId() userId: string,
  ) {
    return this.service.assignStaff(shiftId, staffIds, tenantId, token, userId)
  }

  @Post('events/:eventId/bulk-assign')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bulk-assign multiple staff to multiple shifts' })
  bulkAssign(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() dto: { assignments: { shift_id: string; staff_ids: string[] }[] },
    @TenantId() tenantId: string,
    @AccessToken() token: string,
    @CurrentUserId() userId: string,
  ) {
    return this.service.bulkAssign(eventId, dto.assignments, tenantId, token, userId)
  }

  @Patch('assignments/:id')
  updateAssignment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: any,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.updateAssignment(id, dto, tenantId, token)
  }

  @Patch('assignments/:id/confirm')
  confirmAssignment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('channel') channel: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.confirmAssignment(id, channel || 'app', tenantId, token)
  }

  @Patch('assignments/:id/checkin')
  @ApiOperation({ summary: 'Staff check-in at event venue' })
  checkIn(
    @Param('id', ParseUUIDPipe) id: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
    @CurrentUserId() userId: string,
  ) {
    return this.service.checkInStaff(id, tenantId, token, userId)
  }

  @Patch('assignments/:id/checkout')
  checkOut(
    @Param('id', ParseUUIDPipe) id: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.checkOutStaff(id, tenantId, token)
  }
}
