import {
  Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, ParseUUIDPipe,
} from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { ArtistsService } from './artists.service'
import { AuthGuard } from '../../common/guards/auth.guard'
import { TenantId, AccessToken, CurrentUserId } from '../../common/decorators/tenant.decorator'

@ApiTags('Artists & Talent')
@Controller({ path: 'artists', version: '1' })
@UseGuards(AuthGuard)
@ApiBearerAuth('access-token')
export class ArtistsController {
  constructor(private readonly artistsService: ArtistsService) {}

  // ── Artist Registry ──────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'List all artists in talent registry' })
  getArtists(
    @TenantId() tenantId: string,
    @AccessToken() token: string,
    @Query('category') category?: string,
    @Query('search') search?: string,
  ) {
    return this.artistsService.getArtists(tenantId, token, { category, search })
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get artist detail' })
  getArtist(@Param('id', ParseUUIDPipe) id: string, @TenantId() tenantId: string, @AccessToken() token: string) {
    return this.artistsService.getArtist(id, tenantId, token)
  }

  @Post()
  @ApiOperation({ summary: 'Create or update artist in registry' })
  upsertArtist(@Body() dto: any, @TenantId() tenantId: string, @AccessToken() token: string) {
    return this.artistsService.upsertArtist(dto, tenantId, token)
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove artist from registry' })
  deleteArtist(@Param('id', ParseUUIDPipe) id: string, @TenantId() tenantId: string, @AccessToken() token: string) {
    return this.artistsService.deleteArtist(id, tenantId, token)
  }

  // ── Event Bookings ───────────────────────────────────────────────────────────

  @Get('events/:eventId/dashboard')
  @ApiOperation({ summary: 'Artist dashboard for an event' })
  getEventDashboard(@Param('eventId', ParseUUIDPipe) eventId: string, @TenantId() tenantId: string, @AccessToken() token: string) {
    return this.artistsService.getArtistEventDashboard(eventId, tenantId, token)
  }

  @Get('events/:eventId/bookings')
  @ApiOperation({ summary: 'Get all artist bookings for an event' })
  getEventBookings(@Param('eventId', ParseUUIDPipe) eventId: string, @TenantId() tenantId: string, @AccessToken() token: string) {
    return this.artistsService.getEventBookings(eventId, tenantId, token)
  }

  @Post('events/:eventId/bookings')
  @ApiOperation({ summary: 'Create or update an artist booking for an event' })
  upsertBooking(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() dto: any,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.artistsService.upsertBooking(eventId, dto, tenantId, token)
  }

  @Get('bookings/:bookingId')
  @ApiOperation({ summary: 'Get full booking detail with riders and itinerary' })
  getBookingDetail(@Param('bookingId', ParseUUIDPipe) bookingId: string, @TenantId() tenantId: string, @AccessToken() token: string) {
    return this.artistsService.getBookingDetail(bookingId, tenantId, token)
  }

  @Patch('bookings/:id/status')
  @ApiOperation({ summary: 'Update booking status' })
  updateBookingStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { status: string },
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.artistsService.updateBookingStatus(id, dto.status, tenantId, token)
  }

  @Patch('bookings/:id/advance')
  @ApiOperation({ summary: 'Mark advance payment as paid' })
  markAdvancePaid(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { amount: number },
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.artistsService.markAdvancePaid(id, dto.amount, tenantId, token)
  }

  // ── Riders ───────────────────────────────────────────────────────────────────

  @Get('bookings/:bookingId/riders')
  @ApiOperation({ summary: 'Get rider items for a booking' })
  getRiders(@Param('bookingId', ParseUUIDPipe) bookingId: string, @TenantId() tenantId: string, @AccessToken() token: string) {
    return this.artistsService.getRiders(bookingId, tenantId, token)
  }

  @Post('bookings/:bookingId/riders')
  @ApiOperation({ summary: 'Add a rider item' })
  addRider(
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
    @Body() dto: any,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.artistsService.addRiderItem(bookingId, dto, tenantId, token)
  }

  @Post('bookings/:bookingId/riders/bulk')
  @ApiOperation({ summary: 'Bulk add rider items' })
  bulkAddRiders(
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
    @Body() dto: { items: any[] },
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.artistsService.bulkAddRiderItems(bookingId, dto.items, tenantId, token)
  }

  @Patch('riders/:id/fulfill')
  @ApiOperation({ summary: 'Mark a rider item as fulfilled' })
  fulfillRider(
    @Param('id', ParseUUIDPipe) id: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
    @CurrentUserId() userId: string,
  ) {
    return this.artistsService.fulfillRiderItem(id, userId, tenantId, token)
  }

  // ── Itinerary ────────────────────────────────────────────────────────────────

  @Get('bookings/:bookingId/itinerary')
  getItinerary(@Param('bookingId', ParseUUIDPipe) bookingId: string, @TenantId() tenantId: string, @AccessToken() token: string) {
    return this.artistsService.getItinerary(bookingId, tenantId, token)
  }

  @Post('bookings/:bookingId/itinerary')
  addItinerary(
    @Param('bookingId', ParseUUIDPipe) bookingId: string,
    @Body() dto: any,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.artistsService.addItineraryItem(bookingId, dto, tenantId, token)
  }

  @Patch('itinerary/:id/status')
  updateItineraryStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { status: string },
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.artistsService.updateItineraryStatus(id, dto.status, tenantId, token)
  }
}
