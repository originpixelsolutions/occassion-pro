import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, Req, UseGuards,
  HttpCode, HttpStatus,
} from '@nestjs/common'
import { GiftsService } from './gifts.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'

@Controller('events/:eventId/gifts')
@UseGuards(JwtAuthGuard)
export class GiftsController {
  constructor(private readonly svc: GiftsService) {}

  // Registry
  @Get('registry')
  getRegistry(@Req() req: any, @Param('eventId') eventId: string) {
    return this.svc.getOrCreateRegistry(eventId, req.user.tenantId)
  }

  @Patch('registry')
  updateRegistry(@Req() req: any, @Param('eventId') eventId: string, @Body() dto: any) {
    return this.svc.updateRegistry(eventId, req.user.tenantId, dto)
  }

  // Registry items
  @Get('items')
  listItems(@Req() req: any, @Param('eventId') eventId: string) {
    return this.svc.listItems(eventId, req.user.tenantId)
  }

  @Post('items')
  addItem(@Req() req: any, @Param('eventId') eventId: string, @Body() dto: any) {
    return this.svc.addItem(eventId, req.user.tenantId, dto)
  }

  @Patch('items/:itemId')
  updateItem(@Req() req: any, @Param('itemId') itemId: string, @Body() dto: any) {
    return this.svc.updateItem(req.user.tenantId, itemId, dto)
  }

  @Delete('items/:itemId')
  @HttpCode(HttpStatus.OK)
  deleteItem(@Req() req: any, @Param('itemId') itemId: string) {
    return this.svc.deleteItem(req.user.tenantId, itemId)
  }

  // Gifts received
  @Get()
  listReceived(@Req() req: any, @Param('eventId') eventId: string, @Query() q: any) {
    return this.svc.listReceived(eventId, req.user.tenantId, q)
  }

  @Post()
  logGift(@Req() req: any, @Param('eventId') eventId: string, @Body() dto: any) {
    return this.svc.logGift(eventId, req.user.tenantId, req.user.id, dto)
  }

  @Patch(':giftId')
  updateGift(@Req() req: any, @Param('giftId') giftId: string, @Body() dto: any) {
    return this.svc.updateGift(req.user.tenantId, giftId, dto)
  }

  @Delete(':giftId')
  @HttpCode(HttpStatus.OK)
  deleteGift(@Req() req: any, @Param('giftId') giftId: string) {
    return this.svc.deleteGift(req.user.tenantId, giftId)
  }

  @Post('thank-you/mark-sent')
  markThankYou(@Req() req: any, @Body() body: { gift_ids: string[]; channel: string }) {
    return this.svc.markThankYou(req.user.tenantId, body.gift_ids, body.channel)
  }

  @Get('summary')
  getSummary(@Req() req: any, @Param('eventId') eventId: string) {
    return this.svc.getSummary(eventId, req.user.tenantId)
  }

  @Get('templates')
  getTemplates(@Req() req: any, @Param('eventId') eventId: string) {
    return this.svc.getTemplates(req.user.tenantId, eventId)
  }
}
