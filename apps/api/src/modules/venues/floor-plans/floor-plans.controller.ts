import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { FloorPlansService } from './floor-plans.service'
import { AuthGuard } from '../../../common/guards/auth.guard'
import { TenantId, CurrentUserId, AccessToken } from '../../../common/decorators/tenant.decorator'

@ApiTags('Floor Plans')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard)
@Controller({ path: 'venues/:venueId/floor-plans', version: '1' })
export class FloorPlansController {
  constructor(private readonly floorPlansService: FloorPlansService) {}

  @Get()
  findByVenue(
    @Param('venueId') venueId: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.floorPlansService.findByVenue(venueId, tenantId, token)
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.floorPlansService.findOne(id, tenantId, token)
  }

  @Post()
  create(
    @Param('venueId') venueId: string,
    @Body() dto: any,
    @TenantId() tenantId: string,
    @CurrentUserId() userId: string,
    @AccessToken() token: string,
  ) {
    return this.floorPlansService.create(
      { ...dto, venue_id: venueId, tenant_id: tenantId, created_by: userId },
      token,
    )
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() dto: any,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.floorPlansService.update(id, dto, tenantId, token)
  }

  @Post(':id/zones')
  upsertZone(
    @Param('id') floorPlanId: string,
    @Body() dto: any,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.floorPlansService.upsertZone(floorPlanId, dto, tenantId, token)
  }

  @Delete(':id/zones/:zoneId')
  deleteZone(
    @Param('zoneId') zoneId: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.floorPlansService.deleteZone(zoneId, tenantId, token)
  }

  @Post(':id/assign-event/:eventId')
  assignToEvent(
    @Param('id') floorPlanId: string,
    @Param('eventId') eventId: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.floorPlansService.assignToEvent(floorPlanId, eventId, tenantId, token)
  }
}
