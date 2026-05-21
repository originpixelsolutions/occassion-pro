import {
  Controller, Post, Get, Put, Delete, Body, Param, Headers,
  HttpCode, HttpStatus, UseGuards, Request, ParseUUIDPipe,
  UnauthorizedException,
} from '@nestjs/common'
import { ClientPortalService } from './client-portal.service'
import { ClientPortalAuthGuard } from './client-portal-auth.guard'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { TenantGuard } from '../auth/guards/tenant.guard'

@Controller('client-portal')
export class ClientPortalController {
  constructor(private readonly svc: ClientPortalService) {}

  // ─── Public: Magic Link Auth ──────────────────────────────────────────────

  /** POST /client-portal/auth/magic-link  { email, tenant_id } */
  @Post('auth/magic-link')
  @HttpCode(HttpStatus.OK)
  async requestMagicLink(@Body() dto: { email: string; tenant_id: string }) {
    // In prod: email the token — here we return it so the calling service can send it
    return this.svc.initiateMagicLink(dto.email, dto.tenant_id)
  }

  /** POST /client-portal/auth/verify  { token, tenant_id } */
  @Post('auth/verify')
  @HttpCode(HttpStatus.OK)
  async verifyMagicLink(@Body() dto: { token: string; tenant_id: string }) {
    return this.svc.verifyMagicLink(dto.token, dto.tenant_id)
  }

  /** POST /client-portal/auth/login  { email, password, tenant_id } */
  @Post('auth/login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: { email: string; password: string; tenant_id: string }) {
    return this.svc.loginWithPassword(dto.email, dto.password, dto.tenant_id)
  }

  /** POST /client-portal/auth/logout  (X-Client-Session header required) */
  @Post('auth/logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Headers('x-client-session') sessionToken: string) {
    if (!sessionToken) return { success: true }
    return this.svc.logout(sessionToken)
  }

  // ─── Client: Password setup ───────────────────────────────────────────────

  /** POST /client-portal/auth/set-password  { password }  (requires session) */
  @Post('auth/set-password')
  @UseGuards(ClientPortalAuthGuard)
  @HttpCode(HttpStatus.OK)
  async setPassword(@Request() req: any, @Body() dto: { password: string }) {
    return this.svc.setPassword(req.clientSession.sessionToken, dto.password)
  }

  // ─── Client: Dashboard ────────────────────────────────────────────────────

  @Get('dashboard')
  @UseGuards(ClientPortalAuthGuard)
  async getDashboard(@Request() req: any) {
    return this.svc.getClientDashboard(req.clientSession.clientId)
  }

  // ─── Client: Event pages ──────────────────────────────────────────────────

  @Get('events/:eventId')
  @UseGuards(ClientPortalAuthGuard)
  async getEventOverview(
    @Request() req: any,
    @Param('eventId', ParseUUIDPipe) eventId: string,
  ) {
    return this.svc.getEventOverview(req.clientSession.clientId, eventId)
  }

  @Get('events/:eventId/messages')
  @UseGuards(ClientPortalAuthGuard)
  async getMessages(@Request() req: any, @Param('eventId', ParseUUIDPipe) eventId: string) {
    return this.svc.getMessages(req.clientSession.clientId, eventId)
  }

  @Post('events/:eventId/messages')
  @UseGuards(ClientPortalAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async sendMessage(
    @Request() req: any,
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() dto: { message: string; attachment_url?: string; attachment_name?: string },
  ) {
    return this.svc.sendMessage(
      req.clientSession.clientId, eventId,
      dto.message, dto.attachment_url, dto.attachment_name,
    )
  }

  @Get('events/:eventId/documents')
  @UseGuards(ClientPortalAuthGuard)
  async getDocuments(@Request() req: any, @Param('eventId', ParseUUIDPipe) eventId: string) {
    return this.svc.getDocuments(req.clientSession.clientId, eventId)
  }

  @Get('events/:eventId/budget')
  @UseGuards(ClientPortalAuthGuard)
  async getBudget(@Request() req: any, @Param('eventId', ParseUUIDPipe) eventId: string) {
    return this.svc.getEventBudget(req.clientSession.clientId, eventId)
  }

  @Get('events/:eventId/approvals')
  @UseGuards(ClientPortalAuthGuard)
  async getApprovals(@Request() req: any, @Param('eventId', ParseUUIDPipe) eventId: string) {
    return this.svc.getApprovals(req.clientSession.clientId, eventId)
  }

  @Post('events/:eventId/approvals/:approvalId/review')
  @UseGuards(ClientPortalAuthGuard)
  @HttpCode(HttpStatus.OK)
  async submitApproval(
    @Request() req: any,
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Param('approvalId', ParseUUIDPipe) approvalId: string,
    @Body() dto: { status: 'approved' | 'changes_requested'; comment?: string },
  ) {
    return this.svc.submitApproval(
      req.clientSession.clientId, eventId, approvalId, dto.status, dto.comment,
    )
  }

  // ─── Staff: Manage client access ─────────────────────────────────────────

  @Post('invite')
  @UseGuards(JwtAuthGuard, TenantGuard)
  @HttpCode(HttpStatus.CREATED)
  async inviteClient(
    @Request() req: any,
    @Body() dto: { email: string; event_id: string; access_level: 'view_only' | 'collaborator' | 'full_access' },
  ) {
    return this.svc.inviteClient(req.tenantId, dto.event_id, dto.email, dto.access_level, req.user.id)
  }

  @Get('events/:eventId/clients')
  @UseGuards(JwtAuthGuard, TenantGuard)
  async getEventClients(
    @Request() req: any,
    @Param('eventId', ParseUUIDPipe) eventId: string,
  ) {
    return this.svc.getEventClients(req.tenantId, eventId)
  }

  @Post('events/:eventId/messages/staff')
  @UseGuards(JwtAuthGuard, TenantGuard)
  @HttpCode(HttpStatus.CREATED)
  async sendMessageAsStaff(
    @Request() req: any,
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() dto: { message: string; attachment_url?: string; attachment_name?: string },
  ) {
    return this.svc.sendMessageAsStaff(
      req.tenantId, req.user.id, eventId,
      dto.message, dto.attachment_url, dto.attachment_name,
    )
  }

  @Post('approvals')
  @UseGuards(JwtAuthGuard, TenantGuard)
  @HttpCode(HttpStatus.CREATED)
  async createApproval(@Request() req: any, @Body() dto: any) {
    return this.svc.createApproval(req.tenantId, dto.event_id, { ...dto, submitted_by: req.user.id })
  }

  @Get(':eventId/settings')
  @UseGuards(JwtAuthGuard, TenantGuard)
  async getSettings(@Request() req: any, @Param('eventId', ParseUUIDPipe) eventId: string) {
    return this.svc.getPortalSettings(req.tenantId, eventId)
  }

  @Put(':eventId/settings')
  @UseGuards(JwtAuthGuard, TenantGuard)
  async upsertSettings(@Request() req: any, @Param('eventId', ParseUUIDPipe) eventId: string, @Body() dto: any) {
    return this.svc.upsertPortalSettings(req.tenantId, eventId, dto)
  }

  @Delete(':eventId/access/:clientId')
  @UseGuards(JwtAuthGuard, TenantGuard)
  async revokeAccess(
    @Request() req: any,
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Param('clientId', ParseUUIDPipe) clientId: string,
  ) {
    return this.svc.revokeAccess(req.tenantId, clientId, eventId)
  }
}
