import {
  Controller, Get, Post, Patch, Delete, Param, Body,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { TableConfigService } from './table-config.service'
import { AuthGuard } from '../../../common/guards/auth.guard'
import { TenantId, AccessToken } from '../../../common/decorators/tenant.decorator'

@ApiTags('Guest Table Config')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard)
@Controller({ path: 'events/:eventId/guest-table-config', version: '1' })
export class TableConfigController {
  constructor(private readonly svc: TableConfigService) {}

  // ── Layout ─────────────────────────────────────────────────────────────────
  @Get('layout')
  getLayout(@Param('eventId') e: string, @TenantId() t: string, @AccessToken() token: string) {
    return this.svc.getLayout(e, t, token)
  }
  @Post('layout')
  saveLayout(@Param('eventId') e: string, @Body() dto: any, @TenantId() t: string, @AccessToken() token: string) {
    return this.svc.saveLayout(e, t, dto, token)
  }

  // ── Views ──────────────────────────────────────────────────────────────────
  @Get('views')
  listViews(@Param('eventId') e: string, @TenantId() t: string, @AccessToken() token: string) {
    return this.svc.listViews(e, t, token)
  }
  @Post('views')
  createView(@Param('eventId') e: string, @Body() dto: any, @TenantId() t: string, @AccessToken() token: string) {
    return this.svc.createView(e, t, dto, token)
  }
  @Patch('views/:viewId')
  updateView(@Param('viewId') id: string, @Body() dto: any, @TenantId() t: string, @AccessToken() token: string) {
    return this.svc.updateView(id, t, dto, token)
  }
  @Delete('views/:viewId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteView(@Param('viewId') id: string, @TenantId() t: string, @AccessToken() token: string) {
    return this.svc.deleteView(id, t, token)
  }

  // ── Custom Columns ─────────────────────────────────────────────────────────
  @Get('custom-columns')
  listCustomColumns(@Param('eventId') e: string, @TenantId() t: string, @AccessToken() token: string) {
    return this.svc.listCustomColumns(e, t, token)
  }
  @Post('custom-columns')
  createCustomColumn(@Param('eventId') e: string, @Body() dto: any, @TenantId() t: string, @AccessToken() token: string) {
    return this.svc.createCustomColumn(e, t, dto, token)
  }
  @Patch('custom-columns/:colId')
  updateCustomColumn(@Param('colId') id: string, @Body() dto: any, @TenantId() t: string, @AccessToken() token: string) {
    return this.svc.updateCustomColumn(id, t, dto, token)
  }
  @Delete('custom-columns/:colId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteCustomColumn(@Param('colId') id: string, @TenantId() t: string, @AccessToken() token: string) {
    return this.svc.deleteCustomColumn(id, t, token)
  }

  @Patch('guests/:guestId/custom-data')
  updateGuestCustomData(
    @Param('guestId') guestId: string,
    @Body() body: { customData: Record<string, any> },
    @TenantId() t: string,
    @AccessToken() token: string,
  ) {
    return this.svc.updateGuestCustomData(guestId, t, body.customData, token)
  }

  // ── Conditional Formatting ─────────────────────────────────────────────────
  @Get('formatting')
  listFormatting(@Param('eventId') e: string, @TenantId() t: string, @AccessToken() token: string) {
    return this.svc.listFormattingRules(e, t, token)
  }
  @Post('formatting')
  saveFormatting(
    @Param('eventId') e: string,
    @Body('rules') rules: any[],
    @TenantId() t: string,
    @AccessToken() token: string,
  ) {
    return this.svc.saveFormattingRules(e, t, rules, token)
  }
}

// Public: load a shared view by token
@ApiTags('Guest Table Config — Public')
@Controller({ path: 'public/guest-table-views', version: '1' })
export class PublicTableViewController {
  constructor(private readonly svc: TableConfigService) {}
  @Get(':shareToken')
  getByToken(@Param('shareToken') token: string) {
    return this.svc.getViewByToken(token)
  }
}
