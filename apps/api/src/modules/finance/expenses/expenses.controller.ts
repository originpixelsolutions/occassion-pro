import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, UseGuards, HttpCode
} from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { ExpensesService } from './expenses.service'
import { AuthGuard } from '../../../common/guards/auth.guard'
import { TenantId, CurrentUserId, AccessToken } from '../../../common/decorators/tenant.decorator'

@ApiTags('Finance')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard)
@Controller({ path: 'finance/expenses', version: '1' })
export class ExpensesController {
  constructor(private readonly expenses: ExpensesService) {}

  @Get()
  @ApiOperation({ summary: 'List expenses' })
  findAll(
    @TenantId() tenantId: string,
    @AccessToken() token: string,
    @Query('category') category?: string,
    @Query('status') status?: string,
  ) {
    return this.expenses.findAll(tenantId, token, { category, status })
  }

  @Get(':id')
  findOne(@Param('id') id: string, @AccessToken() token: string) {
    return this.expenses.findOne(id, token)
  }

  @Post()
  create(
    @Body() dto: any,
    @TenantId() tenantId: string,
    @CurrentUserId() userId: string,
    @AccessToken() token: string,
  ) {
    return this.expenses.create({ ...dto, tenant_id: tenantId, created_by: userId }, token)
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: any, @AccessToken() token: string) {
    return this.expenses.update(id, dto, token)
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string, @AccessToken() token: string) {
    return this.expenses.remove(id, token)
  }
}
