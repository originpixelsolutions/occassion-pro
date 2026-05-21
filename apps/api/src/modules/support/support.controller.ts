import {
  Controller, Get, Post, Patch, Delete, Param, Body, Query,
  UseGuards, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { SupportService } from './support.service'
import { AuthGuard } from '../../common/guards/auth.guard'
import { TenantId, AccessToken, CurrentUserId } from '../../common/decorators/tenant.decorator'

@ApiTags('Support')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard)
@Controller({ path: 'support', version: '1' })
export class SupportController {
  constructor(private readonly service: SupportService) {}

  // ── Dashboard ──────────────────────────────────────────────────────────────

  @Get('dashboard')
  @ApiOperation({ summary: 'Support dashboard — ticket counts, SLA breaches, agent load' })
  getDashboard(
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.getDashboard(tenantId, token)
  }

  // ── Tickets ────────────────────────────────────────────────────────────────

  @Get('tickets')
  @ApiOperation({ summary: 'List tickets with filters' })
  listTickets(
    @TenantId() tenantId: string,
    @AccessToken() token: string,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('category_id') categoryId?: string,
    @Query('assigned_to') assignedTo?: string,
    @Query('event_id') eventId?: string,
    @Query('sla_breached') slaBreached?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.service.listTickets(tenantId, token, {
      status,
      priority,
      category_id: categoryId,
      assigned_to: assignedTo,
      event_id: eventId,
      sla_breached: slaBreached === 'true' ? true : undefined,
      search,
      limit: limit ? parseInt(limit) : 50,
      offset: offset ? parseInt(offset) : 0,
    })
  }

  @Post('tickets')
  @ApiOperation({ summary: 'Create a new support ticket' })
  createTicket(
    @Body() dto: any,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
    @CurrentUserId() userId: string,
  ) {
    return this.service.createTicket(dto, tenantId, token, userId)
  }

  @Get('tickets/:id')
  @ApiOperation({ summary: 'Get ticket with comments, activities, KB links' })
  getTicket(
    @Param('id', ParseUUIDPipe) id: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.getTicket(id, tenantId, token)
  }

  @Patch('tickets/:id')
  @ApiOperation({ summary: 'Update ticket fields' })
  updateTicket(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: any,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
    @CurrentUserId() userId: string,
  ) {
    return this.service.updateTicket(id, dto, tenantId, token, userId)
  }

  @Patch('tickets/:id/status')
  @ApiOperation({ summary: 'Update ticket status (resolve, close, reopen…)' })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { status: string; resolution_note?: string },
    @TenantId() tenantId: string,
    @AccessToken() token: string,
    @CurrentUserId() userId: string,
  ) {
    return this.service.updateStatus(id, dto.status, dto.resolution_note, tenantId, token, userId)
  }

  @Post('tickets/:id/escalate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Escalate ticket to senior agent / manager' })
  escalateTicket(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('escalated_to', ParseUUIDPipe) escalatedTo: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
    @CurrentUserId() userId: string,
  ) {
    return this.service.escalateTicket(id, escalatedTo, tenantId, token, userId)
  }

  @Post('tickets/:id/satisfaction')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit satisfaction rating for resolved ticket' })
  submitSatisfaction(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { score: number; note?: string },
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.submitSatisfaction(id, dto.score, dto.note, tenantId, token)
  }

  // ── Comments ───────────────────────────────────────────────────────────────

  @Post('tickets/:id/comments')
  @ApiOperation({ summary: 'Add comment or internal note to ticket' })
  addComment(
    @Param('id', ParseUUIDPipe) ticketId: string,
    @Body() dto: any,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
    @CurrentUserId() userId: string,
  ) {
    return this.service.addComment(ticketId, dto, tenantId, token, userId)
  }

  // ── Bulk operations ────────────────────────────────────────────────────────

  @Post('tickets/bulk-status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bulk update status for multiple tickets' })
  bulkStatus(
    @Body() dto: { ids: string[]; status: string },
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.bulkUpdateStatus(dto.ids, dto.status, tenantId, token)
  }

  @Post('tickets/bulk-assign')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bulk assign tickets to an agent' })
  bulkAssign(
    @Body() dto: { ids: string[]; assigned_to: string },
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.bulkAssign(dto.ids, dto.assigned_to, tenantId, token)
  }

  // ── Knowledge Base ─────────────────────────────────────────────────────────

  @Get('kb')
  @ApiOperation({ summary: 'List knowledge base articles' })
  listArticles(
    @TenantId() tenantId: string,
    @AccessToken() token: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.service.listArticles(tenantId, token, status, search)
  }

  @Post('kb')
  @ApiOperation({ summary: 'Create or update KB article' })
  upsertArticle(
    @Body() dto: any,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
    @CurrentUserId() userId: string,
  ) {
    return this.service.upsertArticle(dto, tenantId, token, userId)
  }

  @Get('kb/:id')
  @ApiOperation({ summary: 'Get KB article (increments view count)' })
  getArticle(
    @Param('id', ParseUUIDPipe) id: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.getArticle(id, tenantId, token)
  }

  @Post('kb/:id/rate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rate KB article helpful/not helpful' })
  rateArticle(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('helpful') helpful: boolean,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.rateArticle(id, helpful, tenantId, token)
  }

  // ── Config & Meta ──────────────────────────────────────────────────────────

  @Get('categories')
  @ApiOperation({ summary: 'List ticket categories' })
  listCategories(
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.listCategories(tenantId, token)
  }

  @Get('sla-policies')
  @ApiOperation({ summary: 'List SLA policies' })
  listSlaPolicies(
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.listSlaPolicies(tenantId, token)
  }

  @Get('agents/stats')
  @ApiOperation({ summary: 'Agent performance statistics' })
  getAgentStats(
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.getAgentStats(tenantId, token)
  }
}
