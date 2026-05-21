import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, Headers, UseGuards, HttpCode
} from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { InvoicesService } from './invoices.service'
import { AuthGuard } from '../../../common/guards/auth.guard'
import { TenantId, CurrentUserId, AccessToken } from '../../../common/decorators/tenant.decorator'

@ApiTags('Finance')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard)
@Controller({ path: 'finance/invoices', version: '1' })
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get()
  @ApiOperation({ summary: 'List invoices' })
  findAll(
    @TenantId() tenantId: string,
    @AccessToken() token: string,
    @Query('page') page?: number,
    @Query('status') status?: string,
  ) {
    return this.invoicesService.findAll(tenantId, token, { page, status })
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get invoice by ID' })
  findOne(@Param('id') id: string, @AccessToken() token: string) {
    return this.invoicesService.findOne(id, token)
  }

  @Post()
  @ApiOperation({ summary: 'Create invoice' })
  create(
    @Body() dto: any,
    @TenantId() tenantId: string,
    @CurrentUserId() userId: string,
    @AccessToken() token: string,
  ) {
    return this.invoicesService.create({ ...dto, tenant_id: tenantId, created_by: userId }, token)
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update invoice' })
  update(@Param('id') id: string, @Body() dto: any, @AccessToken() token: string) {
    return this.invoicesService.update(id, dto, token)
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete invoice' })
  remove(@Param('id') id: string, @AccessToken() token: string) {
    return this.invoicesService.remove(id, token)
  }

  @Post(':id/send-payment-link')
  @ApiOperation({ summary: 'Generate and send Razorpay payment link' })
  sendPaymentLink(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.invoicesService.sendPaymentLink(id, tenantId, token)
  }
}
