import {
  Controller, Get, Post, Put, Patch, Delete,
  Param, Body, Query, UseGuards, Headers, BadRequestException,
} from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { AuthGuard } from '../../common/guards/auth.guard'
import { WorkspaceRoleGuard } from '../../common/guards/workspace-role.guard'
import { RequireTenantRole } from '../../common/decorators/require-tenant-role.decorator'
import { RbacService } from './rbac.service'

@ApiTags('RBAC')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller({ path: 'rbac', version: '1' })
export class RbacController {
  constructor(private readonly rbac: RbacService) {}

  // ── Permissions catalogue (any member) ──────────────────────────────────

  @Get('permissions')
  @ApiOperation({ summary: 'List all permissions' })
  listPermissions(@Headers('authorization') auth: string) {
    const token = auth?.replace('Bearer ', '')
    return this.rbac.listPermissions(token)
  }

  // ── Roles (read: event_manager+; write: owner) ───────────────────────────

  @Get('roles')
  @ApiOperation({ summary: 'List all roles' })
  listRoles(@Headers('authorization') auth: string) {
    const token = auth?.replace('Bearer ', '')
    return this.rbac.listRoles(token)
  }

  @Get('roles/:id')
  @ApiOperation({ summary: 'Get role details with permissions and members' })
  getRole(@Param('id') id: string, @Headers('authorization') auth: string) {
    const token = auth?.replace('Bearer ', '')
    return this.rbac.getRole(id, token)
  }

  @Post('roles')
  @UseGuards(WorkspaceRoleGuard)
  @RequireTenantRole('owner')
  @ApiOperation({ summary: 'Create a new role [Owner only]' })
  createRole(
    @Headers('authorization') auth: string,
    @Body() body: {
      name: string
      description?: string
      color?: string
      priority?: number
      permission_ids?: string[]
    },
  ) {
    const token = auth?.replace('Bearer ', '')
    return this.rbac.createRole(token, body)
  }

  @Patch('roles/:id')
  @UseGuards(WorkspaceRoleGuard)
  @RequireTenantRole('owner')
  @ApiOperation({ summary: 'Update a role [Owner only]' })
  updateRole(
    @Param('id') id: string,
    @Headers('authorization') auth: string,
    @Body() body: { name?: string; description?: string; color?: string; priority?: number },
  ) {
    const token = auth?.replace('Bearer ', '')
    return this.rbac.updateRole(id, token, body)
  }

  @Delete('roles/:id')
  @UseGuards(WorkspaceRoleGuard)
  @RequireTenantRole('owner')
  @ApiOperation({ summary: 'Delete a role [Owner only]' })
  deleteRole(@Param('id') id: string, @Headers('authorization') auth: string) {
    const token = auth?.replace('Bearer ', '')
    return this.rbac.deleteRole(id, token)
  }

  // ── Role permissions (owner only) ────────────────────────────────────────

  @Put('roles/:id/permissions')
  @UseGuards(WorkspaceRoleGuard)
  @RequireTenantRole('owner')
  @ApiOperation({ summary: 'Replace all permissions for a role [Owner only]' })
  setRolePermissions(
    @Param('id') id: string,
    @Headers('authorization') auth: string,
    @Body() body: { permission_ids: string[] },
  ) {
    const token = auth?.replace('Bearer ', '')
    return this.rbac.setRolePermissions(id, token, body.permission_ids ?? [])
  }

  @Post('roles/:id/permissions/:permissionId')
  @UseGuards(WorkspaceRoleGuard)
  @RequireTenantRole('owner')
  @ApiOperation({ summary: 'Grant a permission to a role [Owner only]' })
  grantPermission(
    @Param('id') id: string,
    @Param('permissionId') permissionId: string,
    @Headers('authorization') auth: string,
  ) {
    const token = auth?.replace('Bearer ', '')
    return this.rbac.grantPermission(id, permissionId, token)
  }

  @Delete('roles/:id/permissions/:permissionId')
  @UseGuards(WorkspaceRoleGuard)
  @RequireTenantRole('owner')
  @ApiOperation({ summary: 'Revoke a permission from a role [Owner only]' })
  revokePermission(
    @Param('id') id: string,
    @Param('permissionId') permissionId: string,
    @Headers('authorization') auth: string,
  ) {
    const token = auth?.replace('Bearer ', '')
    return this.rbac.revokePermission(id, permissionId, token)
  }

  // ── Profile role assignments (event_manager+ assigns; owner creates/removes) ──

  @Get('profiles/:profileId/roles')
  @ApiOperation({ summary: 'Get roles and permissions for a profile' })
  getProfileRoles(
    @Param('profileId') profileId: string,
    @Headers('authorization') auth: string,
  ) {
    const token = auth?.replace('Bearer ', '')
    return this.rbac.getProfileRoles(profileId, token)
  }

  @Post('profiles/:profileId/roles/:roleId')
  @UseGuards(WorkspaceRoleGuard)
  @RequireTenantRole('owner')
  @ApiOperation({ summary: 'Assign a role to a profile [Owner only]' })
  assignRole(
    @Param('profileId') profileId: string,
    @Param('roleId') roleId: string,
    @Headers('authorization') auth: string,
    @Body() body: { expires_at?: string },
  ) {
    const token = auth?.replace('Bearer ', '')
    return this.rbac.assignRole(profileId, roleId, token, body?.expires_at)
  }

  @Delete('profiles/:profileId/roles/:roleId')
  @UseGuards(WorkspaceRoleGuard)
  @RequireTenantRole('owner')
  @ApiOperation({ summary: 'Revoke a role from a profile [Owner only]' })
  revokeRole(
    @Param('profileId') profileId: string,
    @Param('roleId') roleId: string,
    @Headers('authorization') auth: string,
  ) {
    const token = auth?.replace('Bearer ', '')
    return this.rbac.revokeRole(profileId, roleId, token)
  }

  // ── Current user (self-service) ──────────────────────────────────────────

  @Get('me/permissions')
  @ApiOperation({ summary: 'Get all permission codes for the current user' })
  getMyPermissions(@Headers('authorization') auth: string) {
    const token = auth?.replace('Bearer ', '')
    return this.rbac.getMyPermissions(token)
  }

  // ── Resource ACLs (owner manages) ────────────────────────────────────────

  @Get('acls')
  @ApiOperation({ summary: 'List resource ACLs' })
  listAcls(
    @Headers('authorization') auth: string,
    @Query('resource_type') resourceType?: string,
    @Query('resource_id') resourceId?: string,
  ) {
    const token = auth?.replace('Bearer ', '')
    return this.rbac.listAcls(token, resourceType, resourceId)
  }

  @Post('acls')
  @UseGuards(WorkspaceRoleGuard)
  @RequireTenantRole('owner')
  @ApiOperation({ summary: 'Grant or deny a resource ACL [Owner only]' })
  grantAcl(
    @Headers('authorization') auth: string,
    @Body() body: {
      profile_id: string
      resource_type: string
      resource_id: string
      permission_id: string
      is_grant?: boolean
    },
  ) {
    const token = auth?.replace('Bearer ', '')
    return this.rbac.grantAcl(token, body)
  }

  @Delete('acls/:id')
  @UseGuards(WorkspaceRoleGuard)
  @RequireTenantRole('owner')
  @ApiOperation({ summary: 'Remove a resource ACL [Owner only]' })
  removeAcl(@Param('id') id: string, @Headers('authorization') auth: string) {
    const token = auth?.replace('Bearer ', '')
    return this.rbac.removeAcl(id, token)
  }

  // ── Audit log (event_manager+) ────────────────────────────────────────────

  @Get('audit-log')
  @ApiOperation({ summary: 'Get RBAC audit log' })
  getAuditLog(
    @Headers('authorization') auth: string,
    @Query('limit') limit?: string,
  ) {
    const token = auth?.replace('Bearer ', '')
    return this.rbac.getAuditLog(token, limit ? parseInt(limit) : 100)
  }

  // ── Members directory (any member) ───────────────────────────────────────

  @Get('members')
  @ApiOperation({ summary: 'List all members with their roles' })
  getMembers(@Headers('authorization') auth: string) {
    const token = auth?.replace('Bearer ', '')
    return this.rbac.getMembers(token)
  }

  @Get('members/:id/permissions')
  @ApiOperation({ summary: 'Get all permissions for a team member' })
  getMemberPermissions(
    @Param('id') id: string,
    @Headers('authorization') auth: string,
  ) {
    const token = auth?.replace('Bearer ', '')
    return this.rbac.getMemberPermissions(id, token)
  }

  @Put('members/:id/permissions')
  @UseGuards(WorkspaceRoleGuard)
  @RequireTenantRole('owner')
  @ApiOperation({ summary: 'Update permissions for a member [Owner only]' })
  updateMemberPermissions(
    @Param('id') id: string,
    @Headers('authorization') auth: string,
    @Body() body: { permissions: Record<string, boolean> },
  ) {
    const token = auth?.replace('Bearer ', '')
    return this.rbac.updateMemberPermissions(id, token, body.permissions)
  }
}
