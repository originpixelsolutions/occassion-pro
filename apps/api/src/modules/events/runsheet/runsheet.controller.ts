import { Controller, Get, Post, Patch, Param, Body, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { RunsheetService } from './runsheet.service'
import { AuthGuard } from '../../../common/guards/auth.guard'
import { RolesGuard } from '../../../common/guards/roles.guard'
import { TenantId, CurrentUserId, AccessToken } from '../../../common/decorators/tenant.decorator'

@ApiTags('Events')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard, RolesGuard)
@Controller({ path: 'events/:eventId/runsheet', version: '1' })
export class RunsheetController {
  constructor(private readonly runsheetService: RunsheetService) {}

  @Get()
  @ApiOperation({ summary: 'Get full runsheet for an event' })
  findAll(
    @Param('eventId') eventId: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.runsheetService.findByEvent(eventId, tenantId, token)
  }

  @Post()
  @ApiOperation({ summary: 'Upsert runsheet items' })
  upsert(
    @Param('eventId') eventId: string,
    @Body('items') items: any[],
    @TenantId() tenantId: string,
    @CurrentUserId() userId: string,
    @AccessToken() token: string,
  ) {
    const enriched = items.map((item) => ({
      ...item,
      event_id: eventId,
      tenant_id: tenantId,
    }))
    return this.runsheetService.upsert(enriched, token)
  }

  @Patch('reorder')
  @ApiOperation({ summary: 'Reorder runsheet items' })
  reorder(
    @Body('items') items: { id: string; order_index: number }[],
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.runsheetService.reorder(items, tenantId, token)
  }
}
