import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CrmService } from './crm.service';
import {
  CreateLeadDto,
  UpdateLeadDto,
  CreateActivityDto,
  CreateProposalDto,
  LeadQueryDto,
  ActivityType,
} from './dto/crm.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';

@Controller('crm')
@UseGuards(JwtAuthGuard, TenantGuard)
export class CrmController {
  constructor(private readonly crmService: CrmService) {}

  // ─── Leads ────────────────────────────────────────────────────────────────

  @Post('leads')
  @HttpCode(HttpStatus.CREATED)
  createLead(@Request() req: any, @Body() dto: CreateLeadDto) {
    return this.crmService.createLead(req.tenantId, dto, req.user.id);
  }

  @Get('leads')
  getLeads(@Request() req: any, @Query() query: LeadQueryDto) {
    return this.crmService.getLeads(req.tenantId, query);
  }

  @Get('leads/follow-ups/due')
  getDueFollowUps(@Request() req: any) {
    return this.crmService.getDueFollowUps(req.tenantId, req.user.id);
  }

  @Get('leads/stats/pipeline')
  getPipelineStats(@Request() req: any) {
    return this.crmService.getPipelineStats(req.tenantId);
  }

  @Get('leads/stats/funnel')
  getConversionFunnel(
    @Request() req: any,
    @Query('days') days?: string,
  ) {
    return this.crmService.getConversionFunnel(req.tenantId, days ? parseInt(days) : 30);
  }

  @Get('leads/:id')
  getLead(@Request() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.crmService.getLead(req.tenantId, id);
  }

  @Patch('leads/:id')
  updateLead(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLeadDto,
  ) {
    return this.crmService.updateLead(req.tenantId, id, dto, req.user.id);
  }

  @Post('leads/rescore')
  @Roles('super_admin', 'company_admin')
  @UseGuards(RolesGuard)
  rescoreLeads(@Request() req: any) {
    return this.crmService.rescoreLeads(req.tenantId);
  }

  // ─── Activities ───────────────────────────────────────────────────────────

  @Post('activities')
  @HttpCode(HttpStatus.CREATED)
  logActivity(@Request() req: any, @Body() dto: CreateActivityDto) {
    return this.crmService.logActivity(req.tenantId, dto, req.user.id);
  }

  @Get('leads/:id/activities')
  getActivities(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.crmService.getActivities(req.tenantId, id);
  }

  @Post('activities/follow-up')
  @HttpCode(HttpStatus.CREATED)
  scheduleFollowUp(
    @Request() req: any,
    @Body()
    dto: {
      lead_id: string;
      follow_up_date: string;
      type: ActivityType;
      subject: string;
      notes?: string;
    },
  ) {
    return this.crmService.scheduleFollowUp(req.tenantId, dto, req.user.id);
  }

  // ─── Proposals ────────────────────────────────────────────────────────────

  @Post('proposals')
  @HttpCode(HttpStatus.CREATED)
  createProposal(@Request() req: any, @Body() dto: CreateProposalDto) {
    return this.crmService.createProposal(req.tenantId, dto, req.user.id);
  }

  @Get('leads/:id/proposals')
  getProposals(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.crmService.getProposals(req.tenantId, id);
  }
}
