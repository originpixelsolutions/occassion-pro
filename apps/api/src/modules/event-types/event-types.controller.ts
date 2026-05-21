import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Req, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common'
import { EventTypesService, CreateEventTypeDto, UpdateEventTypeDto } from './event-types.service'
import { WorkspaceRoleGuard } from '../../common/guards/workspace-role.guard'
import { RequireTenantRole } from '../../common/decorators/require-tenant-role.decorator'

@Controller()
export class EventTypesController {
  constructor(private readonly eventTypes: EventTypesService) {}

  // ── GET /event-types ──────────────────────────────────────────────────────
  @Get('event-types')
  @UseGuards(WorkspaceRoleGuard)
  @RequireTenantRole('team_member')
  list(@Req() req: any) {
    return this.eventTypes.list(req.tenantId)
  }

  // ── POST /event-types ─────────────────────────────────────────────────────
  @Post('event-types')
  @UseGuards(WorkspaceRoleGuard)
  @RequireTenantRole('event_manager')
  create(@Body() dto: CreateEventTypeDto, @Req() req: any) {
    return this.eventTypes.create(dto, req.tenantId)
  }

  // ── PATCH /event-types/:id ────────────────────────────────────────────────
  @Patch('event-types/:id')
  @UseGuards(WorkspaceRoleGuard)
  @RequireTenantRole('event_manager')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateEventTypeDto,
    @Req() req: any,
  ) {
    return this.eventTypes.update(id, dto, req.tenantId)
  }

  // ── DELETE /event-types/:id ───────────────────────────────────────────────
  @Delete('event-types/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(WorkspaceRoleGuard)
  @RequireTenantRole('event_manager')
  async remove(@Param('id') id: string, @Req() req: any) {
    await this.eventTypes.delete(id, req.tenantId)
  }

  // ── GET /event-types/:id/checklist ────────────────────────────────────────
  @Get('event-types/:id/checklist')
  @UseGuards(WorkspaceRoleGuard)
  @RequireTenantRole('team_member')
  getChecklist(@Param('id') id: string) {
    return this.eventTypes.getReadinessChecklist(id)
  }

  // ── GET /events/:eventId/readiness ────────────────────────────────────────
  @Get('events/:eventId/readiness')
  @UseGuards(WorkspaceRoleGuard)
  @RequireTenantRole('team_member')
  readiness(@Param('eventId') eventId: string) {
    return this.eventTypes.computeSmartReadiness(eventId)
  }
}
