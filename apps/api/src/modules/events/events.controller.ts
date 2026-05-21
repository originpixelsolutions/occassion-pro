import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, UseGuards, Version,
  HttpCode, HttpStatus, Headers, ForbiddenException,
} from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger'
import { ThrottlerGuard } from '@nestjs/throttler'
import { EventsService } from './events.service'
import { AuthGuard } from '../../common/guards/auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { TenantId, CurrentUserId, AccessToken } from '../../common/decorators/tenant.decorator'
import { CreateEventDto } from './dto/create-event.dto'
import { UpdateEventDto } from './dto/update-event.dto'

@ApiTags('Events')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard, RolesGuard, ThrottlerGuard)
@Controller({ path: 'events', version: '1' })
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get('stats/dashboard')
  @ApiOperation({ summary: 'Get event dashboard KPIs' })
  getDashboard(
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.eventsService.getDashboardStats(tenantId, token)
  }

  @Get()
  @ApiOperation({ summary: 'List all events for the tenant' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'search', required: false })
  findAll(
    @TenantId() tenantId: string,
    @AccessToken() token: string,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('status') status?: string,
    @Query('category') category?: string,
    @Query('search') search?: string,
  ) {
    return this.eventsService.findAll(tenantId, token, {
      page, pageSize, status, category, search,
    })
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single event with full details' })
  findOne(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.eventsService.findOne(id, tenantId, token)
  }

  @Post()
  @Roles('company_admin', 'event_manager')
  @ApiOperation({ summary: 'Create a new event' })
  create(
    @Body() dto: CreateEventDto,
    @TenantId() tenantId: string,
    @CurrentUserId() userId: string,
    @AccessToken() token: string,
  ) {
    return this.eventsService.create(
      { ...dto, tenant_id: tenantId, created_by: userId },
      token,
    )
  }

  @Patch(':id')
  @Roles('company_admin', 'event_manager')
  @ApiOperation({ summary: 'Update an event' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateEventDto,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.eventsService.update(id, tenantId, dto, token)
  }

  @Delete(':id')
  @Roles('company_admin', 'event_manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft-delete an event (30-day trash)' })
  softDelete(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @CurrentUserId() userId: string,
    @AccessToken() token: string,
  ) {
    return this.eventsService.softDelete(id, tenantId, userId, token)
  }

  // ─── Trash / soft-delete management ─────────────────────────────────────

  @Get('deleted')
  @ApiOperation({ summary: 'List soft-deleted events' })
  getDeleted(
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.eventsService.getDeleted(tenantId, token)
  }

  @Post(':id/restore')
  @Roles('company_admin', 'event_manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Restore a soft-deleted event from trash' })
  restore(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.eventsService.restore(id, tenantId, token)
  }

  @Delete(':id/permanent')
  @Roles('company_admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Permanently delete an event (requires X-Confirm-Delete: true header)' })
  permanentDelete(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
    @Headers('x-confirm-delete') confirmHeader: string,
  ) {
    if (confirmHeader !== 'true') {
      throw new ForbiddenException('Permanent deletion requires X-Confirm-Delete: true header.')
    }
    return this.eventsService.permanentDelete(id, tenantId, token)
  }
}
