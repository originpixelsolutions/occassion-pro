import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { ProposalsService } from './proposals.service'
import { AuthGuard } from '../../../common/guards/auth.guard'
import { TenantId, CurrentUserId, AccessToken } from '../../../common/decorators/tenant.decorator'

@ApiTags('CRM')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard)
@Controller({ path: 'proposals', version: '1' })
export class ProposalsController {
  constructor(private readonly proposalsService: ProposalsService) {}

  @Get()
  findAll(@TenantId() tenantId: string, @AccessToken() token: string) {
    return this.proposalsService.findAll(tenantId, token)
  }

  @Post()
  create(@Body() dto: any, @TenantId() tenantId: string, @CurrentUserId() userId: string, @AccessToken() token: string) {
    return this.proposalsService.create({ ...dto, tenant_id: tenantId, created_by: userId }, token)
  }
}
