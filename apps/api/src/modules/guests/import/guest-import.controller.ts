import {
  Controller, Get, Post, Param, Body, UseGuards, Res, HttpCode, HttpStatus,
} from '@nestjs/common'
import type { Response } from 'express'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { GuestImportService } from './guest-import.service'
import { AuthGuard } from '../../../common/guards/auth.guard'
import { TenantId, AccessToken, CurrentUserId } from '../../../common/decorators/tenant.decorator'

@ApiTags('Guest Import')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard)
@Controller({ path: 'events/:eventId/guests/import', version: '1' })
export class GuestImportController {
  constructor(private readonly svc: GuestImportService) {}

  @Post('preview')
  @HttpCode(HttpStatus.OK)
  preview(
    @Body() body: { headers: string[]; rows: Record<string, string>[] },
  ) {
    return this.svc.previewImport(body.headers, body.rows)
  }

  @Post('execute')
  execute(
    @Param('eventId') eventId: string,
    @Body() body: {
      filename: string
      headers: string[]
      rows: Record<string, string>[]
      columnMapping: Record<string, string>
    },
    @TenantId() t: string,
    @CurrentUserId() uid: string,
    @AccessToken() token: string,
  ) {
    return this.svc.executeImport(
      eventId, t, body.filename, body.headers, body.rows, body.columnMapping, uid, token,
    )
  }

  @Get('batches')
  listBatches(
    @Param('eventId') eventId: string,
    @TenantId() t: string,
    @AccessToken() token: string,
  ) {
    return this.svc.listBatches(eventId, t, token)
  }

  @Get('template')
  downloadTemplate(@Res() res: Response) {
    const csv = this.svc.generateTemplate()
    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', 'attachment; filename="guest_import_template.csv"')
    res.send(csv)
  }
}
