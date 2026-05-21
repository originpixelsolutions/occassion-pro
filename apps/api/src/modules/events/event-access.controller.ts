/**
 * OccasionPro — Event Access Controller
 *
 * Endpoints for managing per-event team membership and module overrides.
 * All routes require the user to be an authenticated tenant member.
 * Mutation routes (add/remove/override) require event_manager or owner role.
 */

import {
  Controller,
  Get,
  Post,
  Delete,
  Put,
  Param,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common'
import { EventAccessService, ModuleOverrides } from './event-access.service'
import { WorkspaceRoleGuard } from '../../common/guards/workspace-role.guard'
import { RequireTenantRole } from '../../common/decorators/require-tenant-role.decorator'

// ─── DTOs ──────────────────────────────────────────────────────────────────

class AddEventMemberDto {
  user_id: string
}

class RemoveEventMemberDto {
  reason?: string
}

class UpdateModuleOverridesDto {
  overrides: ModuleOverrides
}

// ─── Controller ────────────────────────────────────────────────────────────

@Controller('events/:eventId/team')
export class EventAccessController {
  constructor(private readonly eventAccessService: EventAccessService) {}

  /**
   * GET /events/:eventId/team
   * Returns all workspace members with their event-level access status.
   * All authenticated members can view the team list.
   */
  @Get()
  async getEventTeam(
    @Param('eventId') eventId: string,
    @Req() req: any,
  ) {
    const tenantId = req.tenantId
    const members = await this.eventAccessService.getEventTeam(eventId, tenantId)
    return { members, total: members.length }
  }

  /**
   * GET /events/:eventId/team/:userId
   * Returns the event-level access details for a specific member.
   */
  @Get(':userId')
  async getMemberAccess(
    @Param('eventId') eventId: string,
    @Param('userId') userId: string,
    @Req() req: any,
  ) {
    const tenantId = req.tenantId
    const access = await this.eventAccessService.getMemberAccess(eventId, userId, tenantId)
    return { access }
  }

  /**
   * POST /events/:eventId/team
   * Adds a workspace member to this event (or re-activates if removed).
   * Requires event_manager or above.
   */
  @Post()
  @UseGuards(WorkspaceRoleGuard)
  @RequireTenantRole('event_manager')
  @HttpCode(HttpStatus.CREATED)
  async addToEvent(
    @Param('eventId') eventId: string,
    @Body() body: AddEventMemberDto,
    @Req() req: any,
  ) {
    const tenantId = req.tenantId
    const addedBy = req.user.sub
    return this.eventAccessService.addToEvent(eventId, body.user_id, addedBy, tenantId)
  }

  /**
   * DELETE /events/:eventId/team/:userId
   * Removes a member from this specific event only.
   * Their workspace account remains intact.
   * Requires event_manager (can only remove leads/members) or owner (can remove anyone).
   */
  @Delete(':userId')
  @UseGuards(WorkspaceRoleGuard)
  @RequireTenantRole('event_manager')
  @HttpCode(HttpStatus.OK)
  async removeFromEvent(
    @Param('eventId') eventId: string,
    @Param('userId') userId: string,
    @Body() body: RemoveEventMemberDto,
    @Req() req: any,
  ) {
    const tenantId = req.tenantId
    const removedBy = req.user.sub
    return this.eventAccessService.removeFromEvent(
      eventId,
      userId,
      removedBy,
      tenantId,
      body.reason,
    )
  }

  /**
   * PUT /events/:eventId/team/:userId/access
   * Sets per-module overrides for a member within this event.
   * Requires event_manager or owner.
   */
  @Put(':userId/access')
  @UseGuards(WorkspaceRoleGuard)
  @RequireTenantRole('event_manager')
  async updateModuleOverrides(
    @Param('eventId') eventId: string,
    @Param('userId') userId: string,
    @Body() body: UpdateModuleOverridesDto,
    @Req() req: any,
  ) {
    const tenantId = req.tenantId
    const updatedBy = req.user.sub
    return this.eventAccessService.updateModuleOverrides(
      eventId,
      userId,
      updatedBy,
      tenantId,
      body.overrides,
    )
  }

  /**
   * DELETE /events/:eventId/team/:userId/access
   * Clears all per-module overrides — member falls back to workspace role defaults.
   * Requires event_manager or owner.
   */
  @Delete(':userId/access')
  @UseGuards(WorkspaceRoleGuard)
  @RequireTenantRole('event_manager')
  @HttpCode(HttpStatus.OK)
  async clearModuleOverrides(
    @Param('eventId') eventId: string,
    @Param('userId') userId: string,
    @Req() req: any,
  ) {
    const tenantId = req.tenantId
    const clearedBy = req.user.sub
    return this.eventAccessService.clearModuleOverrides(eventId, userId, clearedBy, tenantId)
  }

  /**
   * GET /events/:eventId/team/:userId/check
   * Returns effective access level for the current user on this event.
   * Used by frontend to show/hide UI sections.
   */
  @Get(':userId/check')
  async checkAccess(
    @Param('eventId') eventId: string,
    @Param('userId') userId: string,
    @Req() req: any,
  ) {
    return this.eventAccessService.checkAccess(userId, eventId)
  }

  /**
   * GET /events/:eventId/team/me/access
   * Returns the current user's effective access for this event (all modules).
   */
  @Get('me/access')
  async getMyAccess(
    @Param('eventId') eventId: string,
    @Req() req: any,
  ) {
    const userId = req.user.sub
    return this.eventAccessService.checkAccess(userId, eventId)
  }
}
