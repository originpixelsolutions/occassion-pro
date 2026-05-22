import {
  Controller, Get, Post, Patch, Delete, Body, Param,
  UseGuards, Request, Res, HttpStatus, Query,
} from '@nestjs/common'
import type { Response } from 'express'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { TenantGuard } from '../../common/guards/tenant.guard'
import { PostEventService } from './post-event.service'
import {
  UpdateChecklistItemDto, MarkAttendedDto, UpdateSettlementDto,
  MarkPaidDto, SendThankYouDto, CreateSurveyDto, SubmitSurveyResponseDto,
  CreateTestimonialDto, GenerateReportDto,
} from './dto/post-event.dto'

@Controller(':tenant/events/:eventId/post-event')
@UseGuards(JwtAuthGuard, TenantGuard)
export class PostEventController {
  constructor(private readonly svc: PostEventService) {}

  // ─── Overall Status ────────────────────────────────────────────────────────

  @Get('status')
  getStatus(@Param('tenant') tenant: string, @Param('eventId') eventId: string) {
    return this.svc.getStatus(tenant, eventId)
  }

  // ─── Checklist ─────────────────────────────────────────────────────────────

  @Get('checklist')
  getChecklist(@Param('tenant') tenant: string, @Param('eventId') eventId: string) {
    return this.svc.getChecklist(tenant, eventId)
  }

  @Patch('checklist/:itemId')
  updateChecklistItem(
    @Param('tenant') tenant: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateChecklistItemDto,
    @Request() req: any,
  ) {
    return this.svc.updateChecklistItem(tenant, itemId, dto, req.user.id)
  }

  @Post('checklist/complete-all')
  completeAllChecklist(@Param('tenant') tenant: string, @Param('eventId') eventId: string, @Request() req: any) {
    return this.svc.completeAllChecklist(tenant, eventId, req.user.id)
  }

  @Post('checklist/reset')
  resetChecklist(@Param('tenant') tenant: string, @Param('eventId') eventId: string) {
    return this.svc.resetChecklist(tenant, eventId)
  }

  // ─── Headcount ─────────────────────────────────────────────────────────────

  @Get('headcount')
  getHeadcount(@Param('tenant') tenant: string, @Param('eventId') eventId: string) {
    return this.svc.getHeadcountRecon(tenant, eventId)
  }

  @Post('headcount/mark-attended')
  markAttended(
    @Param('tenant') tenant: string,
    @Param('eventId') eventId: string,
    @Body() dto: MarkAttendedDto,
  ) {
    return this.svc.markAttended(tenant, eventId, dto)
  }

  // ─── Budget ────────────────────────────────────────────────────────────────

  @Get('budget')
  getBudget(@Param('tenant') tenant: string, @Param('eventId') eventId: string) {
    return this.svc.getBudgetRecon(tenant, eventId)
  }

  @Post('budget/finalize')
  finalizeBudget(@Param('tenant') tenant: string, @Param('eventId') eventId: string) {
    return this.svc.finalizeBudget(tenant, eventId)
  }

  // ─── Vendor Settlements ────────────────────────────────────────────────────

  @Get('settlements')
  getSettlements(@Param('tenant') tenant: string, @Param('eventId') eventId: string) {
    return this.svc.getSettlements(tenant, eventId)
  }

  @Post('settlements/sync')
  syncSettlements(@Param('tenant') tenant: string, @Param('eventId') eventId: string) {
    return this.svc.syncSettlementsFromAssignments(tenant, eventId)
  }

  @Patch('settlements/:settlementId')
  updateSettlement(
    @Param('tenant') tenant: string,
    @Param('settlementId') settlementId: string,
    @Body() dto: UpdateSettlementDto,
  ) {
    return this.svc.updateSettlement(tenant, settlementId, dto)
  }

  @Post('settlements/:settlementId/mark-paid')
  markPaid(
    @Param('tenant') tenant: string,
    @Param('settlementId') settlementId: string,
    @Body() dto: MarkPaidDto,
  ) {
    return this.svc.markPaid(tenant, settlementId, dto)
  }

  // ─── Thank-You ─────────────────────────────────────────────────────────────

  @Post('thank-you/send')
  sendThankYou(
    @Param('tenant') tenant: string,
    @Param('eventId') eventId: string,
    @Body() dto: SendThankYouDto,
  ) {
    return this.svc.sendThankYouMessages(tenant, eventId, dto)
  }

  // ─── Surveys ───────────────────────────────────────────────────────────────

  @Get('surveys')
  getSurveys(@Param('tenant') tenant: string, @Param('eventId') eventId: string) {
    return this.svc.getSurveys(tenant, eventId)
  }

  @Post('surveys')
  createSurvey(
    @Param('tenant') tenant: string,
    @Param('eventId') eventId: string,
    @Body() dto: CreateSurveyDto,
  ) {
    return this.svc.createSurvey(tenant, eventId, dto)
  }

  @Get('surveys/:surveyId/results')
  getSurveyResults(@Param('tenant') tenant: string, @Param('surveyId') surveyId: string) {
    return this.svc.getSurveyResults(tenant, surveyId)
  }

  @Get('surveys/:surveyId/export')
  async exportSurvey(@Param('tenant') tenant: string, @Param('surveyId') surveyId: string, @Res() res: Response) {
    const csv = await this.svc.exportSurveyResults(tenant, surveyId)
    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename=survey-${surveyId}.csv`)
    res.status(HttpStatus.OK).send(csv)
  }

  @Post('surveys/:surveyId/respond')
  submitResponse(
    @Param('tenant') tenant: string,
    @Param('surveyId') surveyId: string,
    @Body() dto: SubmitSurveyResponseDto,
  ) {
    return this.svc.submitSurveyResponse(tenant, surveyId, dto)
  }

  // ─── Reports ───────────────────────────────────────────────────────────────

  @Get('reports')
  getReports(@Param('tenant') tenant: string, @Param('eventId') eventId: string) {
    return this.svc.getReports(tenant, eventId)
  }

  @Post('reports/generate')
  generateReport(
    @Param('tenant') tenant: string,
    @Param('eventId') eventId: string,
    @Body() dto: GenerateReportDto,
    @Request() req: any,
  ) {
    return this.svc.generateReport(tenant, eventId, dto, req.user.id)
  }

  @Post('reports/client')
  generateClientReport(
    @Param('tenant') tenant: string,
    @Param('eventId') eventId: string,
    @Request() req: any,
  ) {
    return this.svc.generateClientReport(tenant, eventId, req.user.id)
  }

  // ─── Testimonials ──────────────────────────────────────────────────────────

  @Get('testimonials')
  getTestimonials(@Param('tenant') tenant: string, @Param('eventId') eventId: string) {
    return this.svc.getTestimonials(tenant, eventId)
  }

  @Post('testimonials')
  createTestimonial(
    @Param('tenant') tenant: string,
    @Param('eventId') eventId: string,
    @Body() dto: CreateTestimonialDto,
  ) {
    return this.svc.createTestimonial(tenant, eventId, dto)
  }

  @Patch('testimonials/:id/approve')
  approveTestimonial(@Param('tenant') tenant: string, @Param('id') id: string) {
    return this.svc.approveTestimonial(tenant, id)
  }

  @Patch('testimonials/:id/feature')
  featureTestimonial(@Param('tenant') tenant: string, @Param('id') id: string, @Body('featured') featured: boolean) {
    return this.svc.featureTestimonial(tenant, id, featured ?? true)
  }

  @Delete('testimonials/:id')
  deleteTestimonial(@Param('tenant') tenant: string, @Param('id') id: string) {
    return this.svc.deleteTestimonial(tenant, id)
  }

  // ─── Archive ───────────────────────────────────────────────────────────────

  @Get('archive/status')
  getArchiveStatus(@Param('tenant') tenant: string, @Param('eventId') eventId: string) {
    return this.svc.getArchiveStatus(tenant, eventId)
  }

  @Post('archive')
  archiveEvent(@Param('tenant') tenant: string, @Param('eventId') eventId: string) {
    return this.svc.archiveEvent(tenant, eventId)
  }
}
