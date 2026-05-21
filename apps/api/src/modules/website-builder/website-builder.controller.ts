import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { WebsiteBuilderService, CreateWebsiteDto, SectionDto } from './website-builder.service'
import { AuthGuard } from '../../common/guards/auth.guard'
import { TenantId, CurrentUserId, AccessToken } from '../../common/decorators/tenant.decorator'

// ─── Authenticated builder endpoints ─────────────────────────────────────────
@ApiTags('Website Builder')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard)
@Controller({ path: 'website-builder', version: '1' })
export class WebsiteBuilderController {
  constructor(private readonly service: WebsiteBuilderService) {}

  // ── Slug check ──────────────────────────────────────────────────────────────

  @Get('check-slug')
  @ApiOperation({ summary: 'Check if a slug is available' })
  checkSlug(@Query('slug') slug: string) {
    return this.service.checkSlug(slug)
  }

  // ── Per-event website ────────────────────────────────────────────────────────

  @Get('events/:eventId')
  @ApiOperation({ summary: 'Get event website with all sections' })
  getWebsite(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.getWebsite(eventId, tenantId, token)
  }

  @Post('events/:eventId')
  @ApiOperation({ summary: 'Create event website' })
  createWebsite(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() dto: CreateWebsiteDto,
    @TenantId() tenantId: string,
    @CurrentUserId() userId: string,
    @AccessToken() token: string,
  ) {
    return this.service.createWebsite(eventId, dto, tenantId, userId, token)
  }

  @Patch('websites/:id')
  @ApiOperation({ summary: 'Update event website settings' })
  updateWebsite(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Partial<CreateWebsiteDto>,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.updateWebsite(id, dto, tenantId, token)
  }

  @Delete('websites/:id')
  @ApiOperation({ summary: 'Delete event website' })
  deleteWebsite(
    @Param('id', ParseUUIDPipe) id: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.deleteWebsite(id, tenantId, token)
  }

  // ── Publish / Unpublish ──────────────────────────────────────────────────────

  @Post('websites/:id/publish')
  @ApiOperation({ summary: 'Publish the event website' })
  publish(
    @Param('id', ParseUUIDPipe) id: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.publishWebsite(id, tenantId, token)
  }

  @Post('websites/:id/unpublish')
  @ApiOperation({ summary: 'Unpublish the event website' })
  unpublish(
    @Param('id', ParseUUIDPipe) id: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.unpublishWebsite(id, tenantId, token)
  }

  // ── Sections ─────────────────────────────────────────────────────────────────

  @Post('websites/:websiteId/sections')
  @ApiOperation({ summary: 'Add a section to the website' })
  addSection(
    @Param('websiteId', ParseUUIDPipe) websiteId: string,
    @Body() dto: SectionDto,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.addSection(websiteId, dto, tenantId, token)
  }

  @Patch('sections/:id')
  @ApiOperation({ summary: 'Update section content or settings' })
  updateSection(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Partial<SectionDto>,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.updateSection(id, dto, tenantId, token)
  }

  @Delete('sections/:id')
  @ApiOperation({ summary: 'Delete a section' })
  deleteSection(
    @Param('id', ParseUUIDPipe) id: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.deleteSection(id, tenantId, token)
  }

  @Post('websites/:websiteId/sections/reorder')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reorder sections by providing ordered ID array' })
  reorderSections(
    @Param('websiteId', ParseUUIDPipe) websiteId: string,
    @Body('section_ids') sectionIds: string[],
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.reorderSections(websiteId, sectionIds, tenantId, token)
  }
}

// ─── Public rendering endpoints (no auth) ────────────────────────────────────
@ApiTags('Event Websites (Public)')
@Controller({ path: 'sites', version: '1' })
export class PublicWebsiteController {
  constructor(private readonly service: WebsiteBuilderService) {}

  @Get(':slug')
  @ApiOperation({ summary: 'Render a published event website by slug' })
  getBySlug(@Param('slug') slug: string) {
    return this.service.getPublishedWebsite(slug)
  }

  @Get('by-domain/:domain')
  @ApiOperation({ summary: 'Render a published event website by custom domain' })
  getByDomain(@Param('domain') domain: string) {
    return this.service.getPublishedWebsiteByDomain(decodeURIComponent(domain))
  }
}
