import {
  Controller, Get, Post, Patch, Delete, Param, Body, Query,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { AccommodationService } from './accommodation.service'
import { AuthGuard } from '../../../common/guards/auth.guard'
import { TenantId, AccessToken, CurrentUserId } from '../../../common/decorators/tenant.decorator'

@ApiTags('Accommodation')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard)
@Controller({ path: 'accommodation', version: '1' })
export class AccommodationController {
  constructor(private readonly svc: AccommodationService) {}

  // ── Hotels ─────────────────────────────────────────────────────────────────

  @Get('hotels')
  listHotels(@TenantId() t: string, @AccessToken() token: string) {
    return this.svc.listHotels(t, token)
  }

  @Post('hotels')
  createHotel(@Body() dto: any, @TenantId() t: string, @AccessToken() token: string) {
    return this.svc.createHotel(t, dto, token)
  }

  @Get('hotels/:hotelId')
  getHotel(@Param('hotelId') id: string, @TenantId() t: string, @AccessToken() token: string) {
    return this.svc.getHotel(id, t, token)
  }

  @Patch('hotels/:hotelId')
  updateHotel(
    @Param('hotelId') id: string, @Body() dto: any,
    @TenantId() t: string, @AccessToken() token: string,
  ) {
    return this.svc.updateHotel(id, t, dto, token)
  }

  @Delete('hotels/:hotelId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteHotel(@Param('hotelId') id: string, @TenantId() t: string, @AccessToken() token: string) {
    return this.svc.deleteHotel(id, t, token)
  }

  // ── Rooms ──────────────────────────────────────────────────────────────────

  @Get('hotels/:hotelId/rooms')
  listRooms(
    @Param('hotelId') hotelId: string,
    @TenantId() t: string, @AccessToken() token: string,
  ) {
    return this.svc.listRooms(hotelId, t, token)
  }

  @Post('hotels/:hotelId/rooms')
  createRoom(
    @Param('hotelId') hotelId: string, @Body() dto: any,
    @TenantId() t: string, @AccessToken() token: string,
  ) {
    return this.svc.createRoom(hotelId, t, dto, token)
  }

  @Patch('rooms/:roomId')
  updateRoom(
    @Param('roomId') id: string, @Body() dto: any,
    @TenantId() t: string, @AccessToken() token: string,
  ) {
    return this.svc.updateRoom(id, t, dto, token)
  }

  // ── Bookings ───────────────────────────────────────────────────────────────

  @Get('events/:eventId/bookings')
  listBookings(
    @Param('eventId') eventId: string,
    @TenantId() t: string, @AccessToken() token: string,
    @Query('hotelId') hotelId?: string,
    @Query('status') status?: string,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ) {
    return this.svc.listBookings(eventId, t, token, { hotelId, status, page, pageSize })
  }

  @Post('events/:eventId/bookings')
  createBooking(
    @Param('eventId') eventId: string, @Body() dto: any,
    @TenantId() t: string, @CurrentUserId() uid: string, @AccessToken() token: string,
  ) {
    return this.svc.createBooking(eventId, t, dto, uid, token)
  }

  @Post('events/:eventId/bookings/bulk-assign')
  bulkAssign(
    @Param('eventId') eventId: string,
    @Body() body: {
      guestIds: string[]; hotelId: string; roomType: string
      checkIn: string; checkOut: string
    },
    @TenantId() t: string, @CurrentUserId() uid: string, @AccessToken() token: string,
  ) {
    return this.svc.bulkAssign(
      eventId, t, body.guestIds, body.hotelId,
      body.roomType, body.checkIn, body.checkOut, uid, token,
    )
  }

  @Patch('bookings/:bookingId')
  updateBooking(
    @Param('bookingId') id: string, @Body() dto: any,
    @TenantId() t: string, @AccessToken() token: string,
  ) {
    return this.svc.updateBooking(id, t, dto, token)
  }

  @Post('bookings/:bookingId/cancel')
  @HttpCode(HttpStatus.OK)
  cancelBooking(
    @Param('bookingId') id: string,
    @TenantId() t: string, @AccessToken() token: string,
  ) {
    return this.svc.cancelBooking(id, t, token)
  }

  @Post('bookings/:bookingId/mark-voucher-sent')
  @HttpCode(HttpStatus.OK)
  markVoucherSent(
    @Param('bookingId') id: string,
    @TenantId() t: string, @AccessToken() token: string,
  ) {
    return this.svc.markVoucherSent(id, t, token)
  }

  @Get('events/:eventId/stats')
  getOccupancyStats(
    @Param('eventId') eventId: string,
    @TenantId() t: string, @AccessToken() token: string,
  ) {
    return this.svc.getOccupancyStats(t, eventId, token)
  }
}
