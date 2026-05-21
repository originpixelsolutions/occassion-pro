import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, HttpCode } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { VenuesService } from './venues.service'
import { AuthGuard } from '../../common/guards/auth.guard'
import { TenantId, CurrentUserId, AccessToken } from '../../common/decorators/tenant.decorator'

@ApiTags('Venues')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard)
@Controller({ path: 'venues', version: '1' })
export class VenuesController {
  constructor(private readonly venuesService: VenuesService) {}

  @Get()
  findAll(
    @TenantId() t: string,
    @AccessToken() token: string,
    @Query('search') s?: string,
    @Query('city') c?: string,
  ) {
    return this.venuesService.findAll(t, token, { search: s, city: c })
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get venue by ID' })
  findOne(@Param('id') id: string, @TenantId() t: string, @AccessToken() token: string) {
    return this.venuesService.findOne(id, t, token)
  }

  @Post()
  create(@Body() dto: any, @TenantId() t: string, @CurrentUserId() u: string, @AccessToken() token: string) {
    return this.venuesService.create({ ...dto, tenant_id: t, created_by: u }, token)
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a venue' })
  update(@Param('id') id: string, @Body() dto: any, @TenantId() t: string, @AccessToken() token: string) {
    return this.venuesService.update(id, t, dto, token)
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a venue' })
  remove(@Param('id') id: string, @TenantId() t: string, @AccessToken() token: string) {
    return this.venuesService.remove(id, t, token)
  }
}
