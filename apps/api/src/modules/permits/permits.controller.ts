import {
  Controller, Get, Post, Patch, Delete,
  Param, Query, Body, Headers, UseGuards, HttpCode, HttpStatus
} from '@nestjs/common'
import { PermitsService } from './permits.service'
import { AuthGuard } from '../auth/auth.guard'

@Controller({ path: 'permits', version: '1' })
@UseGuards(AuthGuard)
export class PermitsController {
  constructor(private readonly svc: PermitsService) {}

  // ── Permits ────────────────────────────────────────────────────────────────

  @Get('events/:eventId')
  listPermits(
    @Param('eventId') eventId: string,
    @Headers('x-tenant-id') tenantId: string,
    @Headers('authorization') auth: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('critical_only') criticalOnly?: string,
  ) {
    const token = auth?.replace('Bearer ', '')
    return this.svc.listPermits(eventId, tenantId, token, {
      status,
      type,
      critical_only: criticalOnly === 'true',
    })
  }

  @Get('events/:eventId/stats')
  getPermitStats(
    @Param('eventId') eventId: string,
    @Headers('x-tenant-id') tenantId: string,
    @Headers('authorization') auth: string,
  ) {
    const token = auth?.replace('Bearer ', '')
    return this.svc.getPermitStats(eventId, tenantId, token)
  }

  @Get('events/:eventId/expiry-timeline')
  getExpiryTimeline(
    @Param('eventId') eventId: string,
    @Headers('x-tenant-id') tenantId: string,
    @Headers('authorization') auth: string,
  ) {
    const token = auth?.replace('Bearer ', '')
    return this.svc.getExpiryTimeline(eventId, tenantId, token)
  }

  @Get(':id')
  getPermit(
    @Param('id') id: string,
    @Headers('x-tenant-id') tenantId: string,
    @Headers('authorization') auth: string,
  ) {
    const token = auth?.replace('Bearer ', '')
    return this.svc.getPermit(id, tenantId, token)
  }

  @Post()
  createPermit(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('authorization') auth: string,
    @Body() body: any,
  ) {
    const token = auth?.replace('Bearer ', '')
    return this.svc.createPermit(tenantId, token, body)
  }

  @Patch(':id')
  updatePermit(
    @Param('id') id: string,
    @Headers('x-tenant-id') tenantId: string,
    @Headers('authorization') auth: string,
    @Body() body: any,
  ) {
    const token = auth?.replace('Bearer ', '')
    return this.svc.updatePermit(id, tenantId, token, body)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deletePermit(
    @Param('id') id: string,
    @Headers('x-tenant-id') tenantId: string,
    @Headers('authorization') auth: string,
  ) {
    const token = auth?.replace('Bearer ', '')
    return this.svc.deletePermit(id, tenantId, token)
  }

  // ── Legal Documents ────────────────────────────────────────────────────────

  @Get('events/:eventId/legal')
  listLegalDocs(
    @Param('eventId') eventId: string,
    @Headers('x-tenant-id') tenantId: string,
    @Headers('authorization') auth: string,
  ) {
    const token = auth?.replace('Bearer ', '')
    return this.svc.listLegalDocs(eventId, tenantId, token)
  }

  @Post('legal')
  createLegalDoc(
    @Headers('x-tenant-id') tenantId: string,
    @Headers('authorization') auth: string,
    @Body() body: any,
  ) {
    const token = auth?.replace('Bearer ', '')
    return this.svc.createLegalDoc(tenantId, token, body)
  }

  @Patch('legal/:id')
  updateLegalDoc(
    @Param('id') id: string,
    @Headers('x-tenant-id') tenantId: string,
    @Headers('authorization') auth: string,
    @Body() body: any,
  ) {
    const token = auth?.replace('Bearer ', '')
    return this.svc.updateLegalDoc(id, tenantId, token, body)
  }

  @Delete('legal/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteLegalDoc(
    @Param('id') id: string,
    @Headers('x-tenant-id') tenantId: string,
    @Headers('authorization') auth: string,
  ) {
    const token = auth?.replace('Bearer ', '')
    return this.svc.deleteLegalDoc(id, tenantId, token)
  }
}
