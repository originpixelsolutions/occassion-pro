import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger'
import { FastifyReply } from 'fastify'
import { BadgesService, BadgeTemplate } from './badges.service'
import { AuthGuard } from '../../../common/guards/auth.guard'
import { TenantId, CurrentUserId, AccessToken } from '../../../common/decorators/tenant.decorator'

@ApiTags('Guests')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard)
@Controller({ path: 'events/:eventId/badges', version: '1' })
export class BadgesController {
  constructor(private readonly badgesService: BadgesService) {}

  // ─── Badge Templates ────────────────────────────────────────────────────────

  @Get('templates')
  @ApiOperation({ summary: 'Get badge templates for event' })
  getTemplates(
    @Param('eventId') eventId: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.badgesService.getTemplates(eventId, tenantId, token)
  }

  // ─── Badge Config (template designer) ───────────────────────────────────────

  @Get('config')
  @ApiOperation({ summary: 'Get badge template config for event' })
  getConfig(
    @Param('eventId') eventId: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.badgesService.getBadgeConfig(eventId, tenantId, token)
  }

  @Put('config')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Save badge template config for event' })
  saveConfig(
    @Param('eventId') eventId: string,
    @Body() config: BadgeTemplate,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.badgesService.saveBadgeConfig(eventId, tenantId, config, token)
  }

  // ─── PDF Export ──────────────────────────────────────────────────────────────

  @Get('export')
  @ApiOperation({ summary: 'Export badges as PDF' })
  @ApiQuery({ name: 'guestIds', required: false, isArray: true, type: String })
  async exportPdf(
    @Param('eventId') eventId: string,
    @Query('guestIds') guestIds: string | string[] | undefined,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
    @Res() res: FastifyReply,
  ) {
    // Query param can arrive as a single string or array of strings
    const ids: string[] | undefined =
      guestIds === undefined
        ? undefined
        : Array.isArray(guestIds)
          ? guestIds
          : guestIds.split(',').filter(Boolean)

    const buffer = await this.badgesService.generateBadgesPdf(eventId, tenantId, token, ids)

    res
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `attachment; filename="badges-${eventId}.pdf"`)
      .header('Content-Length', buffer.byteLength.toString())
      .send(Buffer.from(buffer))
  }

  // ─── Print Queue ─────────────────────────────────────────────────────────────

  @Get('print-queue')
  @ApiOperation({ summary: 'Get badge print queue' })
  getPrintQueue(
    @Param('eventId') eventId: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.badgesService.getPrintQueue(eventId, tenantId, token)
  }

  @Post('print')
  @ApiOperation({ summary: 'Queue a badge for printing' })
  queuePrint(
    @Param('eventId') eventId: string,
    @Body('guestId') guestId: string,
    @Body('zoneId') zoneId: string | undefined,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.badgesService.queueBadgePrint(guestId, eventId, tenantId, zoneId, 'manual', token)
  }

  @Patch('print-queue/:queueId/status')
  @ApiOperation({ summary: 'Update badge print status (printed/failed)' })
  updateStatus(
    @Param('queueId') queueId: string,
    @Body('status') status: string,
    @Body('printerId') printerId: string | undefined,
    @AccessToken() token: string,
  ) {
    return this.badgesService.updatePrintStatus(queueId, status, printerId, token)
  }

  // ─── QR Code ──────────────────────────────────────────────────────────────────

  @Get('qr/:guestId')
  @ApiOperation({ summary: 'Generate QR code data URL for a guest' })
  generateQr(
    @Param('guestId') guestId: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.badgesService.generateQrCode(guestId, tenantId, token)
  }
}
