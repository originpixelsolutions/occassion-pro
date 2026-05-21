import { Controller, Get, Post, Put, Patch, Delete, Param, Body, Query, UseGuards, HttpCode } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { MicrositesService } from './microsites.service'
import { TicketingService } from './ticketing/ticketing.service'
import { AuthGuard } from '../../common/guards/auth.guard'
import { Public } from '../../common/decorators/tenant.decorator'
import { TenantId, CurrentUserId, AccessToken } from '../../common/decorators/tenant.decorator'

@ApiTags('Microsites')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard)
@Controller({ path: 'events/:eventId/microsite', version: '1' })
export class MicrositesController {
  constructor(
    private readonly micrositesService: MicrositesService,
    private readonly ticketingService: TicketingService,
  ) {}

  @Get()
  findByEvent(
    @Param('eventId') eventId: string,
    @TenantId() t: string,
    @AccessToken() token: string,
  ) {
    return this.micrositesService.findByEvent(eventId, t, token)
  }

  @Post()
  upsert(
    @Param('eventId') eventId: string,
    @Body() dto: any,
    @TenantId() t: string,
    @CurrentUserId() u: string,
    @AccessToken() token: string,
  ) {
    return this.micrositesService.upsert(eventId, dto, t, u, token)
  }

  @Post('publish')
  publish(
    @Param('eventId') eventId: string,
    @TenantId() t: string,
    @AccessToken() token: string,
  ) {
    return this.micrositesService.publish(eventId, t, token)
  }

  @Post('unpublish')
  unpublish(
    @Param('eventId') eventId: string,
    @TenantId() t: string,
    @AccessToken() token: string,
  ) {
    return this.micrositesService.unpublish(eventId, t, token)
  }

  @Get('tickets')
  getEventTickets(
    @Param('eventId') eventId: string,
    @TenantId() t: string,
    @AccessToken() token: string,
  ) {
    return this.ticketingService.getEventTickets(eventId, t, token)
  }
}

// Public microsite API — no auth required
@ApiTags('Public Microsite')
@Controller({ path: 'public/microsites', version: '1' })
export class PublicMicrositesController {
  constructor(
    private readonly micrositesService: MicrositesService,
    private readonly ticketingService: TicketingService,
  ) {}

  @Public()
  @Get(':slug')
  findBySlug(@Param('slug') slug: string) {
    return this.micrositesService.findBySlug(slug)
  }

  @Public()
  @Post(':slug/register')
  initiateTicketPurchase(@Param('slug') slug: string, @Body() dto: any) {
    return this.ticketingService.initiateTicketPurchase(dto)
  }

  @Public()
  @Post('tickets/:ticketId/confirm')
  confirmPayment(
    @Param('ticketId') ticketId: string,
    @Body() body: { payment_id: string; signature: string },
  ) {
    return this.ticketingService.confirmTicketPayment(ticketId, body.payment_id, body.signature)
  }

  @Public()
  @Get('tickets/qr/:qrCode')
  getTicketByQr(@Param('qrCode') qrCode: string) {
    return this.ticketingService.getTicketByQr(qrCode)
  }
}


// ── Standalone /microsites controller (for the frontend management page) ────
@ApiTags('Microsites')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard)
@Controller({ path: 'microsites', version: '1' })
export class StandaloneMicrositesController {
  constructor(private readonly micrositesService: MicrositesService) {}

  @Get()
  findAll(@TenantId() t: string, @AccessToken() token: string) {
    return this.micrositesService.findAll(t, token)
  }

  @Post()
  create(
    @Body() dto: any,
    @TenantId() t: string,
    @CurrentUserId() u: string,
    @AccessToken() token: string,
  ) {
    return this.micrositesService.createStandalone(dto, t, u, token)
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: any,
    @TenantId() t: string,
    @AccessToken() token: string,
  ) {
    return this.micrositesService.updateStandalone(id, dto, t, token)
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string, @TenantId() t: string, @AccessToken() token: string) {
    return this.micrositesService.removeStandalone(id, t, token)
  }
}
