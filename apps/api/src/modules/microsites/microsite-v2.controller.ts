import {
  Controller, Get, Post, Put, Delete, Patch, Body, Param,
  Query, Req, UseGuards, HttpCode, HttpStatus, BadRequestException,
} from '@nestjs/common'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { TenantGuard } from '../../common/guards/tenant.guard'
import {
  MicrositeV2Service,
  CreateSpeakerDto, CreateSessionDto, CreateSponsorDto,
  CreateFaqDto, UpdateSettingsDto, RegistrationDto,
} from './microsite-v2.service'

// ── Staff-facing routes (JWT protected) ─────────────────────────────────────

@Controller('events/:eventId/microsite')
@UseGuards(JwtAuthGuard, TenantGuard)
export class MicrositeV2Controller {
  constructor(private readonly svc: MicrositeV2Service) {}

  // ── Settings
  @Get('settings')
  getSettings(@Req() req: any, @Param('eventId') eventId: string) {
    return this.svc.getSettings(req.user.tenant_id, eventId)
  }

  @Put('settings')
  upsertSettings(@Req() req: any, @Param('eventId') eventId: string, @Body() dto: UpdateSettingsDto) {
    return this.svc.upsertSettings(req.user.tenant_id, eventId, dto)
  }

  // ── Speakers
  @Get('speakers')
  listSpeakers(@Req() req: any, @Param('eventId') eventId: string) {
    return this.svc.listSpeakers(req.user.tenant_id, eventId)
  }

  @Post('speakers')
  @HttpCode(HttpStatus.CREATED)
  createSpeaker(@Req() req: any, @Param('eventId') eventId: string, @Body() dto: CreateSpeakerDto) {
    if (!dto.name?.trim()) throw new BadRequestException('name is required')
    return this.svc.createSpeaker(req.user.tenant_id, eventId, dto)
  }

  @Put('speakers/:id')
  updateSpeaker(@Req() req: any, @Param('id') id: string, @Body() dto: Partial<CreateSpeakerDto>) {
    return this.svc.updateSpeaker(req.user.tenant_id, id, dto)
  }

  @Delete('speakers/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteSpeaker(@Req() req: any, @Param('id') id: string) {
    await this.svc.deleteSpeaker(req.user.tenant_id, id)
  }

  // ── Sessions
  @Get('sessions')
  listSessions(@Req() req: any, @Param('eventId') eventId: string) {
    return this.svc.listSessions(req.user.tenant_id, eventId)
  }

  @Post('sessions')
  @HttpCode(HttpStatus.CREATED)
  createSession(@Req() req: any, @Param('eventId') eventId: string, @Body() dto: CreateSessionDto) {
    if (!dto.title?.trim()) throw new BadRequestException('title is required')
    if (!dto.session_date || !dto.start_time || !dto.end_time) {
      throw new BadRequestException('session_date, start_time, end_time are required')
    }
    return this.svc.createSession(req.user.tenant_id, eventId, dto)
  }

  @Put('sessions/:id')
  updateSession(@Req() req: any, @Param('id') id: string, @Body() dto: Partial<CreateSessionDto>) {
    return this.svc.updateSession(req.user.tenant_id, id, dto)
  }

  @Delete('sessions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteSession(@Req() req: any, @Param('id') id: string) {
    await this.svc.deleteSession(req.user.tenant_id, id)
  }

  // ── Sponsors
  @Get('sponsors')
  listSponsors(@Req() req: any, @Param('eventId') eventId: string) {
    return this.svc.listSponsors(req.user.tenant_id, eventId)
  }

  @Post('sponsors')
  @HttpCode(HttpStatus.CREATED)
  createSponsor(@Req() req: any, @Param('eventId') eventId: string, @Body() dto: CreateSponsorDto) {
    if (!dto.name?.trim()) throw new BadRequestException('name is required')
    return this.svc.createSponsor(req.user.tenant_id, eventId, dto)
  }

  @Put('sponsors/:id')
  updateSponsor(@Req() req: any, @Param('id') id: string, @Body() dto: Partial<CreateSponsorDto>) {
    return this.svc.updateSponsor(req.user.tenant_id, id, dto)
  }

  @Delete('sponsors/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteSponsor(@Req() req: any, @Param('id') id: string) {
    await this.svc.deleteSponsor(req.user.tenant_id, id)
  }

  // ── FAQs
  @Get('faqs')
  listFaqs(@Req() req: any, @Param('eventId') eventId: string) {
    return this.svc.listFaqs(req.user.tenant_id, eventId)
  }

  @Post('faqs')
  @HttpCode(HttpStatus.CREATED)
  createFaq(@Req() req: any, @Param('eventId') eventId: string, @Body() dto: CreateFaqDto) {
    if (!dto.question?.trim() || !dto.answer?.trim()) {
      throw new BadRequestException('question and answer are required')
    }
    return this.svc.createFaq(req.user.tenant_id, eventId, dto)
  }

  @Put('faqs/:id')
  updateFaq(@Req() req: any, @Param('id') id: string, @Body() dto: Partial<CreateFaqDto>) {
    return this.svc.updateFaq(req.user.tenant_id, id, dto)
  }

  @Delete('faqs/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteFaq(@Req() req: any, @Param('id') id: string) {
    await this.svc.deleteFaq(req.user.tenant_id, id)
  }

  // ── Registrations (staff view)
  @Get('registrations')
  listRegistrations(@Req() req: any, @Param('eventId') eventId: string) {
    return this.svc.listRegistrations(req.user.tenant_id, eventId)
  }
}

// ── Public-facing routes (no auth) ───────────────────────────────────────────

@Controller('public/microsite')
export class MicrositePublicController {
  constructor(private readonly svc: MicrositeV2Service) {}

  /** Full microsite payload for a slug */
  @Get(':slug')
  getPublicMicrosite(@Param('slug') slug: string) {
    return this.svc.getPublicMicrosite(slug)
  }

  /** Public registration submit */
  @Post(':eventId/register')
  @HttpCode(HttpStatus.CREATED)
  register(
    @Param('eventId') eventId: string,
    @Body() dto: RegistrationDto & { tenant_id: string },
  ) {
    if (!dto.name?.trim() || !dto.email?.trim()) {
      throw new BadRequestException('name and email are required')
    }
    return this.svc.createRegistration(eventId, dto.tenant_id, dto)
  }

  /** Razorpay payment confirmation */
  @Post(':eventId/register/:registrationId/confirm-payment')
  @HttpCode(HttpStatus.OK)
  confirmPayment(
    @Param('registrationId') regId: string,
    @Body() body: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string },
  ) {
    return this.svc.confirmRegistrationPayment(regId, body.razorpay_order_id, body.razorpay_payment_id, body.razorpay_signature)
  }
}
