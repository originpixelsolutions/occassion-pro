import { Controller, Get, Post, Put, Param, Body, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { ContractsService } from './contracts.service'
import { AuthGuard } from '../../../common/guards/auth.guard'
import { TenantId, CurrentUserId, AccessToken } from '../../../common/decorators/tenant.decorator'

@ApiTags('Vendor Contracts')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard)
@Controller({ path: 'vendors/:vendorId/contracts', version: '1' })
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  @Get()
  findByVendor(
    @Param('vendorId') vendorId: string,
    @TenantId() t: string,
    @AccessToken() token: string,
  ) {
    return this.contractsService.findByVendor(vendorId, t, token)
  }

  @Get(':id')
  findOne(@Param('id') id: string, @TenantId() t: string, @AccessToken() token: string) {
    return this.contractsService.findOne(id, t, token)
  }

  @Post()
  create(
    @Param('vendorId') vendorId: string,
    @Body() dto: any,
    @TenantId() t: string,
    @CurrentUserId() u: string,
    @AccessToken() token: string,
  ) {
    return this.contractsService.create(
      { ...dto, vendor_id: vendorId, tenant_id: t, created_by: u, status: 'draft' },
      token,
    )
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() dto: any,
    @TenantId() t: string,
    @AccessToken() token: string,
  ) {
    return this.contractsService.update(id, dto, t, token)
  }

  @Put(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() body: { status: 'draft' | 'sent' | 'signed' | 'cancelled'; signed_by?: string },
    @TenantId() t: string,
    @AccessToken() token: string,
  ) {
    return this.contractsService.updateStatus(id, body.status, t, token, {
      signed_by: body.signed_by,
    })
  }
}

@ApiTags('Vendor Contracts')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard)
@Controller({ path: 'events/:eventId/contracts', version: '1' })
export class EventContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  @Get()
  findByEvent(
    @Param('eventId') eventId: string,
    @TenantId() t: string,
    @AccessToken() token: string,
  ) {
    return this.contractsService.findByEvent(eventId, t, token)
  }
}
