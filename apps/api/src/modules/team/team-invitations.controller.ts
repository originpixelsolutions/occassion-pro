import {
  Controller, Get, Post, Delete,
  Param, Body, Query, UseGuards,
  HttpCode, HttpStatus,
} from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { TeamInvitationsService } from './team-invitations.service'
import { AuthGuard } from '../../common/guards/auth.guard'
import { WorkspaceRoleGuard } from '../../common/guards/workspace-role.guard'
import { RequireTenantRole } from '../../common/decorators/require-tenant-role.decorator'
import { TenantId, CurrentUserId } from '../../common/decorators/tenant.decorator'
import { Public } from '../../common/decorators/public.decorator'

// ── Protected routes (staff / workspace members) ──────────────────────────────

@ApiTags('Team Invitations')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard)
@Controller({ path: 'team/invitations', version: '1' })
export class TeamInvitationsController {
  constructor(private readonly svc: TeamInvitationsService) {}

  /** List all invitations for the current workspace */
  @Get()
  @ApiOperation({ summary: 'List invitations' })
  list(@TenantId() tenantId: string) {
    return this.svc.listInvitations(tenantId)
  }

  /** Send a new invitation (owner/event_manager only) */
  @Post()
  @UseGuards(WorkspaceRoleGuard)
  @RequireTenantRole('owner', 'event_manager')
  @ApiOperation({ summary: 'Send invitation' })
  create(
    @Body() dto: { email: string; name?: string; role: 'event_manager' | 'team_lead' | 'team_member' },
    @TenantId() tenantId: string,
    @CurrentUserId() userId: string,
  ) {
    return this.svc.createInvitation({ ...dto, tenantId, invitedBy: userId })
  }

  /** Resend / refresh an invitation */
  @Post(':id/resend')
  @UseGuards(WorkspaceRoleGuard)
  @RequireTenantRole('owner', 'event_manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend invitation' })
  resend(
    @Param('id') id: string,
    @TenantId() tenantId: string,
  ) {
    return this.svc.resendInvitation(id, tenantId)
  }

  /** Revoke a pending invitation */
  @Delete(':id')
  @UseGuards(WorkspaceRoleGuard)
  @RequireTenantRole('owner', 'event_manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke invitation' })
  revoke(
    @Param('id') id: string,
    @TenantId() tenantId: string,
  ) {
    return this.svc.revokeInvitation(id, tenantId)
  }
}

// ── Public routes (no auth — used by the /invite page) ────────────────────────

@ApiTags('Invite')
@Controller({ path: 'invite', version: '1' })
export class InviteController {
  constructor(private readonly svc: TeamInvitationsService) {}

  /**
   * GET /v1/invite/info?token=xxx
   * Returns workspace + role info so the invite page can render before the user signs up.
   */
  @Public()
  @Get('info')
  @ApiOperation({ summary: 'Get invitation info by token (public)' })
  info(@Query('token') token: string) {
    return this.svc.getInvitationByToken(token)
  }

  /**
   * POST /v1/invite/accept
   * Creates the user account and marks invitation accepted.
   */
  @Public()
  @Post('accept')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accept invitation and create account (public)' })
  accept(@Body() dto: { token: string; name: string; password: string }) {
    return this.svc.acceptInvitation(dto)
  }
}
