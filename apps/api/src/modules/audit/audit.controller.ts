import {
  Controller, Get, Query, Param, Req, Res, UseGuards, HttpStatus,
} from '@nestjs/common'
import type { Response } from 'express'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { RolesGuard, Roles } from '../../common/guards/roles.guard'
import { AuditService, AuditQueryDto } from './audit.service'

@Controller('audit')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuditController {
  constructor(private readonly svc: AuditService) {}

  /** GET /audit — paginated log for the tenant */
  @Get()
  @Roles('event_manager', 'workspace_owner')
  query(@Req() req: any, @Query() q: AuditQueryDto) {
    return this.svc.query(req.user.tenantId, {
      ...q,
      limit: q.limit ? Number(q.limit) : 50,
      offset: q.offset ? Number(q.offset) : 0,
    })
  }

  /** GET /audit/stats — 30-day summary */
  @Get('stats')
  @Roles('event_manager', 'workspace_owner')
  stats(@Req() req: any, @Query('eventId') eventId?: string) {
    return this.svc.getStats(req.user.tenantId, eventId)
  }

  /** GET /audit/export.csv */
  @Get('export.csv')
  @Roles('event_manager', 'workspace_owner')
  async exportCsv(@Req() req: any, @Query() q: AuditQueryDto, @Res() res: Response) {
    const csv = await this.svc.exportCsv(req.user.tenantId, q)
    res
      .status(HttpStatus.OK)
      .setHeader('Content-Type', 'text/csv')
      .setHeader('Content-Disposition', `attachment; filename="audit-log-${Date.now()}.csv"`)
      .send(csv)
  }

  /** GET /audit/events/:eventId — scoped to one event */
  @Get('events/:eventId')
  @Roles('event_manager', 'workspace_owner', 'team_lead')
  queryByEvent(@Param('eventId') eventId: string, @Req() req: any, @Query() q: AuditQueryDto) {
    return this.svc.query(req.user.tenantId, {
      ...q,
      eventId,
      limit: q.limit ? Number(q.limit) : 50,
      offset: q.offset ? Number(q.offset) : 0,
    })
  }
}
