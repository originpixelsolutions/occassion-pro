import {
  Controller, Get, Post, Patch, Param, Body, Query,
  UseGuards, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { MarketingService } from './marketing.service'
import { AuthGuard } from '../../common/guards/auth.guard'
import { TenantId, AccessToken, CurrentUserId } from '../../common/decorators/tenant.decorator'

// Public controller — no auth (for form embed submissions)
@ApiTags('Marketing — Public')
@Controller({ path: 'marketing/public', version: '1' })
export class MarketingPublicController {
  constructor(private readonly service: MarketingService) {}

  @Post('forms/:slug/submit')
  @HttpCode(HttpStatus.OK)
  submitForm(
    @Param('slug') slug: string,
    @Body() dto: any,
  ) {
    return this.service.submitForm(slug, dto)
  }
}

// Internal controller — JWT required
@ApiTags('Marketing')
@Controller({ path: 'marketing', version: '1' })
@UseGuards(AuthGuard)
@ApiBearerAuth('access-token')
export class MarketingController {
  constructor(private readonly service: MarketingService) {}

  // ── Dashboard ──────────────────────────────────────────────────────────────

  @Get('dashboard')
  @ApiOperation({ summary: 'Marketing dashboard — funnel, campaigns, analytics' })
  getDashboard(
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.getDashboard(tenantId, token)
  }

  // ── Lead Sources ────────────────────────────────────────────────────────────

  @Get('sources')
  listSources(@TenantId() tenantId: string, @AccessToken() token: string) {
    return this.service.listSources(tenantId, token)
  }

  @Post('sources')
  upsertSource(
    @Body() dto: any,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.upsertSource(dto, tenantId, token)
  }

  // ── Leads ──────────────────────────────────────────────────────────────────

  @Get('leads')
  @ApiOperation({ summary: 'List leads with filters and scoring' })
  listLeads(
    @TenantId() tenantId: string,
    @AccessToken() token: string,
    @Query('stage') stage?: string,
    @Query('is_hot') isHot?: string,
    @Query('search') search?: string,
    @Query('source_id') sourceId?: string,
    @Query('event_type') eventType?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.service.listLeads(tenantId, token, {
      stage,
      is_hot: isHot === 'true' ? true : undefined,
      search,
      source_id: sourceId,
      event_type: eventType,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    })
  }

  @Post('leads')
  upsertLead(
    @Body() dto: any,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.upsertLead(dto, tenantId, token)
  }

  @Get('leads/:id')
  getLead(
    @Param('id', ParseUUIDPipe) id: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.getLead(id, tenantId, token)
  }

  @Patch('leads/:id/stage')
  updateStage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { stage: string; lost_reason?: string },
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.updateStage(id, dto.stage, dto.lost_reason, tenantId, token)
  }

  @Post('leads/:id/activities')
  addActivity(
    @Param('id', ParseUUIDPipe) leadId: string,
    @Body() dto: any,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
    @CurrentUserId() userId: string,
  ) {
    return this.service.addActivity(leadId, dto, tenantId, token, userId)
  }

  @Post('leads/bulk-assign')
  @HttpCode(HttpStatus.OK)
  bulkAssign(
    @Body() dto: { ids: string[]; assigned_to: string },
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.bulkAssign(dto.ids, dto.assigned_to, tenantId, token)
  }

  // ── Campaigns ──────────────────────────────────────────────────────────────

  @Get('campaigns')
  listCampaigns(
    @TenantId() tenantId: string,
    @AccessToken() token: string,
    @Query('status') status?: string,
  ) {
    return this.service.listCampaigns(tenantId, token, status)
  }

  @Post('campaigns')
  upsertCampaign(
    @Body() dto: any,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.upsertCampaign(dto, tenantId, token)
  }

  @Get('campaigns/:id')
  getCampaign(
    @Param('id', ParseUUIDPipe) id: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.getCampaign(id, tenantId, token)
  }

  @Patch('campaigns/:id/status')
  updateCampaignStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('status') status: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.updateCampaignStatus(id, status, tenantId, token)
  }

  @Post('campaigns/:id/messages')
  addCampaignMessage(
    @Param('id', ParseUUIDPipe) campaignId: string,
    @Body() dto: any,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.addCampaignMessage(campaignId, dto, tenantId, token)
  }

  @Post('campaigns/:id/recipients')
  @HttpCode(HttpStatus.OK)
  addRecipients(
    @Param('id', ParseUUIDPipe) campaignId: string,
    @Body('lead_ids') leadIds: string[],
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.addRecipientsFromLeads(campaignId, leadIds, tenantId, token)
  }

  // ── Lead Capture Forms ──────────────────────────────────────────────────────

  @Get('forms')
  listForms(@TenantId() tenantId: string, @AccessToken() token: string) {
    return this.service.listForms(tenantId, token)
  }

  @Post('forms')
  upsertForm(
    @Body() dto: any,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.upsertForm(dto, tenantId, token)
  }

  // ── Social Posts ────────────────────────────────────────────────────────────

  @Get('social-posts')
  listSocialPosts(
    @TenantId() tenantId: string,
    @AccessToken() token: string,
    @Query('status') status?: string,
  ) {
    return this.service.listSocialPosts(tenantId, token, status)
  }

  @Post('social-posts')
  upsertSocialPost(
    @Body() dto: any,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
    @CurrentUserId() userId: string,
  ) {
    return this.service.upsertSocialPost(dto, tenantId, token, userId)
  }
}
