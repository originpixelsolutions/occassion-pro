import {
  Controller, Get, Post, Put, Patch, Delete,
  Param, Body, Query, UseGuards, HttpCode,
} from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { InventoryService } from './inventory.service'
import { AuthGuard } from '../../common/guards/auth.guard'
import { TenantId, CurrentUserId, AccessToken } from '../../common/decorators/tenant.decorator'

@ApiTags('Inventory')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard)
@Controller({ path: 'inventory', version: '1' })
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  findAll(
    @TenantId() t: string,
    @AccessToken() token: string,
    @Query('search') search?: string,
    @Query('category') category?: string,
    @Query('status') status?: string,
  ) {
    return this.inventoryService.findItems(t, token, { search, category, status })
  }

  @Get('low-stock')
  getLowStock(@TenantId() t: string, @AccessToken() token: string) {
    return this.inventoryService.getLowStockAlerts(t, token)
  }

  @Get('categories')
  findCategories(@TenantId() t: string, @AccessToken() token: string) {
    return this.inventoryService.findCategories(t, token)
  }

  @Post('categories')
  createCategory(@Body() dto: any, @TenantId() t: string, @AccessToken() token: string) {
    return this.inventoryService.createCategory({ ...dto, tenant_id: t }, token)
  }

  @Get(':id')
  findOne(@Param('id') id: string, @TenantId() t: string, @AccessToken() token: string) {
    return this.inventoryService.findOne(id, t, token)
  }

  @Post()
  create(
    @Body() dto: any,
    @TenantId() t: string,
    @CurrentUserId() u: string,
    @AccessToken() token: string,
  ) {
    return this.inventoryService.createItem({ ...dto, tenant_id: t, created_by: u }, token)
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() dto: any,
    @TenantId() t: string,
    @AccessToken() token: string,
  ) {
    return this.inventoryService.updateItem(id, dto, t, token)
  }

  @Patch(':id')
  partialUpdate(
    @Param('id') id: string,
    @Body() dto: any,
    @TenantId() t: string,
    @AccessToken() token: string,
  ) {
    return this.inventoryService.updateItem(id, dto, t, token)
  }

  @Post(':id/adjust')
  adjustStock(
    @Param('id') id: string,
    @Body() body: { adjustment: number; reason: string },
    @TenantId() t: string,
    @CurrentUserId() u: string,
    @AccessToken() token: string,
  ) {
    return this.inventoryService.adjustStock(id, body.adjustment, body.reason, t, u, token)
  }

  @Delete(':id')
  @HttpCode(204)
  remove(
    @Param('id') id: string,
    @TenantId() t: string,
    @AccessToken() token: string,
  ) {
    return this.inventoryService.remove(id, t, token)
  }
}

@ApiTags('Inventory')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard)
@Controller({ path: 'events/:eventId/inventory', version: '1' })
export class EventInventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  getAllocations(
    @Param('eventId') eventId: string,
    @TenantId() t: string,
    @AccessToken() token: string,
  ) {
    return this.inventoryService.getEventAllocations(eventId, t, token)
  }

  @Post()
  allocate(
    @Param('eventId') eventId: string,
    @Body() dto: any,
    @TenantId() t: string,
    @AccessToken() token: string,
  ) {
    return this.inventoryService.allocateToEvent(eventId, dto, t, token)
  }
}
