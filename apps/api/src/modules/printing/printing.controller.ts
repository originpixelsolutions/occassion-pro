import { Controller, Get, Post, Patch, Delete, Param, Query, Body, Headers, UseGuards, HttpCode, HttpStatus } from '@nestjs/common'
import { PrintingService } from './printing.service'
import { AuthGuard } from '../auth/auth.guard'

@Controller({ path: 'printing', version: '1' })
@UseGuards(AuthGuard)
export class PrintingController {
  constructor(private readonly svc: PrintingService) {}

  @Get('events/:eventId/stats')
  stats(@Param('eventId') eid: string, @Headers('x-tenant-id') tid: string, @Headers('authorization') auth: string) { return this.svc.getStats(eid, tid, auth?.replace('Bearer ','')) }

  @Get('events/:eventId/items')
  list(@Param('eventId') eid: string, @Headers('x-tenant-id') tid: string, @Headers('authorization') auth: string, @Query('type') type?: string, @Query('status') status?: string) { return this.svc.list(eid, tid, auth?.replace('Bearer ',''), { type, status }) }

  @Post('items')
  create(@Headers('x-tenant-id') tid: string, @Headers('authorization') auth: string, @Body() body: any) { return this.svc.create(tid, auth?.replace('Bearer ',''), body) }

  @Patch('items/:id')
  update(@Param('id') id: string, @Headers('x-tenant-id') tid: string, @Headers('authorization') auth: string, @Body() body: any) { return this.svc.update(id, tid, auth?.replace('Bearer ',''), body) }

  @Delete('items/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@Param('id') id: string, @Headers('x-tenant-id') tid: string, @Headers('authorization') auth: string) { return this.svc.delete(id, tid, auth?.replace('Bearer ','')) }
}
