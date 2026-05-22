/**
 * OccasionPro — Guest Portal Controller
 *
 * Public (no auth) endpoints — OTP login flow + portal data
 * Staff endpoints — portal settings management
 */

import {
  Controller, Post, Get, Put, Patch, Delete, Body, Param, Headers,
  HttpCode, HttpStatus, UnauthorizedException, UseGuards, Request,
  ParseUUIDPipe, Res,
} from '@nestjs/common'
import type { Response } from 'express'
import { GuestPortalService } from './guest-portal.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { TenantGuard } from '../auth/guards/tenant.guard'

// ─── DTOs ─────────────────────────────────────────────────────────────────────

class RequestOtpDto {
  mobile: string
}

class VerifyOtpDto {
  mobile: string
  otp: string
}

class SendMessageDto {
  message: string
}

class PortalSettingsDto {
  login_enabled?: boolean
  allow_self_register?: boolean
  otp_delivery?: 'sms' | 'whatsapp' | 'both'
  session_duration?: 'event_day' | '7d' | '30d'
  not_on_list_message?: string
  portal_title?: string
  hero_image_url?: string
  brand_color?: string
  welcome_message?: string
  footer_text?: string
  hide_powered_by?: boolean
  section_invitation?: boolean
  section_rsvp?: boolean
  section_event_details?: boolean
  section_accommodation?: boolean
  section_transport?: boolean
  section_meal?: boolean
  section_qr_code?: boolean
  section_seating?: boolean
  section_schedule?: boolean
  section_gallery?: boolean
  section_contact?: boolean
  section_survey?: boolean
  section_gift_registry?: boolean
  section_sessions?: boolean
}

// ─── CONTROLLER ───────────────────────────────────────────────────────────────

@Controller('guest-portal')
export class GuestPortalController {
  constructor(private readonly service: GuestPortalService) {}

  // ─── Public: OTP Request ──────────────────────────────────────────────────

  @Post(':eventId/otp/request')
  @HttpCode(HttpStatus.OK)
  async requestOtp(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() dto: RequestOtpDto,
  ) {
    return this.service.requestOTP(eventId, dto.mobile)
  }

  // ─── Public: OTP Verify + set httpOnly cookie ─────────────────────────────

  @Post(':eventId/otp/verify')
  @HttpCode(HttpStatus.OK)
  async verifyOtp(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() dto: VerifyOtpDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.service.verifyOTP(eventId, dto.mobile, dto.otp)

    // Set httpOnly cookie — 7 days default
    res.cookie('gp_token', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    })

    return { success: true, guest_id: result.guest_id, is_new_guest: result.is_new_guest }
  }

  // ─── Public: Portal Data (requires gp_token cookie) ──────────────────────

  @Get(':eventId/portal')
  async getPortalData(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Headers('cookie') cookieHeader: string,
  ) {
    const token = this.extractGuestToken(cookieHeader)
    return this.service.getPortalData(eventId, token)
  }

  // ─── Public: Send Message to Organiser ────────────────────────────────────

  @Post(':eventId/messages')
  @HttpCode(HttpStatus.CREATED)
  async sendMessage(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Headers('cookie') cookieHeader: string,
    @Body() dto: SendMessageDto,
  ) {
    const token = this.extractGuestToken(cookieHeader)
    return this.service.sendMessage(eventId, token, dto.message)
  }

  // ─── Public: Logout ───────────────────────────────────────────────────────

  @Post(':eventId/logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Headers('cookie') cookieHeader: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.clearCookie('gp_token', { path: '/' })
    return { success: true }
  }

  // ─── Staff: Get Portal Settings ───────────────────────────────────────────

  @Get(':eventId/settings')
  @UseGuards(JwtAuthGuard, TenantGuard)
  async getSettings(
    @Param('eventId', ParseUUIDPipe) eventId: string,
  ) {
    return this.service.getPortalSettings(eventId)
  }

  // ─── Staff: Upsert Portal Settings ───────────────────────────────────────

  @Put(':eventId/settings')
  @UseGuards(JwtAuthGuard, TenantGuard)
  @HttpCode(HttpStatus.OK)
  async upsertSettings(
    @Request() req: any,
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() dto: PortalSettingsDto,
  ) {
    return this.service.upsertPortalSettings(eventId, req.tenantId, dto)
  }

  // ─── Staff: Get Messages ──────────────────────────────────────────────────

  @Get(':eventId/messages')
  @UseGuards(JwtAuthGuard, TenantGuard)
  async getMessages(
    @Param('eventId', ParseUUIDPipe) eventId: string,
  ) {
    return this.service.getMessages(eventId)
  }

  // ─── Section: Itinerary ───────────────────────────────────────────────────

  @Get(':eventId/sections/itinerary')
  getItinerary(@Param('eventId', ParseUUIDPipe) eventId: string) {
    return this.service.getItinerary(eventId)
  }

  @Get(':eventId/sections/venue')
  getVenue(@Param('eventId', ParseUUIDPipe) eventId: string) {
    return this.service.getVenueInfo(eventId)
  }

  @Get(':eventId/sections/gifts')
  getGifts(@Param('eventId', ParseUUIDPipe) eventId: string) {
    return this.service.getGiftsInfo(eventId)
  }

  @Get(':eventId/sections/gallery')
  getGallery(@Param('eventId', ParseUUIDPipe) eventId: string) {
    return this.service.getGallery(eventId)
  }

  @Get(':eventId/sections/food-menu')
  getFoodMenu(@Param('eventId', ParseUUIDPipe) eventId: string) {
    return this.service.getFoodMenu(eventId)
  }

  @Get(':eventId/sections/faqs')
  getFaqs(@Param('eventId', ParseUUIDPipe) eventId: string) {
    return this.service.getFaqs(eventId)
  }

  @Get(':eventId/sections/announcements')
  getAnnouncements(@Param('eventId', ParseUUIDPipe) eventId: string) {
    return this.service.getAnnouncements(eventId)
  }

  @Get(':eventId/sections/contacts')
  getContacts(@Param('eventId', ParseUUIDPipe) eventId: string) {
    return this.service.getContacts(eventId)
  }

  @Get(':eventId/sections/accommodation')
  getAccommodation(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Headers('x-guest-session') sessionToken: string,
  ) {
    const guestId = this.extractGuestId(sessionToken)
    return this.service.getAccommodationInfo(eventId, guestId)
  }

  @Get(':eventId/sections/transport')
  getTransport(@Param('eventId', ParseUUIDPipe) eventId: string) {
    return this.service.getTransportInfo(eventId)
  }

  @Get(':eventId/sections/survey')
  getSurvey(@Param('eventId', ParseUUIDPipe) eventId: string) {
    return this.service.getSurveyForGuest(eventId)
  }

  @Post(':eventId/sections/survey/submit')
  @HttpCode(HttpStatus.CREATED)
  submitSurvey(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Headers('x-guest-session') sessionToken: string,
    @Body() body: { surveyId: string; answers: Record<string, any> },
  ) {
    const guestId = this.requireGuestId(sessionToken)
    return this.service.submitSurveyResponse(guestId, eventId, body.surveyId, body.answers)
  }

  @Post(':eventId/sections/rsvp')
  @HttpCode(HttpStatus.OK)
  submitRsvp(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Headers('x-guest-session') sessionToken: string,
    @Body() body: { rsvp_status: string; guest_count?: number; dietary_notes?: string; message?: string },
  ) {
    const guestId = this.requireGuestId(sessionToken)
    return this.service.submitRsvp(guestId, eventId, body)
  }

  @Patch(':eventId/me')
  updateProfile(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Headers('x-guest-session') sessionToken: string,
    @Body() dto: { full_name?: string; meal_preference?: string; dietary_requirements?: string; special_requests?: string },
  ) {
    const guestId = this.requireGuestId(sessionToken)
    return this.service.updateGuestProfile(guestId, dto)
  }

  // ─── Staff: FAQ management ────────────────────────────────────────────────

  @Post(':eventId/faqs')
  @UseGuards(JwtAuthGuard, TenantGuard)
  createFaq(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Request() req: any,
    @Body() body: { question: string; answer: string; sort_order?: number },
  ) {
    return this.service['supabase']
      ? this.service['upsertFaq'](eventId, req.tenantId, body)
      : null
  }

  // ─── Staff: Announcement management ──────────────────────────────────────

  @Post(':eventId/announcements')
  @UseGuards(JwtAuthGuard, TenantGuard)
  createAnnouncement(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Request() req: any,
    @Body() body: { title: string; body: string; is_pinned?: boolean; emoji?: string },
  ) {
    return this.service['createAnnouncement']?.(eventId, req.tenantId, req.userId, body)
  }

  // ─── Helper ───────────────────────────────────────────────────────────────

  private extractGuestToken(cookieHeader: string): string {
    if (!cookieHeader) throw new UnauthorizedException('Guest session not found. Please log in.')
    const match = cookieHeader.match(/gp_token=([^;]+)/)
    if (!match) throw new UnauthorizedException('Guest session not found. Please log in.')
    return match[1]
  }

  private extractGuestId(sessionToken: string): string | null {
    if (!sessionToken) return null
    try {
      // JWT payload has sub = guestId
      const payload = JSON.parse(Buffer.from(sessionToken.split('.')[1], 'base64').toString())
      return payload.guest_id ?? null
    } catch { return null }
  }

  private requireGuestId(sessionToken: string): string {
    const id = this.extractGuestId(sessionToken)
    if (!id) throw new UnauthorizedException('Guest session required')
    return id
  }
}
