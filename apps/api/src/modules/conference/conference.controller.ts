import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, Req, Res, HttpCode, HttpStatus,
} from '@nestjs/common'
import type { Response } from 'express'
import { ConferenceService } from './conference.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { TenantGuard } from '../../common/guards/tenant.guard'
import {
  UpdateConferenceSettingsDto, CreateTicketDto, UpdateTicketDto,
  CreateRegistrationDto, UpdateRegistrationDto, CheckInDto,
  CreateSpeakerDto, UpdateSpeakerDto,
  CreateSessionDto, UpdateSessionDto, AddSessionSpeakerDto,
  CreateSponsorDto, UpdateSponsorDto,
  CreateExhibitorDto, UpdateExhibitorDto,
  CreateQuestionDto, UpdateQuestionDto,
  CreatePollDto, UpdatePollDto, VotePollDto,
  IssueCEUDto, CreateConnectionDto, UpdateConnectionDto,
} from './dto/conference.dto'

@Controller(':tenant/events/:eventId/conference')
@UseGuards(JwtAuthGuard, TenantGuard)
export class ConferenceController {
  constructor(private readonly svc: ConferenceService) {}

  private tenantId(req: any) { return req.tenant?.id }
  private userId(req: any) { return req.user?.id }

  // ─── Settings ─────────────────────────────────────────────────────────────

  @Get('settings')
  getSettings(@Param('eventId') eventId: string, @Req() req: any) {
    return this.svc.getOrCreateSettings(eventId, this.tenantId(req))
  }

  @Patch('settings')
  updateSettings(
    @Param('eventId') eventId: string,
    @Req() req: any,
    @Body() dto: UpdateConferenceSettingsDto,
  ) {
    return this.svc.updateSettings(eventId, this.tenantId(req), dto)
  }

  // ─── Dashboard ────────────────────────────────────────────────────────────

  @Get('dashboard')
  getDashboard(@Param('eventId') eventId: string, @Req() req: any) {
    return this.svc.getDashboard(eventId, this.tenantId(req))
  }

  // ─── Tickets ──────────────────────────────────────────────────────────────

  @Get('tickets')
  getTickets(@Param('eventId') eventId: string) {
    return this.svc.getTickets(eventId)
  }

  @Post('tickets')
  createTicket(
    @Param('eventId') eventId: string,
    @Req() req: any,
    @Body() dto: CreateTicketDto,
  ) {
    return this.svc.createTicket(eventId, this.tenantId(req), dto)
  }

  @Patch('tickets/:ticketId')
  updateTicket(
    @Param('eventId') eventId: string,
    @Param('ticketId') ticketId: string,
    @Body() dto: UpdateTicketDto,
  ) {
    return this.svc.updateTicket(eventId, ticketId, dto)
  }

  @Delete('tickets/:ticketId')
  deleteTicket(@Param('eventId') eventId: string, @Param('ticketId') ticketId: string) {
    return this.svc.deleteTicket(eventId, ticketId)
  }

  // ─── Registrations ────────────────────────────────────────────────────────

  @Get('registrations')
  getRegistrations(
    @Param('eventId') eventId: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('ticketId') ticketId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.getRegistrations(eventId, {
      status, search, ticketId,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 50,
    })
  }

  @Post('registrations')
  createRegistration(
    @Param('eventId') eventId: string,
    @Req() req: any,
    @Body() dto: CreateRegistrationDto,
  ) {
    return this.svc.createRegistration(eventId, this.tenantId(req), dto)
  }

  @Post('registrations/bulk-import')
  bulkImport(@Param('eventId') eventId: string, @Req() req: any, @Body() body: { rows: any[] }) {
    return this.svc.bulkImportRegistrations(eventId, this.tenantId(req), body.rows)
  }

  @Patch('registrations/:registrationId')
  updateRegistration(
    @Param('eventId') eventId: string,
    @Param('registrationId') registrationId: string,
    @Body() dto: UpdateRegistrationDto,
  ) {
    return this.svc.updateRegistration(eventId, registrationId, dto)
  }

  @Post('registrations/check-in')
  @HttpCode(HttpStatus.OK)
  checkIn(@Param('eventId') eventId: string, @Body() dto: CheckInDto) {
    return this.svc.checkIn(eventId, dto)
  }

  @Get('registrations/export')
  async exportRegistrations(
    @Param('eventId') eventId: string,
    @Res() res: Response,
  ) {
    const { csv, count } = await this.svc.exportRegistrations(eventId)
    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename="registrations-${eventId}.csv"`)
    res.setHeader('X-Total-Count', String(count))
    res.send(csv)
  }

  // ─── Speakers ─────────────────────────────────────────────────────────────

  @Get('speakers')
  getSpeakers(
    @Param('eventId') eventId: string,
    @Query('status') status?: string,
    @Query('keynote') keynote?: string,
  ) {
    return this.svc.getSpeakers(eventId, { status, isKeynote: keynote === 'true' })
  }

  @Post('speakers')
  createSpeaker(
    @Param('eventId') eventId: string,
    @Req() req: any,
    @Body() dto: CreateSpeakerDto,
  ) {
    return this.svc.createSpeaker(eventId, this.tenantId(req), dto)
  }

  @Patch('speakers/:speakerId')
  updateSpeaker(
    @Param('eventId') eventId: string,
    @Param('speakerId') speakerId: string,
    @Body() dto: UpdateSpeakerDto,
  ) {
    return this.svc.updateSpeaker(eventId, speakerId, dto)
  }

  @Delete('speakers/:speakerId')
  deleteSpeaker(@Param('eventId') eventId: string, @Param('speakerId') speakerId: string) {
    return this.svc.deleteSpeaker(eventId, speakerId)
  }

  // ─── Sessions ─────────────────────────────────────────────────────────────

  @Get('sessions')
  getSessions(
    @Param('eventId') eventId: string,
    @Query('track') track?: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('day') day?: string,
  ) {
    return this.svc.getSessions(eventId, {
      track, status, type,
      dayNumber: day ? parseInt(day) : undefined,
    })
  }

  @Post('sessions')
  createSession(
    @Param('eventId') eventId: string,
    @Req() req: any,
    @Body() dto: CreateSessionDto,
  ) {
    return this.svc.createSession(eventId, this.tenantId(req), dto)
  }

  @Get('sessions/:sessionId')
  getSession(@Param('sessionId') sessionId: string) {
    return this.svc.getSessionById(sessionId)
  }

  @Patch('sessions/:sessionId')
  updateSession(
    @Param('eventId') eventId: string,
    @Param('sessionId') sessionId: string,
    @Body() dto: UpdateSessionDto,
  ) {
    return this.svc.updateSession(eventId, sessionId, dto)
  }

  @Patch('sessions/:sessionId/status')
  updateSessionStatus(
    @Param('eventId') eventId: string,
    @Param('sessionId') sessionId: string,
    @Body('status') status: string,
  ) {
    return this.svc.updateSessionStatus(eventId, sessionId, status)
  }

  @Delete('sessions/:sessionId')
  deleteSession(@Param('eventId') eventId: string, @Param('sessionId') sessionId: string) {
    return this.svc.deleteSession(eventId, sessionId)
  }

  @Post('sessions/:sessionId/speakers')
  addSessionSpeaker(@Param('sessionId') sessionId: string, @Body() dto: AddSessionSpeakerDto) {
    return this.svc.addSessionSpeaker(sessionId, dto)
  }

  @Delete('sessions/:sessionId/speakers/:speakerId')
  removeSessionSpeaker(
    @Param('sessionId') sessionId: string,
    @Param('speakerId') speakerId: string,
  ) {
    return this.svc.removeSessionSpeaker(sessionId, speakerId)
  }

  // ─── Sponsors ─────────────────────────────────────────────────────────────

  @Get('sponsors')
  getSponsors(@Param('eventId') eventId: string) {
    return this.svc.getSponsors(eventId)
  }

  @Post('sponsors')
  createSponsor(
    @Param('eventId') eventId: string,
    @Req() req: any,
    @Body() dto: CreateSponsorDto,
  ) {
    return this.svc.createSponsor(eventId, this.tenantId(req), dto)
  }

  @Patch('sponsors/:sponsorId')
  updateSponsor(
    @Param('eventId') eventId: string,
    @Param('sponsorId') sponsorId: string,
    @Body() dto: UpdateSponsorDto,
  ) {
    return this.svc.updateSponsor(eventId, sponsorId, dto)
  }

  @Delete('sponsors/:sponsorId')
  deleteSponsor(@Param('eventId') eventId: string, @Param('sponsorId') sponsorId: string) {
    return this.svc.deleteSponsor(eventId, sponsorId)
  }

  // ─── Exhibitors ───────────────────────────────────────────────────────────

  @Get('exhibitors')
  getExhibitors(
    @Param('eventId') eventId: string,
    @Query('status') status?: string,
    @Query('hall') hall?: string,
  ) {
    return this.svc.getExhibitors(eventId, { status, hall })
  }

  @Post('exhibitors')
  createExhibitor(
    @Param('eventId') eventId: string,
    @Req() req: any,
    @Body() dto: CreateExhibitorDto,
  ) {
    return this.svc.createExhibitor(eventId, this.tenantId(req), dto)
  }

  @Patch('exhibitors/:exhibitorId')
  updateExhibitor(
    @Param('eventId') eventId: string,
    @Param('exhibitorId') exhibitorId: string,
    @Body() dto: UpdateExhibitorDto,
  ) {
    return this.svc.updateExhibitor(eventId, exhibitorId, dto)
  }

  @Delete('exhibitors/:exhibitorId')
  deleteExhibitor(@Param('eventId') eventId: string, @Param('exhibitorId') exhibitorId: string) {
    return this.svc.deleteExhibitor(eventId, exhibitorId)
  }

  // ─── Q&A ──────────────────────────────────────────────────────────────────

  @Get('sessions/:sessionId/questions')
  getQuestions(
    @Param('sessionId') sessionId: string,
    @Query('status') status?: string,
  ) {
    return this.svc.getQuestions(sessionId, status)
  }

  @Post('questions')
  createQuestion(
    @Param('eventId') eventId: string,
    @Req() req: any,
    @Body() dto: CreateQuestionDto,
  ) {
    return this.svc.createQuestion(eventId, this.tenantId(req), dto)
  }

  @Patch('questions/:questionId')
  updateQuestion(@Param('questionId') questionId: string, @Body() dto: UpdateQuestionDto) {
    return this.svc.updateQuestion(questionId, dto)
  }

  @Post('questions/:questionId/upvote')
  @HttpCode(HttpStatus.OK)
  upvoteQuestion(
    @Param('questionId') questionId: string,
    @Body('registration_id') registrationId: string,
  ) {
    return this.svc.upvoteQuestion(questionId, registrationId)
  }

  // ─── Polls ────────────────────────────────────────────────────────────────

  @Get('polls')
  getPolls(@Param('eventId') eventId: string, @Query('sessionId') sessionId?: string) {
    return this.svc.getPolls(eventId, sessionId)
  }

  @Post('polls')
  createPoll(
    @Param('eventId') eventId: string,
    @Req() req: any,
    @Body() dto: CreatePollDto,
  ) {
    return this.svc.createPoll(eventId, this.tenantId(req), this.userId(req), dto)
  }

  @Patch('polls/:pollId')
  updatePoll(@Param('pollId') pollId: string, @Body() dto: UpdatePollDto) {
    return this.svc.updatePoll(pollId, dto)
  }

  @Post('polls/:pollId/vote')
  @HttpCode(HttpStatus.OK)
  votePoll(@Param('pollId') pollId: string, @Body() dto: VotePollDto) {
    return this.svc.votePoll(pollId, dto)
  }

  // ─── CEU Credits ──────────────────────────────────────────────────────────

  @Get('ceu')
  getCEU(
    @Param('eventId') eventId: string,
    @Query('registrationId') registrationId?: string,
  ) {
    return this.svc.getCEUCredits(eventId, registrationId)
  }

  @Post('ceu/issue')
  issueCEU(@Param('eventId') eventId: string, @Req() req: any, @Body() dto: IssueCEUDto) {
    return this.svc.issueCEUCredit(eventId, this.tenantId(req), this.userId(req), dto)
  }

  @Post('sessions/:sessionId/ceu/bulk-issue')
  bulkIssueCEU(
    @Param('eventId') eventId: string,
    @Param('sessionId') sessionId: string,
    @Req() req: any,
  ) {
    return this.svc.bulkIssueCEU(eventId, sessionId, this.tenantId(req), this.userId(req))
  }

  // ─── Networking ───────────────────────────────────────────────────────────

  @Get('networking/:registrationId')
  getConnections(
    @Param('eventId') eventId: string,
    @Param('registrationId') registrationId: string,
  ) {
    return this.svc.getConnections(eventId, registrationId)
  }

  @Post('networking/:requesterId/connect')
  createConnection(
    @Param('eventId') eventId: string,
    @Param('requesterId') requesterId: string,
    @Body() dto: CreateConnectionDto,
  ) {
    return this.svc.createConnection(eventId, requesterId, dto)
  }

  @Patch('networking/connections/:connectionId')
  updateConnection(
    @Param('connectionId') connectionId: string,
    @Body() dto: UpdateConnectionDto,
    @Query('registrationId') registrationId: string,
  ) {
    return this.svc.updateConnection(connectionId, registrationId, dto)
  }
}
