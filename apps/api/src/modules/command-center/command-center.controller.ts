import {
  Controller, Get, Post, Patch, Param, Body, UseGuards, ParseUUIDPipe,
} from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { CommandCenterService } from './command-center.service'
import { AuthGuard } from '../../common/guards/auth.guard'
import { TenantId, AccessToken, CurrentUserId } from '../../common/decorators/tenant.decorator'

@ApiTags('Command Center')
@Controller({ path: 'command-center', version: '1' })
@UseGuards(AuthGuard)
@ApiBearerAuth('access-token')
export class CommandCenterController {
  constructor(private readonly commandCenterService: CommandCenterService) {}

  @Get('events/:eventId/live')
  @ApiOperation({ summary: 'Full live command dashboard for an event' })
  getLiveDashboard(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.commandCenterService.getLiveCommandDashboard(eventId, tenantId, token)
  }

  @Get('events/:eventId/runsheet')
  @ApiOperation({ summary: 'Get full runsheet for an event' })
  getRunsheet(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.commandCenterService.getRunsheet(eventId, tenantId, token)
  }

  @Post('events/:eventId/runsheet')
  @ApiOperation({ summary: 'Add or update a runsheet item' })
  upsertRunsheetItem(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() dto: {
      id?: string; title: string; description?: string; category?: string
      scheduled_time: string; duration_minutes?: number; location?: string
      assignee_id?: string; status?: string; notes?: string
    },
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.commandCenterService.upsertRunsheetItem(eventId, dto, tenantId, token)
  }

  @Patch('runsheet/:id/status')
  @ApiOperation({ summary: 'Update runsheet item status (pending/in_progress/completed/skipped)' })
  updateRunsheetStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { status: string },
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.commandCenterService.updateRunsheetItemStatus(id, dto.status, tenantId, token)
  }

  @Get('events/:eventId/incidents')
  @ApiOperation({ summary: 'Get all incidents for an event' })
  getIncidents(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.commandCenterService.getIncidents(eventId, tenantId, token)
  }

  @Post('events/:eventId/incidents')
  @ApiOperation({ summary: 'Report a new incident' })
  createIncident(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() dto: { title: string; description: string; severity: 'low' | 'medium' | 'high' | 'critical'; category?: string; location?: string },
    @TenantId() tenantId: string,
    @AccessToken() token: string,
    @CurrentUserId() userId: string,
  ) {
    return this.commandCenterService.createIncident(eventId, dto, tenantId, token, userId)
  }

  @Patch('incidents/:id/resolve')
  @ApiOperation({ summary: 'Resolve an incident' })
  resolveIncident(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { resolution: string },
    @TenantId() tenantId: string,
    @AccessToken() token: string,
    @CurrentUserId() userId: string,
  ) {
    return this.commandCenterService.resolveIncident(id, dto.resolution, tenantId, token, userId)
  }

  @Patch('crew/:assignmentId/checkin')
  @ApiOperation({ summary: 'Check in a crew member' })
  checkInCrew(
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.commandCenterService.checkInCrew(assignmentId, tenantId, token)
  }

  @Patch('tasks/:taskId/status')
  @ApiOperation({ summary: 'Quick-update task status from command center' })
  updateTaskStatus(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: { status: string },
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.commandCenterService.updateTaskStatus(taskId, dto.status, tenantId, token)
  }

  // ── ORCHESTRATION ────────────────────────────────────────────────────────

  @Get('orchestration/dashboard')
  @ApiOperation({ summary: 'Multi-event orchestration dashboard with health scores and conflicts' })
  getOrchestrationDashboard(
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.commandCenterService.getOrchestrationDashboard(tenantId, token)
  }

  @Get('orchestration/conflicts')
  @ApiOperation({ summary: 'Detect cross-event resource conflicts (staff & vendor double-booking)' })
  getResourceConflicts(
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.commandCenterService.detectResourceConflicts(tenantId, token)
  }

  @Get('orchestration/alerts')
  @ApiOperation({ summary: 'Aggregated alerts: open incidents, overdue tasks, SLA breaches' })
  getOrchestrationAlerts(
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.commandCenterService.getOrchestrationAlerts(tenantId, token)
  }
}
