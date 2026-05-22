import { Controller, Get, Post, Patch, Delete, Param, Query, Body, Headers, UseGuards, HttpCode, HttpStatus } from '@nestjs/common'
import { DecorService } from './decor.service'
import { AuthGuard } from '../../common/guards/auth.guard'

@Controller({ path: 'decor', version: '1' })
@UseGuards(AuthGuard)
export class DecorController {
  constructor(private readonly svc: DecorService) {}

  @Get('events/:eventId/stats')
  stats(@Param('eventId') eid: string, @Headers('x-tenant-id') tid: string, @Headers('authorization') auth: string) { return this.svc.getStats(eid, tid, auth?.replace('Bearer ','')) }

  @Get('events/:eventId/zones')
  listZones(@Param('eventId') eid: string, @Headers('x-tenant-id') tid: string, @Headers('authorization') auth: string) { return this.svc.listZones(eid, tid, auth?.replace('Bearer ','')) }
  @Post('zones')
  createZone(@Headers('x-tenant-id') tid: string, @Headers('authorization') auth: string, @Body() body: any) { return this.svc.createZone(tid, auth?.replace('Bearer ',''), body) }
  @Patch('zones/:id')
  updateZone(@Param('id') id: string, @Headers('x-tenant-id') tid: string, @Headers('authorization') auth: string, @Body() body: any) { return this.svc.updateZone(id, tid, auth?.replace('Bearer ',''), body) }
  @Delete('zones/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteZone(@Param('id') id: string, @Headers('x-tenant-id') tid: string, @Headers('authorization') auth: string) { return this.svc.deleteZone(id, tid, auth?.replace('Bearer ','')) }

  @Get('events/:eventId/items')
  listItems(@Param('eventId') eid: string, @Headers('x-tenant-id') tid: string, @Headers('authorization') auth: string, @Query('zone_id') zoneId?: string, @Query('category') cat?: string, @Query('status') status?: string) { return this.svc.listItems(eid, tid, auth?.replace('Bearer ',''), { zone_id: zoneId, category: cat, status }) }
  @Post('items')
  createItem(@Headers('x-tenant-id') tid: string, @Headers('authorization') auth: string, @Body() body: any) { return this.svc.createItem(tid, auth?.replace('Bearer ',''), body) }
  @Patch('items/:id')
  updateItem(@Param('id') id: string, @Headers('x-tenant-id') tid: string, @Headers('authorization') auth: string, @Body() body: any) { return this.svc.updateItem(id, tid, auth?.replace('Bearer ',''), body) }
  @Delete('items/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteItem(@Param('id') id: string, @Headers('x-tenant-id') tid: string, @Headers('authorization') auth: string) { return this.svc.deleteItem(id, tid, auth?.replace('Bearer ','')) }
}
