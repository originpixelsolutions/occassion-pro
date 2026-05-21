import { Controller, Get, Post, Patch, Param, Body, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { TasksService } from './tasks.service'
import { AuthGuard } from '../../../common/guards/auth.guard'
import { RolesGuard } from '../../../common/guards/roles.guard'
import { TenantId, CurrentUserId, AccessToken } from '../../../common/decorators/tenant.decorator'

@ApiTags('Events')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard, RolesGuard)
@Controller({ path: 'events/:eventId/tasks', version: '1' })
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  @ApiOperation({ summary: 'List tasks for an event' })
  findAll(
    @Param('eventId') eventId: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.tasksService.findByEvent(eventId, tenantId, token)
  }

  @Post()
  @ApiOperation({ summary: 'Create a task' })
  create(
    @Param('eventId') eventId: string,
    @Body() dto: any,
    @TenantId() tenantId: string,
    @CurrentUserId() userId: string,
    @AccessToken() token: string,
  ) {
    return this.tasksService.create(
      { ...dto, event_id: eventId, tenant_id: tenantId, created_by: userId },
      token,
    )
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update task status' })
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.tasksService.updateStatus(id, tenantId, status, token)
  }

  @Post('bulk')
  @ApiOperation({ summary: 'Bulk create tasks (e.g. from AI suggestions)' })
  bulkCreate(
    @Param('eventId') eventId: string,
    @Body('tasks') tasks: any[],
    @TenantId() tenantId: string,
    @CurrentUserId() userId: string,
    @AccessToken() token: string,
  ) {
    const enriched = tasks.map((t) => ({
      ...t,
      event_id: eventId,
      tenant_id: tenantId,
      created_by: userId,
    }))
    return this.tasksService.bulkCreate(enriched, token)
  }
}
