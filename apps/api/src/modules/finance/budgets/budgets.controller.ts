import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { BudgetsService } from './budgets.service'
import { AuthGuard } from '../../../common/guards/auth.guard'
import { TenantId, CurrentUserId, AccessToken } from '../../../common/decorators/tenant.decorator'

@ApiTags('Finance')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard)
@Controller({ path: 'events/:eventId/budget', version: '1' })
export class BudgetsController {
  constructor(private readonly budgetsService: BudgetsService) {}
  @Get()
  findByEvent(@Param('eventId') eventId: string, @TenantId() tenantId: string, @AccessToken() token: string) {
    return this.budgetsService.findByEvent(eventId, tenantId, token)
  }
  @Post('line-items')
  upsertLineItem(@Body() dto: any, @Param('eventId') eventId: string, @TenantId() tenantId: string, @CurrentUserId() userId: string, @AccessToken() token: string) {
    return this.budgetsService.upsertLineItem({ ...dto, event_id: eventId, tenant_id: tenantId, created_by: userId }, token)
  }
}
