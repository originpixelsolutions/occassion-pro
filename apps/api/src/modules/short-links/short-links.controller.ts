import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, Req, Res,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common'
import type { Response, Request } from 'express'
import { ShortLinksService, CreateShortLinkDto } from './short-links.service'
import { WorkspaceRoleGuard } from '../../common/guards/workspace-role.guard'
import { RequireTenantRole } from '../../common/decorators/require-tenant-role.decorator'

@Controller('short-links')
export class ShortLinksController {
  constructor(private readonly shortLinks: ShortLinksService) {}

  // ── Authenticated endpoints ────────────────────────────────────────────────

  @Post()
  @UseGuards(WorkspaceRoleGuard)
  @RequireTenantRole('team_member')
  async create(@Body() dto: CreateShortLinkDto, @Req() req: any) {
    return this.shortLinks.create(dto, req.user.sub)
  }

  @Post('bulk')
  @UseGuards(WorkspaceRoleGuard)
  @RequireTenantRole('team_member')
  async createBulk(@Body() body: { links: CreateShortLinkDto[] }, @Req() req: any) {
    return this.shortLinks.createBulk(body.links, req.user.sub)
  }

  @Get('event/:eventId')
  @UseGuards(WorkspaceRoleGuard)
  @RequireTenantRole('team_member')
  async getForEvent(
    @Param('eventId') eventId: string,
    @Query('tenant_id') tenantId: string,
    @Query('link_type') linkType?: string,
  ) {
    return this.shortLinks.getForEvent(eventId, tenantId, linkType)
  }

  @Get(':id/analytics')
  @UseGuards(WorkspaceRoleGuard)
  @RequireTenantRole('team_member')
  async getAnalytics(
    @Param('id') id: string,
    @Query('tenant_id') tenantId: string,
  ) {
    return this.shortLinks.getClickAnalytics(id, tenantId)
  }

  @Patch(':id')
  @UseGuards(WorkspaceRoleGuard)
  @RequireTenantRole('team_member')
  async update(
    @Param('id') id: string,
    @Body() dto: any,
    @Query('tenant_id') tenantId: string,
  ) {
    return this.shortLinks.update(id, dto, tenantId)
  }

  @Delete(':id')
  @UseGuards(WorkspaceRoleGuard)
  @RequireTenantRole('event_manager')
  @HttpCode(HttpStatus.OK)
  async deactivate(
    @Param('id') id: string,
    @Query('tenant_id') tenantId: string,
  ) {
    return this.shortLinks.deactivate(id, tenantId)
  }

  // ── Public redirect endpoint (fallback when CF Worker isn't active) ────────

  @Get('r/:code')
  async redirect(
    @Param('code') code: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const ua = req.headers['user-agent'] ?? ''
    const device = /Mobile|Android|iPhone|iPad/i.test(ua)
      ? 'mobile'
      : /Tablet|iPad/i.test(ua) ? 'tablet' : 'desktop'

    const result = await this.shortLinks.resolve(code, {
      userAgent:  ua,
      referrer:   req.headers['referer'] ?? undefined,
      device,
    })

    if (!result) {
      return res.status(404).json({ message: 'Link not found or expired' })
    }

    return res.redirect(302, result.destination_url)
  }
}
