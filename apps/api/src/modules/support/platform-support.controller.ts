import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, UseGuards,
  ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { PlatformSupportService } from './platform-support.service'
import { SupportBotService } from './support-bot.service'
import { AuthGuard } from '../../common/guards/auth.guard'
import { TenantId, AccessToken, CurrentUserId } from '../../common/decorators/tenant.decorator'
import { Roles } from '../../common/decorators/roles.decorator'
import { RolesGuard } from '../../common/guards/roles.guard'

// ── Team-facing support routes (/support) ─────────────────────────────────────

@ApiTags('Platform Support')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard)
@Controller({ path: 'support', version: '1' })
export class PlatformSupportController {
  constructor(
    private readonly platformSvc: PlatformSupportService,
    private readonly botSvc: SupportBotService,
  ) {}

  // FAQ browsing
  @Get('faqs')
  @ApiOperation({ summary: 'Browse / search platform FAQs' })
  searchFaqs(@Query('q') q?: string, @Query('category') category?: string) {
    if (category) return this.botSvc.getFaqsByCategory(category)
    return this.botSvc.searchFaqs(q ?? '')
  }

  @Get('faqs/categories')
  @ApiOperation({ summary: 'List distinct FAQ categories' })
  getCategories() {
    return this.botSvc.getCategories()
  }

  // Platform help tickets
  @Post('help')
  @ApiOperation({ summary: 'Submit a help ticket (bot auto-responds)' })
  createTicket(
    @Body() dto: { subject: string; description: string; category: string },
    @TenantId() tenantId: string,
    @CurrentUserId() userId: string,
    @AccessToken() token: string,
  ) {
    return this.platformSvc.createTicket(tenantId, userId, dto, token)
  }

  @Get('help')
  @ApiOperation({ summary: 'My platform support tickets' })
  getMyTickets(
    @TenantId() tenantId: string,
    @CurrentUserId() userId: string,
    @AccessToken() token: string,
    @Query('status') status?: string,
  ) {
    return this.platformSvc.getMyTickets(tenantId, userId, token, status)
  }

  @Get('help/:id')
  @ApiOperation({ summary: 'Get platform ticket + message thread' })
  getTicket(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUserId() userId: string,
    @AccessToken() token: string,
  ) {
    return this.platformSvc.getTicket(id, userId, token)
  }

  @Post('help/:id/messages')
  @ApiOperation({ summary: 'Add a message to a platform ticket' })
  addMessage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('message') message: string,
    @CurrentUserId() userId: string,
    @AccessToken() token: string,
  ) {
    return this.platformSvc.addMessage(id, userId, message, token)
  }

  @Post('help/:id/escalate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Escalate ticket to human support team' })
  escalate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUserId() userId: string,
    @AccessToken() token: string,
  ) {
    return this.platformSvc.escalateTicket(id, userId, token)
  }

  @Post('help/:id/resolve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a ticket as resolved' })
  resolve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('resolution_notes') notes: string,
    @CurrentUserId() userId: string,
    @AccessToken() token: string,
  ) {
    return this.platformSvc.resolveTicket(id, userId, notes, token)
  }
}

// ── Super Admin routes (/super-admin/support) ─────────────────────────────────

@ApiTags('Super Admin — Support')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard, RolesGuard)
@Roles('super_admin')
@Controller({ path: 'super-admin/support', version: '1' })
export class SuperAdminSupportController {
  constructor(
    private readonly platformSvc: PlatformSupportService,
    private readonly botSvc: SupportBotService,
  ) {}

  // ── Tickets inbox ─────────────────────────────────────────────────────────

  @Get('tickets')
  @ApiOperation({ summary: 'All platform tickets across all tenants' })
  getAllTickets(
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('tenant') tenant?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.platformSvc.getAllTickets({
      status,
      priority,
      tenant,
      limit:  limit  ? parseInt(limit)  : 50,
      offset: offset ? parseInt(offset) : 0,
    })
  }

  @Post('tickets/:id/reply')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Super Admin: reply to a ticket' })
  reply(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('message') message: string,
    @CurrentUserId() superAdminId: string,
  ) {
    return this.platformSvc.superAdminReply(id, message, superAdminId)
  }

  @Post('tickets/:id/resolve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Super Admin: resolve a ticket' })
  resolve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('resolution_notes') notes: string,
    @CurrentUserId() superAdminId: string,
  ) {
    return this.platformSvc.superAdminResolve(id, notes, superAdminId)
  }

  // ── FAQ management ────────────────────────────────────────────────────────

  @Get('faqs')
  @ApiOperation({ summary: 'List all FAQs (including inactive)' })
  listFaqs() {
    return this.botSvc.listAllFaqs()
  }

  @Post('faqs')
  @ApiOperation({ summary: 'Create a new FAQ' })
  createFaq(
    @Body() dto: {
      question: string
      answer: string
      keywords: string[]
      category: string
      sort_order?: number
    },
  ) {
    return this.botSvc.createFaq(dto)
  }

  @Patch('faqs/:id')
  @ApiOperation({ summary: 'Update an FAQ' })
  updateFaq(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: any,
  ) {
    return this.botSvc.updateFaq(id, dto)
  }

  @Delete('faqs/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an FAQ' })
  deleteFaq(@Param('id', ParseUUIDPipe) id: string) {
    return this.botSvc.deleteFaq(id)
  }
}
