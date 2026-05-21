import { Controller, Post, Get, Patch, Param, Body, Query, ParseUUIDPipe, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { AiService, AiFeature } from './ai.service'
import { AiWorkflowsService } from './ai-workflows.service'
import { AuthGuard } from '../../common/guards/auth.guard'
import { AiApiEnabledGuard } from '../../common/guards/ai-api-enabled.guard'
import { TenantId, CurrentUserId, AccessToken } from '../../common/decorators/tenant.decorator'

@ApiTags('AI')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard, AiApiEnabledGuard)
@Controller({ path: 'ai', version: '1' })
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly aiWorkflows: AiWorkflowsService,
  ) {}

  // ─── Multi-turn Chat ──────────────────────────────────────────────────────

  @Post('chat')
  @ApiOperation({ summary: 'Multi-turn AI chat with conversation history' })
  chat(
    @Body() dto: {
      message: string
      history?: Array<{ role: 'user' | 'assistant'; content: string }>
      model?: string
    },
    @TenantId() t: string,
    @CurrentUserId() u: string,
  ) {
    return this.aiService.chat({
      message: dto.message,
      history: dto.history ?? [],
      tenantId: t,
      userId: u,
      model: dto.model,
    })
  }

  // ─── Free-form generation ─────────────────────────────────────────────────

  @Post('generate')
  @ApiOperation({ summary: 'Free-form AI generation with feature context' })
  generate(
    @Body() dto: { feature: AiFeature; prompt: string; context?: any; event_id?: string; model?: string },
    @TenantId() t: string,
    @CurrentUserId() u: string,
  ) {
    return this.aiService.generate({
      feature: dto.feature,
      prompt: dto.prompt,
      context: dto.context,
      eventId: dto.event_id,
      tenantId: t,
      userId: u,
      model: dto.model,
    })
  }

  @Get('insights')
  @ApiOperation({ summary: 'Generate AI business insights for analytics dashboard' })
  getInsights(
    @TenantId() tenantId: string,
    @Query('period') period = 'this_month',
  ) {
    return this.aiService.generateInsights(tenantId, period)
  }

  @Get('history')
  @ApiOperation({ summary: 'Fetch AI generation history' })
  getHistory(
    @TenantId() t: string,
    @AccessToken() token: string,
    @Query('event_id') eventId?: string,
    @Query('feature') feature?: string,
  ) {
    return this.aiService.getHistory(t, token, { eventId, feature })
  }

  // ─── Legacy convenience endpoints (delegated to AiService directly) ───────

  @Post('events/:eventId/proposal')
  @ApiOperation({ summary: '[Legacy] Generate event proposal' })
  generateProposalLegacy(
    @Param('eventId') eventId: string,
    @TenantId() t: string,
    @CurrentUserId() u: string,
    @AccessToken() token: string,
  ) {
    return this.aiService.generateProposal(eventId, t, u, token)
  }

  @Post('events/:eventId/runsheet')
  @ApiOperation({ summary: '[Legacy] Generate event runsheet' })
  generateRunsheetLegacy(
    @Param('eventId') eventId: string,
    @TenantId() t: string,
    @CurrentUserId() u: string,
    @AccessToken() token: string,
  ) {
    return this.aiService.generateRunsheet(eventId, t, u, token)
  }

  @Post('events/:eventId/risks')
  @ApiOperation({ summary: '[Legacy] Predict event risks' })
  predictRisksLegacy(
    @Param('eventId') eventId: string,
    @TenantId() t: string,
    @CurrentUserId() u: string,
    @AccessToken() token: string,
  ) {
    return this.aiService.predictRisks(eventId, t, u, token)
  }

  // ─── Vendor Recommendation Engine ────────────────────────────────────────────

  @Post('vendor-recommendations')
  @ApiOperation({ summary: 'Generate AI-ranked vendor shortlist for an event requirement' })
  recommendVendors(
    @Body() dto: {
      event_id?: string
      service_category: string
      event_type?: string
      budget_min?: number
      budget_max?: number
      event_date?: string
      location?: string
      guest_count?: number
      requirements?: string
    },
    @TenantId() tenantId: string,
    @CurrentUserId() userId: string,
    @AccessToken() token: string,
  ) {
    return this.aiService.recommendVendors({
      tenantId,
      userId,
      token,
      eventId: dto.event_id,
      serviceCategory: dto.service_category,
      eventType: dto.event_type,
      budgetMin: dto.budget_min,
      budgetMax: dto.budget_max,
      eventDate: dto.event_date,
      location: dto.location,
      guestCount: dto.guest_count,
      requirements: dto.requirements,
    })
  }

  @Get('vendor-recommendations/history')
  @ApiOperation({ summary: 'List past vendor recommendation sessions for this tenant' })
  getRecommendationHistory(
    @TenantId() tenantId: string,
    @AccessToken() token: string,
    @Query('event_id') eventId?: string,
  ) {
    return this.aiService.getRecommendationHistory(tenantId, token, eventId)
  }

  @Get('vendor-recommendations/:sessionId')
  @ApiOperation({ summary: 'Fetch a vendor recommendation session with full ranked list' })
  getRecommendationSession(
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.aiService.getRecommendationSession(sessionId, tenantId, token)
  }

  @Patch('vendor-recommendations/:recommendationId/action')
  @ApiOperation({ summary: 'Record user action on a recommendation (shortlist / dismiss / assign)' })
  actionRecommendation(
    @Param('recommendationId', ParseUUIDPipe) recommendationId: string,
    @Body() dto: { action: 'shortlisted' | 'dismissed' | 'assigned' },
    @TenantId() tenantId: string,
    @CurrentUserId() userId: string,
    @AccessToken() token: string,
  ) {
    return this.aiService.updateRecommendationAction(recommendationId, dto.action, tenantId, userId, token)
  }

  // ─── Rich Workflow Endpoints (AiWorkflowsService) ─────────────────────────

  @Post('workflows/proposal/:leadId')
  @ApiOperation({ summary: 'Generate full proposal from lead CRM data' })
  generateProposalFromLead(
    @Param('leadId', ParseUUIDPipe) leadId: string,
    @TenantId() t: string,
    @CurrentUserId() u: string,
    @AccessToken() token: string,
  ) {
    return this.aiWorkflows.generateProposalFromLead(leadId, t, u, token)
  }

  @Post('workflows/budget/:eventId')
  @ApiOperation({ summary: 'AI budget optimization with actuals comparison' })
  optimizeBudget(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @TenantId() t: string,
    @CurrentUserId() u: string,
    @AccessToken() token: string,
  ) {
    return this.aiWorkflows.optimizeBudget(eventId, t, u, token)
  }

  @Post('workflows/risks/:eventId')
  @ApiOperation({ summary: 'AI risk prediction with full event context' })
  predictRisks(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @TenantId() t: string,
    @CurrentUserId() u: string,
    @AccessToken() token: string,
  ) {
    return this.aiWorkflows.predictEventRisks(eventId, t, u, token)
  }

  @Post('workflows/runsheet/:eventId')
  @ApiOperation({ summary: 'AI smart runsheet generation' })
  generateRunsheet(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @TenantId() t: string,
    @CurrentUserId() u: string,
    @AccessToken() token: string,
  ) {
    return this.aiWorkflows.generateSmartRunsheet(eventId, t, u, token)
  }

  @Post('workflows/guest-insights/:eventId')
  @ApiOperation({ summary: 'AI guest intelligence and experience recommendations' })
  generateGuestInsights(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @TenantId() t: string,
    @CurrentUserId() u: string,
    @AccessToken() token: string,
  ) {
    return this.aiWorkflows.generateGuestInsights(eventId, t, u, token)
  }
}
