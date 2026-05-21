import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { PaymentsService } from './payments.service'
import { AuthGuard } from '../../../common/guards/auth.guard'
import { TenantId, CurrentUserId, AccessToken } from '../../../common/decorators/tenant.decorator'

@ApiTags('Finance')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard)
@Controller({ path: 'payments', version: '1' })
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}
  @Get()
  findAll(@TenantId() tenantId: string, @AccessToken() token: string) { return this.paymentsService.findAll(tenantId, token) }
  @Post()
  record(@Body() dto: any, @TenantId() tenantId: string, @CurrentUserId() userId: string, @AccessToken() token: string) {
    return this.paymentsService.record({ ...dto, tenant_id: tenantId, recorded_by: userId }, token)
  }
}
