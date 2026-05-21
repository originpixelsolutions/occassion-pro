import {
  Controller, Post, Get, Put, Patch, Delete, Body, Param,
  HttpCode, HttpStatus, BadRequestException, Query,
  UseGuards, Req,
} from '@nestjs/common'
import { VendorPortalAuthService } from './vendor-portal-auth.service'
import { VendorPortalService } from './vendor-portal.service'
import { VendorPortalAuthGuard } from './vendor-portal-auth.guard'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { TenantGuard } from '../auth/tenant.guard'

// ─── Controller ──────────────────────────────────────────────────────────────

@Controller('vendor-portal')
export class VendorPortalController {
  constructor(
    private readonly authSvc: VendorPortalAuthService,
    private readonly svc: VendorPortalService,
  ) {}

  // ── Public auth routes ────────────────────────────────────────────────────

  @Post('auth/register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() body: { email: string; name: string; business_name?: string; phone?: string; category?: string }) {
    if (!body.email || !body.name) throw new BadRequestException('email and name are required.')
    return this.authSvc.register(body)
  }

  @Post('auth/login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: { email: string; password: string }) {
    if (!body.email || !body.password) throw new BadRequestException('email and password are required.')
    return this.authSvc.login(body.email, body.password)
  }

  @Post('auth/forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() body: { email: string }) {
    return this.authSvc.requestPasswordReset(body.email)
  }

  @Post('auth/reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() body: { token: string; password: string }) {
    if (!body.token || !body.password) throw new BadRequestException('token and password are required.')
    if (body.password.length < 8) throw new BadRequestException('Password must be at least 8 characters.')
    return this.authSvc.resetPassword(body.token, body.password)
  }

  @Post('auth/logout')
  @UseGuards(VendorPortalAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: any) {
    return this.authSvc.logout(req.vendorSession.sessionToken)
  }

  // ── Profile ───────────────────────────────────────────────────────────────

  @Get('me')
  @UseGuards(VendorPortalAuthGuard)
  async getProfile(@Req() req: any) {
    return this.svc.getProfile(req.vendorSession.vendorId)
  }

  @Put('me')
  @UseGuards(VendorPortalAuthGuard)
  async updateProfile(
    @Req() req: any,
    @Body() body: { name?: string; business_name?: string; phone?: string; category?: string; website?: string; bio?: string; avatar_url?: string; gstin?: string },
  ) {
    return this.svc.updateProfile(req.vendorSession.vendorId, body)
  }

  @Put('me/bank')
  @UseGuards(VendorPortalAuthGuard)
  async updateBankDetails(
    @Req() req: any,
    @Body() body: { bank_account_name: string; bank_account_number: string; bank_ifsc: string },
  ) {
    return this.svc.updateBankDetails(req.vendorSession.vendorId, body)
  }

  // ── My Events ─────────────────────────────────────────────────────────────

  @Get('events')
  @UseGuards(VendorPortalAuthGuard)
  async getMyEvents(@Req() req: any, @Query('status') status?: string) {
    return this.svc.getMyEvents(req.vendorSession.vendorId, status)
  }

  @Get('events/:assignmentId')
  @UseGuards(VendorPortalAuthGuard)
  async getAssignmentDetail(@Req() req: any, @Param('assignmentId') assignmentId: string) {
    return this.svc.getAssignmentDetail(req.vendorSession.vendorId, assignmentId)
  }

  @Post('events/:assignmentId/respond')
  @UseGuards(VendorPortalAuthGuard)
  @HttpCode(HttpStatus.OK)
  async respondToInvitation(
    @Req() req: any,
    @Param('assignmentId') assignmentId: string,
    @Body() body: { response: 'confirmed' | 'declined'; note?: string },
  ) {
    return this.svc.respondToInvitation(req.vendorSession.vendorId, assignmentId, body)
  }

  // ── Messages ──────────────────────────────────────────────────────────────

  @Get('events/:assignmentId/messages')
  @UseGuards(VendorPortalAuthGuard)
  async getMessages(@Req() req: any, @Param('assignmentId') assignmentId: string) {
    return this.svc.getMessages(req.vendorSession.vendorId, assignmentId)
  }

  @Post('events/:assignmentId/messages')
  @UseGuards(VendorPortalAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async sendMessage(
    @Req() req: any,
    @Param('assignmentId') assignmentId: string,
    @Body() body: { content: string },
  ) {
    if (!body.content?.trim()) throw new BadRequestException('content is required.')
    return this.svc.sendMessage(req.vendorSession.vendorId, assignmentId, body.content)
  }

  @Get('messages')
  @UseGuards(VendorPortalAuthGuard)
  async getAggregatedMessages(@Req() req: any) {
    return this.svc.getAggregatedMessages(req.vendorSession.vendorId)
  }

  // ── Performance & payments ────────────────────────────────────────────────

  @Get('performance')
  @UseGuards(VendorPortalAuthGuard)
  async getPerformance(@Req() req: any) {
    return this.svc.getPerformanceScore(req.vendorSession.vendorId)
  }

  @Get('payments')
  @UseGuards(VendorPortalAuthGuard)
  async getPayments(@Req() req: any) {
    return this.svc.getPaymentHistory(req.vendorSession.vendorId)
  }

  // ── Staff routes (JWT-guarded) ────────────────────────────────────────────

  // ── Vendor Quotes ────────────────────────────────────────────────────────

  @Post('events/:assignmentId/quotes')
  @UseGuards(VendorPortalAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async submitQuote(
    @Req() req: any,
    @Param('assignmentId') assignmentId: string,
    @Body() body: {
      service_description: string
      amount: number
      currency_code?: string
      notes?: string
      file_url?: string
    },
  ) {
    if (!body.service_description?.trim()) throw new BadRequestException('service_description is required.')
    if (!body.amount || body.amount <= 0) throw new BadRequestException('amount must be greater than 0.')
    return this.svc.submitQuote(req.vendorSession.vendorId, assignmentId, body)
  }

  @Get('events/:assignmentId/quotes')
  @UseGuards(VendorPortalAuthGuard)
  async getQuotes(@Req() req: any, @Param('assignmentId') assignmentId: string) {
    return this.svc.getQuotes(req.vendorSession.vendorId, assignmentId)
  }

  // ── Staff: vendor search + assignment management ─────────────────────────

  @Get('staff/vendors/search')
  @UseGuards(JwtAuthGuard, TenantGuard)
  async searchVendors(@Query('q') q = '', @Query('category') category?: string) {
    return this.svc.searchVendors(q, category)
  }

  @Get('staff/events/:eventId/assignments')
  @UseGuards(JwtAuthGuard, TenantGuard)
  async getEventAssignments(@Req() req: any, @Param('eventId') eventId: string) {
    return this.svc.getEventAssignments(req.user.tenant_id, eventId)
  }

  @Post('staff/events/:eventId/assignments')
  @UseGuards(JwtAuthGuard, TenantGuard)
  @HttpCode(HttpStatus.CREATED)
  async assignVendor(
    @Req() req: any,
    @Param('eventId') eventId: string,
    @Body() body: {
      vendor_id?: string; vendor_email?: string; vendor_name?: string; vendor_category?: string;
      service_description?: string; agreed_amount?: number; currency_code?: string;
    },
  ) {
    return this.svc.assignVendor(req.user.tenant_id, eventId, req.user.sub, body)
  }

  @Patch('staff/assignments/:assignmentId')
  @UseGuards(JwtAuthGuard, TenantGuard)
  async updateAssignment(
    @Req() req: any,
    @Param('assignmentId') assignmentId: string,
    @Body() body: { status?: string; tenant_rating?: number; vendor_notes?: string; service_description?: string; agreed_amount?: number },
  ) {
    return this.svc.updateAssignment(req.user.tenant_id, assignmentId, body)
  }

  @Get('staff/assignments/:assignmentId/messages')
  @UseGuards(JwtAuthGuard, TenantGuard)
  async staffGetMessages(@Req() req: any, @Param('assignmentId') assignmentId: string) {
    return this.svc.staffGetMessages(req.user.tenant_id, assignmentId)
  }

  @Post('staff/assignments/:assignmentId/messages')
  @UseGuards(JwtAuthGuard, TenantGuard)
  @HttpCode(HttpStatus.CREATED)
  async staffSendMessage(
    @Req() req: any,
    @Param('assignmentId') assignmentId: string,
    @Body() body: { content: string },
  ) {
    if (!body.content?.trim()) throw new BadRequestException('content is required.')
    return this.svc.staffSendMessage(req.user.tenant_id, assignmentId, req.user.sub, body.content)
  }

  // ── Staff: Quote management ───────────────────────────────────────────────

  @Get('staff/assignments/:assignmentId/quotes')
  @UseGuards(JwtAuthGuard, TenantGuard)
  async staffGetAssignmentQuotes(@Req() req: any, @Param('assignmentId') assignmentId: string) {
    return this.svc.staffGetAssignmentQuotes(req.user.tenant_id, assignmentId)
  }

  @Patch('staff/quotes/:quoteId/review')
  @UseGuards(JwtAuthGuard, TenantGuard)
  async staffReviewQuote(
    @Req() req: any,
    @Param('quoteId') quoteId: string,
    @Body() body: { status: 'approved' | 'rejected' | 'under_review'; review_note?: string },
  ) {
    if (!body.status) throw new BadRequestException('status is required.')
    return this.svc.staffReviewQuote(req.user.tenant_id, quoteId, req.user.sub, body)
  }

  @Get('staff/events/:eventId/quotes')
  @UseGuards(JwtAuthGuard, TenantGuard)
  async staffGetAllEventQuotes(@Req() req: any, @Param('eventId') eventId: string) {
    return this.svc.staffGetAllEventQuotes(req.user.tenant_id, eventId)
  }
}
