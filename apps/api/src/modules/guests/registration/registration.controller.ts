import {
  Controller, Get, Patch, Post, Param, Body, Query,
  Headers, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common'
import { RegistrationService } from './registration.service'
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard'
import { TenantGuard } from '../../../common/guards/tenant.guard'

// ─── Admin: Registration Config + Guest List ─────────────────────────────────

@Controller('events/:eventId/registration')
@UseGuards(JwtAuthGuard, TenantGuard)
export class RegistrationController {
  constructor(private readonly svc: RegistrationService) {}

  @Get()
  getConfig(
    @Param('eventId') eventId: string,
    @Headers('x-tenant-id') tenantId: string,
    @Headers('authorization') auth: string,
  ) {
    const token = auth?.replace('Bearer ', '')
    return this.svc.getOrCreateConfig(eventId, tenantId, token)
  }

  @Patch()
  updateConfig(
    @Param('eventId') eventId: string,
    @Headers('x-tenant-id') tenantId: string,
    @Headers('authorization') auth: string,
    @Body() dto: any,
  ) {
    const token = auth?.replace('Bearer ', '')
    return this.svc.updateConfig(eventId, tenantId, dto, token)
  }

  @Get('guests')
  listRegistrations(
    @Param('eventId') eventId: string,
    @Headers('x-tenant-id') tenantId: string,
    @Headers('authorization') auth: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('approvalStatus') approvalStatus?: string,
  ) {
    const token = auth?.replace('Bearer ', '')
    return this.svc.listRegistrations(eventId, tenantId, token, {
      page: page ? parseInt(page) : 1,
      pageSize: pageSize ? parseInt(pageSize) : 50,
      approvalStatus,
    })
  }

  @Post('guests/:guestId/approve')
  @HttpCode(HttpStatus.OK)
  approveRegistration(
    @Param('guestId') guestId: string,
    @Headers('x-tenant-id') tenantId: string,
    @Headers('authorization') auth: string,
  ) {
    const token = auth?.replace('Bearer ', '')
    return this.svc.approveRegistration(guestId, tenantId, token)
  }

  @Post('guests/:guestId/reject')
  @HttpCode(HttpStatus.OK)
  rejectRegistration(
    @Param('guestId') guestId: string,
    @Headers('x-tenant-id') tenantId: string,
    @Headers('authorization') auth: string,
  ) {
    const token = auth?.replace('Bearer ', '')
    return this.svc.rejectRegistration(guestId, tenantId, token)
  }
}

// ─── Public: Self-Registration Page ──────────────────────────────────────────

@Controller('public/register')
export class PublicRegistrationController {
  constructor(private readonly svc: RegistrationService) {}

  @Get(':slug')
  getPublicConfig(@Param('slug') slug: string) {
    return this.svc.getPublicConfig(slug)
  }

  @Post(':slug/submit')
  @HttpCode(HttpStatus.CREATED)
  submitRegistration(
    @Param('slug') slug: string,
    @Body() dto: any,
  ) {
    return this.svc.submitRegistration(slug, dto)
  }
}
