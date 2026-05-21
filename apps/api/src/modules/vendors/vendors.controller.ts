import { Controller, Get, Post, Put, Patch, Delete, Param, Body, Query, UseGuards, HttpCode } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { VendorsService } from './vendors.service'
import { AuthGuard } from '../../common/guards/auth.guard'
import { TenantId, CurrentUserId, AccessToken } from '../../common/decorators/tenant.decorator'

@ApiTags('Vendors')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard)
@Controller({ path: 'vendors', version: '1' })
export class VendorsController {
  constructor(private readonly vendorsService: VendorsService) {}

  @Get()
  findAll(
    @TenantId() t: string,
    @AccessToken() token: string,
    @Query('search') search?: string,
    @Query('category') category?: string,
    @Query('status') status?: string,
  ) {
    return this.vendorsService.findAll(t, token, { search, category, status })
  }

  @Get('categories')
  findCategories(@TenantId() t: string, @AccessToken() token: string) {
    return this.vendorsService.findCategories(t, token)
  }

  @Post('categories')
  createCategory(@Body() dto: any, @TenantId() t: string, @AccessToken() token: string) {
    return this.vendorsService.createCategory({ ...dto, tenant_id: t }, token)
  }

  @Get(':id')
  findOne(@Param('id') id: string, @TenantId() t: string, @AccessToken() token: string) {
    return this.vendorsService.findOne(id, t, token)
  }

  @Post()
  create(
    @Body() dto: any,
    @TenantId() t: string,
    @CurrentUserId() u: string,
    @AccessToken() token: string,
  ) {
    return this.vendorsService.create({ ...dto, tenant_id: t, created_by: u }, token)
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() dto: any,
    @TenantId() t: string,
    @AccessToken() token: string,
  ) {
    return this.vendorsService.update(id, dto, t, token)
  }

  @Patch(':id')
  patch(
    @Param('id') id: string,
    @Body() dto: any,
    @TenantId() t: string,
    @AccessToken() token: string,
  ) {
    return this.vendorsService.update(id, dto, t, token)
  }

  @Put(':id/approve')
  approve(@Param('id') id: string, @TenantId() t: string, @AccessToken() token: string) {
    return this.vendorsService.approve(id, t, token)
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string, @TenantId() t: string, @AccessToken() token: string) {
    return this.vendorsService.remove(id, t, token)
  }
}

@ApiTags('Vendors')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard)
@Controller({ path: 'events/:eventId/vendors', version: '1' })
export class EventVendorsController {
  constructor(private readonly vendorsService: VendorsService) {}

  @Get()
  getEventVendors(
    @Param('eventId') eventId: string,
    @TenantId() t: string,
    @AccessToken() token: string,
  ) {
    return this.vendorsService.getEventVendors(eventId, t, token)
  }

  @Post(':vendorId')
  assignVendor(
    @Param('eventId') eventId: string,
    @Param('vendorId') vendorId: string,
    @Body() dto: any,
    @TenantId() t: string,
    @AccessToken() token: string,
  ) {
    return this.vendorsService.assignToEvent(eventId, vendorId, dto, t, token)
  }
}
