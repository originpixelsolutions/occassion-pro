import {
  Controller, Get, Post, Put, Patch, Delete,
  Param, Body, Query, UseGuards, HttpCode,
} from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { TeamService } from './team.service'
import { AuthGuard } from '../../common/guards/auth.guard'
import { WorkspaceRoleGuard } from '../../common/guards/workspace-role.guard'
import { RequireTenantRole } from '../../common/decorators/require-tenant-role.decorator'
import { TenantId, CurrentUserId, AccessToken } from '../../common/decorators/tenant.decorator'

@ApiTags('Team')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard)
@Controller({ path: 'team', version: '1' })
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  // ─── Read: any member ────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'List all team members' })
  getMembers(@TenantId() t: string, @AccessToken() token: string) {
    return this.teamService.getTeamMembers(t, token)
  }

  // ─── Invite / create: Owner only ─────────────────────────────────────────

  @Post('invite')
  @UseGuards(WorkspaceRoleGuard)
  @RequireTenantRole('owner')
  @ApiOperation({ summary: 'Invite a team member [Owner only]' })
  inviteMember(
    @Body() dto: { email: string; role: string },
    @TenantId() t: string,
    @CurrentUserId() u: string,
  ) {
    return this.teamService.inviteMember({ ...dto, tenantId: t, invitedBy: u })
  }

  @Post()
  @UseGuards(WorkspaceRoleGuard)
  @RequireTenantRole('owner')
  @ApiOperation({ summary: 'Add a team member directly [Owner only]' })
  create(
    @Body() dto: any,
    @TenantId() t: string,
    @AccessToken() token: string,
  ) {
    return this.teamService.createMember(t, dto, token)
  }

  // ─── Role assignment: Owner only ─────────────────────────────────────────

  @Put(':userId/role')
  @UseGuards(WorkspaceRoleGuard)
  @RequireTenantRole('owner')
  @ApiOperation({ summary: 'Change a member\'s role [Owner only]' })
  updateRole(
    @Param('userId') userId: string,
    @Body() body: { role: string },
    @TenantId() t: string,
    @AccessToken() token: string,
  ) {
    return this.teamService.updateMemberRole(userId, body.role, t, token)
  }

  // ─── Transfer ownership: Owner only ──────────────────────────────────────

  @Post('transfer-ownership')
  @UseGuards(WorkspaceRoleGuard)
  @RequireTenantRole('owner')
  @ApiOperation({ summary: 'Transfer workspace ownership to another member [Owner only]' })
  transferOwnership(
    @Body() body: { new_owner_user_id: string },
    @TenantId() t: string,
    @CurrentUserId() u: string,
    @AccessToken() token: string,
  ) {
    return this.teamService.transferOwnership(t, u, body.new_owner_user_id, token)
  }

  // ─── Update member profile: event_manager or above ───────────────────────

  @Patch(':id')
  @UseGuards(WorkspaceRoleGuard)
  @RequireTenantRole('event_manager')
  @ApiOperation({ summary: 'Update a team member [Event Manager+]' })
  update(
    @Param('id') id: string,
    @Body() dto: any,
    @TenantId() t: string,
    @AccessToken() token: string,
  ) {
    return this.teamService.updateMember(id, t, dto, token)
  }

  // ─── Remove member: Owner only ────────────────────────────────────────────

  @Delete(':id')
  @HttpCode(204)
  @UseGuards(WorkspaceRoleGuard)
  @RequireTenantRole('owner')
  @ApiOperation({ summary: 'Remove a team member [Owner only]' })
  remove(
    @Param('id') id: string,
    @TenantId() t: string,
    @AccessToken() token: string,
  ) {
    return this.teamService.removeMember(id, t, token)
  }
}
