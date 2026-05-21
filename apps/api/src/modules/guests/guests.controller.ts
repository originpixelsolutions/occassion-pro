import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, HttpCode } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { GuestsService } from './guests.service'
import { AuthGuard } from '../../common/guards/auth.guard'
import { TenantId, AccessToken, CurrentUserId } from '../../common/decorators/tenant.decorator'

@ApiTags('Guests')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard)
@Controller({ path: 'events/:eventId/guests', version: '1' })
export class GuestsController {
  constructor(private readonly guestsService: GuestsService) {}

  @Get('stats/rsvp')
  getRsvpStats(@Param('eventId') eventId: string, @TenantId() t: string, @AccessToken() token: string) {
    return this.guestsService.getRsvpStats(eventId, t, token)
  }

  @Get()
  findAll(
    @Param('eventId') eventId: string,
    @TenantId() t: string,
    @AccessToken() token: string,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('rsvpStatus') rsvpStatus?: string,
    @Query('search') search?: string,
  ) {
    return this.guestsService.findAll(eventId, t, token, { page, pageSize, rsvpStatus, search })
  }

  @Get(':id')
  findOne(@Param('id') id: string, @TenantId() t: string, @AccessToken() token: string) {
    return this.guestsService.findOne(id, t, token)
  }

  @Post()
  create(
    @Param('eventId') eventId: string,
    @Body() dto: any,
    @TenantId() t: string,
    @CurrentUserId() u: string,
    @AccessToken() token: string,
  ) {
    return this.guestsService.create({ ...dto, event_id: eventId, tenant_id: t, invited_by: u }, token)
  }

  @Post('bulk-import')
  bulkImport(
    @Param('eventId') eventId: string,
    @Body('guests') guests: any[],
    @TenantId() t: string,
    @AccessToken() token: string,
  ) {
    return this.guestsService.bulkImport(guests, eventId, t, token)
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: any, @TenantId() t: string, @AccessToken() token: string) {
    return this.guestsService.update(id, t, dto, token)
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string, @TenantId() t: string, @AccessToken() token: string) {
    return this.guestsService.remove(id, t, token)
  }

  @Post(':id/check-in')
  checkIn(@Param('id') id: string, @TenantId() t: string, @AccessToken() token: string) {
    return this.guestsService.checkIn(id, t, token)
  }

  // ── Copy between events ──────────────────────────────────────────────────────

  @Get('copy/preview')
  previewCopy(
    @Param('eventId') eventId: string,
    @Query('sourceEventId') sourceEventId: string,
    @TenantId() t: string,
    @AccessToken() token: string,
  ) {
    return this.guestsService.previewCopy(sourceEventId, eventId, t, token)
  }

  @Post('copy')
  copyGuests(
    @Param('eventId') eventId: string,
    @Body('sourceEventId') sourceEventId: string,
    @Body('duplicateStrategy') duplicateStrategy: 'skip' | 'overwrite' | 'add_anyway' = 'skip',
    @TenantId() t: string,
    @CurrentUserId() userId: string,
    @AccessToken() token: string,
  ) {
    return this.guestsService.copyGuests(sourceEventId, eventId, t, userId, duplicateStrategy, token)
  }

  @Get('copy/jobs')
  getCopyJobs(
    @Param('eventId') eventId: string,
    @TenantId() t: string,
    @AccessToken() token: string,
  ) {
    return this.guestsService.getCopyJobs(eventId, t, token)
  }
}

// ── Standalone /guests (no event context) ────────────────────────────────────
@ApiTags('Guests')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard)
@Controller({ path: 'guests', version: '1' })
export class StandaloneGuestsController {
  constructor(private readonly guestsService: GuestsService) {}

  @Get()
  findAllTenant(@TenantId() t: string, @AccessToken() token: string, @Query('search') search?: string, @Query('rsvpStatus') rsvpStatus?: string) {
    return this.guestsService.findAllTenant(t, token, { search, rsvpStatus })
  }

  @Post()
  create(@Body() dto: any, @TenantId() t: string, @CurrentUserId() u: string, @AccessToken() token: string) {
    return this.guestsService.create({ ...dto, tenant_id: t, invited_by: u }, token)
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: any, @TenantId() t: string, @AccessToken() token: string) {
    return this.guestsService.update(id, t, dto, token)
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string, @TenantId() t: string, @AccessToken() token: string) {
    return this.guestsService.remove(id, t, token)
  }

  @Post(':id/check-in')
  checkIn(@Param('id') id: string, @TenantId() t: string, @AccessToken() token: string) {
    return this.guestsService.checkIn(id, t, token)
  }
}
