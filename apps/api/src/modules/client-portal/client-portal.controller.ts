import {
  Controller, Get, Post, Patch, Delete, Param, Body, Query,
  UseGuards, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { ClientPortalService } from './client-portal.service'
import { AuthGuard } from '../../common/guards/auth.guard'
import { TenantId, AccessToken, CurrentUserId } from '../../common/decorators/tenant.decorator'

// ── Public controller (no auth — accessed via portal token) ──────────────────
@ApiTags('Client Portal — Public')
@Controller({ path: 'portal', version: '1' })
export class ClientPortalPublicController {
  constructor(private readonly service: ClientPortalService) {}

  @Get(':accessToken')
  @ApiOperation({ summary: 'Load portal by access token (client-facing, no JWT)' })
  getPortalByToken(@Param('accessToken') accessToken: string) {
    return this.service.getPortalByToken(accessToken)
  }
}

// ── Internal (team) controller — JWT required ─────────────────────────────────
@ApiTags('Client Portal — Internal')
@Controller({ path: 'client-portal', version: '1' })
@UseGuards(AuthGuard)
@ApiBearerAuth('access-token')
export class ClientPortalController {
  constructor(private readonly service: ClientPortalService) {}

  // ── Config ──────────────────────────────────────────────────────────────────

  @Get('events/:eventId/config')
  @ApiOperation({ summary: 'Get portal config for event' })
  getConfig(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.getPortalConfig(eventId, tenantId, token)
  }

  @Post('events/:eventId/config')
  @ApiOperation({ summary: 'Create or update portal branding/config' })
  upsertConfig(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() dto: any,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.upsertPortalConfig(eventId, dto, tenantId, token)
  }

  @Post('events/:eventId/config/regenerate-token')
  @ApiOperation({ summary: 'Regenerate portal access token' })
  @HttpCode(HttpStatus.OK)
  regenerateToken(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.regenerateAccessToken(eventId, tenantId, token)
  }

  // ── Dashboard ───────────────────────────────────────────────────────────────

  @Get('events/:eventId/dashboard')
  @ApiOperation({ summary: 'Full portal dashboard for internal view' })
  getDashboard(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.getInternalPortalDashboard(eventId, tenantId, token)
  }

  // ── Updates ─────────────────────────────────────────────────────────────────

  @Get('events/:eventId/updates')
  getUpdates(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.getUpdates(eventId, tenantId, token)
  }

  @Post('events/:eventId/updates')
  createUpdate(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() dto: any,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
    @CurrentUserId() userId: string,
  ) {
    return this.service.createUpdate(eventId, dto, tenantId, token, userId)
  }

  @Patch('updates/:id')
  updateUpdate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: any,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.updateUpdate(id, dto, tenantId, token)
  }

  @Delete('updates/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteUpdate(
    @Param('id', ParseUUIDPipe) id: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.deleteUpdate(id, tenantId, token)
  }

  // ── Timeline ────────────────────────────────────────────────────────────────

  @Get('events/:eventId/timeline')
  getTimeline(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.getTimeline(eventId, tenantId, token)
  }

  @Post('events/:eventId/timeline')
  upsertTimeline(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() dto: any,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
    @CurrentUserId() userId: string,
  ) {
    return this.service.upsertTimelineItem(eventId, dto, tenantId, token, userId)
  }

  @Patch('timeline/:id/complete')
  completeTimeline(
    @Param('id', ParseUUIDPipe) id: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.completeTimelineItem(id, tenantId, token)
  }

  @Delete('timeline/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteTimeline(
    @Param('id', ParseUUIDPipe) id: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.deleteTimelineItem(id, tenantId, token)
  }

  // ── Documents ───────────────────────────────────────────────────────────────

  @Get('events/:eventId/documents')
  getDocuments(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.getDocuments(eventId, tenantId, token)
  }

  @Post('events/:eventId/documents')
  uploadDocument(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() dto: any,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
    @CurrentUserId() userId: string,
  ) {
    return this.service.uploadDocument(eventId, dto, tenantId, token, userId)
  }

  @Patch('documents/:id/approve')
  approveDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { approved_by_name: string; notes?: string },
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.approveDocument(id, dto, tenantId, token)
  }

  @Patch('documents/:id/reject')
  rejectDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { reason: string },
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.rejectDocument(id, dto, tenantId, token)
  }

  @Patch('documents/:id/request-revision')
  requestRevision(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { notes: string },
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.requestRevision(id, dto, tenantId, token)
  }

  // ── Mood Board ──────────────────────────────────────────────────────────────

  @Get('events/:eventId/moodboard')
  getMoodboard(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.getMoodboard(eventId, tenantId, token)
  }

  @Post('events/:eventId/moodboard')
  addMoodboardItem(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() dto: any,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
    @CurrentUserId() userId: string,
  ) {
    return this.service.addMoodboardItem(eventId, dto, tenantId, token, userId)
  }

  @Patch('moodboard/:id/react')
  reactMoodboard(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { liked: boolean; note?: string },
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.reactMoodboardItem(id, dto, tenantId, token)
  }

  @Delete('moodboard/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteMoodboardItem(
    @Param('id', ParseUUIDPipe) id: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.deleteMoodboardItem(id, tenantId, token)
  }

  // ── Budget Approvals ────────────────────────────────────────────────────────

  @Get('events/:eventId/budget')
  getBudget(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.getBudgetApprovals(eventId, tenantId, token)
  }

  @Post('events/:eventId/budget')
  upsertBudget(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() dto: any,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
    @CurrentUserId() userId: string,
  ) {
    return this.service.upsertBudgetItem(eventId, dto, tenantId, token, userId)
  }

  @Patch('budget/:id/approve')
  approveBudget(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { notes?: string },
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.clientApproveBudgetItem(id, dto, tenantId, token)
  }

  @Patch('budget/:id/reject')
  rejectBudget(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { notes?: string },
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.clientRejectBudgetItem(id, dto, tenantId, token)
  }

  // ── Messages ────────────────────────────────────────────────────────────────

  @Get('events/:eventId/messages')
  getMessages(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.getMessages(eventId, tenantId, token)
  }

  @Post('events/:eventId/messages')
  sendMessage(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() dto: any,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.sendMessage(eventId, dto, tenantId, token)
  }

  @Post('events/:eventId/messages/read')
  @HttpCode(HttpStatus.OK)
  markRead(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.markMessagesRead(eventId, tenantId, token)
  }
}
