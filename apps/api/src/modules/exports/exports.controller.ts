import {
  Controller, Post, Get, Param, Body, Query, Res, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common'
import type { Response } from 'express'
import { ExportsService, ExportType, ExportFormat } from './exports.service'
import { AuthGuard } from '../../common/guards/auth.guard'
import { TenantId } from '../../common/decorators/tenant-id.decorator'
import { CurrentUserId } from '../../common/decorators/current-user-id.decorator'

@Controller()
@UseGuards(AuthGuard)
export class ExportsController {
  constructor(private readonly exports: ExportsService) {}

  // ── Queue a new export job ────────────────────────────────────────────────────

  @Post('events/:eventId/exports')
  @HttpCode(HttpStatus.ACCEPTED)
  async queueExport(
    @Param('eventId') eventId: string,
    @TenantId() tenantId: string,
    @CurrentUserId() userId: string,
    @Body() body: { export_type: ExportType; format?: ExportFormat; options?: Record<string, any> },
  ) {
    const jobId = await this.exports.queueExport(
      tenantId,
      eventId,
      body.export_type,
      body.format ?? 'pdf',
      body.options ?? {},
      userId,
    )
    return { job_id: jobId, status: 'queued' }
  }

  // ── List recent export jobs for an event ──────────────────────────────────────

  @Get('events/:eventId/exports')
  async listEventExports(
    @Param('eventId') eventId: string,
    @TenantId() tenantId: string,
  ) {
    return this.exports.listExportJobs(tenantId, eventId)
  }

  // ── List all export jobs for a tenant ─────────────────────────────────────────

  @Get('tenants/:tenantId/exports')
  async listTenantExports(
    @Param('tenantId') tenantId: string,
  ) {
    return this.exports.listExportJobs(tenantId)
  }

  // ── Poll job status ───────────────────────────────────────────────────────────

  @Get('exports/:jobId/status')
  async getJobStatus(
    @Param('jobId') jobId: string,
    @TenantId() tenantId: string,
  ) {
    return this.exports.getJobStatus(jobId, tenantId)
  }

  // ── Download — redirect to file_url or stream on-demand ─────────────────────

  @Get('exports/:jobId/download')
  async download(
    @Param('jobId') jobId: string,
    @TenantId() tenantId: string,
    @Res() res: Response,
  ) {
    const job = await this.exports.getJobStatus(jobId, tenantId)
    if (job.status !== 'completed' || !job.file_url) {
      return res.status(HttpStatus.UNPROCESSABLE_ENTITY).json({ message: 'Export not ready' })
    }
    return res.redirect(HttpStatus.FOUND, job.file_url)
  }

  // ── Quick synchronous CSV exports (< 1000 rows) ───────────────────────────────

  @Get('events/:eventId/exports/quick/:type')
  async quickExport(
    @Param('eventId') eventId: string,
    @Param('type') type: string,
    @Res() res: Response,
  ) {
    const allowed = ['guest_list', 'attendance', 'vendor_report', 'payment_report'] as const
    if (!allowed.includes(type as any)) {
      return res.status(HttpStatus.BAD_REQUEST).json({ message: 'Unsupported quick export type' })
    }

    const { buffer, ext, contentType } = await this.exports.quickExport(
      eventId,
      type as any,
    )

    res.setHeader('Content-Type', contentType)
    res.setHeader('Content-Disposition', `attachment; filename="${type}_${eventId}.${ext}"`)
    res.setHeader('Content-Length', buffer.byteLength)
    return res.send(buffer)
  }

  // ── Brand settings ────────────────────────────────────────────────────────────

  @Get('tenants/:tenantId/brand-settings')
  async getBrandSettings(@Param('tenantId') tenantId: string) {
    return this.exports.getBrandSettings(tenantId)
  }

  @Post('tenants/:tenantId/brand-settings')
  async upsertBrandSettings(
    @Param('tenantId') tenantId: string,
    @Body() body: any,
  ) {
    return this.exports.upsertBrandSettings(tenantId, body)
  }
}
