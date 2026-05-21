import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, HttpCode } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { LeadsService } from './leads.service'
import { AuthGuard } from '../../../common/guards/auth.guard'
import { TenantId, CurrentUserId, AccessToken } from '../../../common/decorators/tenant.decorator'

@ApiTags('CRM')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard)
@Controller({ path: 'crm/leads', version: '1' })
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Get('pipeline')
  @ApiOperation({ summary: 'Get pipeline stage statistics' })
  getPipeline(@TenantId() tenantId: string, @AccessToken() token: string) {
    return this.leadsService.getPipelineStats(tenantId, token)
  }

  @Get()
  findAll(
    @TenantId() tenantId: string,
    @AccessToken() token: string,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('stage') stage?: string,
    @Query('search') search?: string,
  ) {
    return this.leadsService.findAll(tenantId, token, { page, pageSize, stage, search })
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get lead details' })
  findOne(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.leadsService.findOne(id, tenantId, token)
  }

  @Post()
  create(
    @Body() dto: any,
    @TenantId() tenantId: string,
    @CurrentUserId() userId: string,
    @AccessToken() token: string,
  ) {
    return this.leadsService.create({ ...dto, tenant_id: tenantId, created_by: userId }, token)
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a lead' })
  update(
    @Param('id') id: string,
    @Body() dto: any,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.leadsService.update(id, tenantId, dto, token)
  }

  @Patch(':id/stage')
  @ApiOperation({ summary: 'Move lead to a new stage' })
  updateStage(
    @Param('id') id: string,
    @Body('stage') stage: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.leadsService.updateStage(id, tenantId, stage, token)
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a lead' })
  remove(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.leadsService.remove(id, tenantId, token)
  }

  @Post(':id/activities')
  @ApiOperation({ summary: 'Log a lead activity (call, email, meeting, note)' })
  addActivity(
    @Param('id') id: string,
    @Body() dto: any,
    @TenantId() tenantId: string,
    @CurrentUserId() userId: string,
    @AccessToken() token: string,
  ) {
    return this.leadsService.addActivity(id, tenantId, dto, userId, token)
  }
}
