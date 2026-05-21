import {
  Controller, Get, Post, Patch, Delete,
  Param, Query, Body, Headers, UseGuards, HttpCode, HttpStatus
} from '@nestjs/common'
import { MediaService } from './media.service'
import { AuthGuard } from '../auth/auth.guard'

@Controller({ path: 'media', version: '1' })
@UseGuards(AuthGuard)
export class MediaController {
  constructor(private readonly svc: MediaService) {}

  // Stats
  @Get('events/:eventId/stats')
  getStats(@Param('eventId') eventId: string, @Headers('x-tenant-id') tid: string, @Headers('authorization') auth: string) {
    return this.svc.getStats(eventId, tid, auth?.replace('Bearer ', ''))
  }

  // Shot list
  @Get('events/:eventId/shots')
  listShots(@Param('eventId') eventId: string, @Headers('x-tenant-id') tid: string, @Headers('authorization') auth: string, @Query('category') category?: string) {
    return this.svc.listShotList(eventId, tid, auth?.replace('Bearer ', ''), category)
  }
  @Post('shots')
  createShot(@Headers('x-tenant-id') tid: string, @Headers('authorization') auth: string, @Body() body: any) {
    return this.svc.createShot(tid, auth?.replace('Bearer ', ''), body)
  }
  @Patch('shots/:id')
  updateShot(@Param('id') id: string, @Headers('x-tenant-id') tid: string, @Headers('authorization') auth: string, @Body() body: any) {
    return this.svc.updateShot(id, tid, auth?.replace('Bearer ', ''), body)
  }
  @Patch('shots/:id/toggle')
  toggleShot(@Param('id') id: string, @Headers('x-tenant-id') tid: string, @Headers('authorization') auth: string, @Body('completed') completed: boolean) {
    return this.svc.toggleShot(id, tid, auth?.replace('Bearer ', ''), completed)
  }
  @Delete('shots/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteShot(@Param('id') id: string, @Headers('x-tenant-id') tid: string, @Headers('authorization') auth: string) {
    return this.svc.deleteShot(id, tid, auth?.replace('Bearer ', ''))
  }

  // Deliverables
  @Get('events/:eventId/deliverables')
  listDeliverables(@Param('eventId') eventId: string, @Headers('x-tenant-id') tid: string, @Headers('authorization') auth: string, @Query('category') category?: string, @Query('status') status?: string) {
    return this.svc.listDeliverables(eventId, tid, auth?.replace('Bearer ', ''), { category, status })
  }
  @Post('deliverables')
  createDeliverable(@Headers('x-tenant-id') tid: string, @Headers('authorization') auth: string, @Body() body: any) {
    return this.svc.createDeliverable(tid, auth?.replace('Bearer ', ''), body)
  }
  @Patch('deliverables/:id')
  updateDeliverable(@Param('id') id: string, @Headers('x-tenant-id') tid: string, @Headers('authorization') auth: string, @Body() body: any) {
    return this.svc.updateDeliverable(id, tid, auth?.replace('Bearer ', ''), body)
  }
  @Patch('deliverables/:id/review')
  approveDeliverable(@Param('id') id: string, @Headers('x-tenant-id') tid: string, @Headers('authorization') auth: string, @Body() body: any) {
    return this.svc.approveDeliverable(id, tid, auth?.replace('Bearer ', ''), body)
  }
  @Delete('deliverables/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteDeliverable(@Param('id') id: string, @Headers('x-tenant-id') tid: string, @Headers('authorization') auth: string) {
    return this.svc.deleteDeliverable(id, tid, auth?.replace('Bearer ', ''))
  }
}
