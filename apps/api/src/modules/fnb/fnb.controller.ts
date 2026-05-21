import {
  Controller, Get, Post, Patch, Delete, Param, Body, Query,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { FnbService } from './fnb.service'
import { AuthGuard } from '../../common/guards/auth.guard'
import { TenantId, AccessToken, CurrentUserId } from '../../common/decorators/tenant.decorator'

@ApiTags('F&B')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard)
@Controller({ path: 'fnb', version: '1' })
export class FnbController {
  constructor(private readonly svc: FnbService) {}

  // ── Dashboard ─────────────────────────────────────────────────────────────────

  @Get('events/:eventId/dashboard')
  getDashboard(
    @Param('eventId') eventId: string,
    @TenantId() t: string, @AccessToken() token: string,
  ) {
    return this.svc.getDashboard(eventId, t, token)
  }

  // ── Menus ────────────────────────────────────────────────────────────────────

  @Get('events/:eventId/menus')
  getMenus(
    @Param('eventId') eventId: string,
    @TenantId() t: string, @AccessToken() token: string,
  ) {
    return this.svc.getMenus(eventId, t, token)
  }

  @Post('events/:eventId/menus')
  createMenu(
    @Param('eventId') eventId: string,
    @Body() dto: any,
    @TenantId() t: string, @AccessToken() token: string,
  ) {
    return this.svc.createMenu(eventId, t, dto, token)
  }

  @Get('menus/:menuId')
  getMenu(
    @Param('menuId') id: string,
    @TenantId() t: string, @AccessToken() token: string,
  ) {
    return this.svc.getMenu(id, t, token)
  }

  @Patch('menus/:menuId')
  updateMenu(
    @Param('menuId') id: string, @Body() dto: any,
    @TenantId() t: string, @AccessToken() token: string,
  ) {
    return this.svc.updateMenu(id, t, dto, token)
  }

  @Delete('menus/:menuId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteMenu(
    @Param('menuId') id: string,
    @TenantId() t: string, @AccessToken() token: string,
  ) {
    return this.svc.deleteMenu(id, t, token)
  }

  // ── Menu Items ───────────────────────────────────────────────────────────────

  @Get('menus/:menuId/items')
  getMenuItems(
    @Param('menuId') menuId: string,
    @TenantId() t: string, @AccessToken() token: string,
  ) {
    return this.svc.getMenuItems(menuId, t, token)
  }

  @Post('menus/:menuId/items')
  createMenuItem(
    @Param('menuId') menuId: string, @Body() dto: any,
    @TenantId() t: string, @AccessToken() token: string,
  ) {
    return this.svc.createMenuItem(menuId, dto.event_id, t, dto, token)
  }

  @Post('menus/:menuId/items/bulk')
  bulkCreateMenuItems(
    @Param('menuId') menuId: string,
    @Body() body: { event_id: string; items: any[] },
    @TenantId() t: string, @AccessToken() token: string,
  ) {
    return this.svc.bulkCreateMenuItems(menuId, body.event_id, t, body.items, token)
  }

  @Patch('items/:itemId')
  updateMenuItem(
    @Param('itemId') id: string, @Body() dto: any,
    @TenantId() t: string, @AccessToken() token: string,
  ) {
    return this.svc.updateMenuItem(id, t, dto, token)
  }

  @Delete('items/:itemId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteMenuItem(
    @Param('itemId') id: string,
    @TenantId() t: string, @AccessToken() token: string,
  ) {
    return this.svc.deleteMenuItem(id, t, token)
  }

  // ── Token Batches ─────────────────────────────────────────────────────────────

  @Get('events/:eventId/token-batches')
  getTokenBatches(
    @Param('eventId') eventId: string,
    @TenantId() t: string, @AccessToken() token: string,
  ) {
    return this.svc.getTokenBatches(eventId, t, token)
  }

  @Post('events/:eventId/token-batches')
  createTokenBatch(
    @Param('eventId') eventId: string, @Body() dto: any,
    @TenantId() t: string, @CurrentUserId() uid: string, @AccessToken() token: string,
  ) {
    return this.svc.createTokenBatch(eventId, t, dto, uid, token)
  }

  @Get('token-batches/:batchId/tokens')
  getBatchTokens(
    @Param('batchId') batchId: string,
    @TenantId() t: string, @AccessToken() token: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.getBatchTokens(batchId, t, token, status, Number(page ?? 1), Number(limit ?? 50))
  }

  // ── Token Operations ──────────────────────────────────────────────────────────

  @Post('token-batches/:batchId/issue')
  issueToken(
    @Param('batchId') batchId: string,
    @Body() body: { guest_id: string },
    @TenantId() t: string, @AccessToken() token: string,
  ) {
    return this.svc.issueTokenToGuest(batchId, body.guest_id, t, token)
  }

  @Post('token-batches/:batchId/bulk-issue')
  bulkIssueTokens(
    @Param('batchId') batchId: string,
    @Body() body: { guest_ids: string[] },
    @TenantId() t: string, @AccessToken() token: string,
  ) {
    return this.svc.bulkIssueTokens(batchId, body.guest_ids, t, token)
  }

  @Post('tokens/redeem')
  redeemToken(
    @Body() body: { token_code: string; serving_station?: string },
    @TenantId() t: string, @CurrentUserId() uid: string, @AccessToken() token: string,
  ) {
    return this.svc.redeemToken(body.token_code, uid, body.serving_station ?? '', t, token)
  }

  @Post('tokens/:tokenId/void')
  voidToken(
    @Param('tokenId') tokenId: string,
    @TenantId() t: string, @AccessToken() token: string,
  ) {
    return this.svc.voidToken(tokenId, t, token)
  }

  // ── Consumption Log ──────────────────────────────────────────────────────────

  @Get('events/:eventId/consumption')
  listConsumption(
    @Param('eventId') eventId: string,
    @TenantId() t: string, @AccessToken() token: string,
    @Query('station') station?: string,
    @Query('menu_item_id') menuItemId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.svc.listConsumptionLog(eventId, t, token, { station, menuItemId, from, to })
  }

  @Post('events/:eventId/consumption')
  logConsumption(
    @Param('eventId') eventId: string, @Body() dto: any,
    @TenantId() t: string, @CurrentUserId() uid: string, @AccessToken() token: string,
  ) {
    return this.svc.logConsumption(eventId, t, dto, uid, token)
  }

  // ── Serving Stations ─────────────────────────────────────────────────────────

  @Get('events/:eventId/stations')
  getStations(
    @Param('eventId') eventId: string,
    @TenantId() t: string, @AccessToken() token: string,
  ) {
    return this.svc.getStations(eventId, t, token)
  }

  @Post('events/:eventId/stations')
  createStation(
    @Param('eventId') eventId: string, @Body() dto: any,
    @TenantId() t: string, @CurrentUserId() uid: string, @AccessToken() token: string,
  ) {
    return this.svc.createStation(eventId, t, dto, uid, token)
  }

  @Patch('stations/:stationId')
  updateStation(
    @Param('stationId') id: string, @Body() dto: any,
    @TenantId() t: string, @AccessToken() token: string,
  ) {
    return this.svc.updateStation(id, t, dto, token)
  }

  @Delete('stations/:stationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteStation(
    @Param('stationId') id: string,
    @TenantId() t: string, @AccessToken() token: string,
  ) {
    return this.svc.deleteStation(id, t, token)
  }

  // ── Reports ───────────────────────────────────────────────────────────────────

  @Get('events/:eventId/reports/consumption')
  getConsumptionReport(
    @Param('eventId') eventId: string,
    @TenantId() t: string, @AccessToken() token: string,
  ) {
    return this.svc.getConsumptionReport(eventId, t, token)
  }

  @Get('events/:eventId/reports/budget')
  getBudgetSummary(
    @Param('eventId') eventId: string,
    @TenantId() t: string, @AccessToken() token: string,
  ) {
    return this.svc.getBudgetSummary(eventId, t, token)
  }
}
