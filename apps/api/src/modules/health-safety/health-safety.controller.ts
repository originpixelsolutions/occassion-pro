import {
  Controller, Get, Post, Patch, Delete, Body, Param, Req, HttpCode, UseGuards,
} from '@nestjs/common'
import { JwtAuthGuard } from '../../guards/jwt-auth.guard'
import { RolesGuard, Roles } from '../../guards/roles.guard'
import {
  HealthSafetyService, UpsertPlanDto, CreateRiskDto, CreateIncidentDto, CreateChecklistDto,
} from './health-safety.service'

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class HealthSafetyController {
  constructor(private readonly svc: HealthSafetyService) {}

  // ── PLAN ──────────────────────────────────────────────────────────────────

  /** GET /events/:eventId/health-safety — get or init plan + summary */
  @Get('events/:eventId/health-safety')
  async getSummary(@Param('eventId') eventId: string, @Req() req: any) {
    const { tenantId, id: userId } = req.user
    await this.svc.getOrCreatePlan(eventId, tenantId, userId)
    return this.svc.getPlanSummary(eventId, tenantId)
  }

  /** PATCH /events/:eventId/health-safety/plan */
  @Patch('events/:eventId/health-safety/plan')
  @Roles('event_manager', 'workspace_owner')
  updatePlan(@Param('eventId') eventId: string, @Req() req: any, @Body() dto: UpsertPlanDto) {
    return this.svc.updatePlan(eventId, req.user.tenantId, dto)
  }

  /** POST /events/:eventId/health-safety/plan/approve */
  @Post('events/:eventId/health-safety/plan/approve')
  @Roles('event_manager', 'workspace_owner')
  approvePlan(@Param('eventId') eventId: string, @Req() req: any) {
    return this.svc.approvePlan(eventId, req.user.tenantId, req.user.id)
  }

  // ── RISKS ─────────────────────────────────────────────────────────────────

  /** GET /events/:eventId/health-safety/risks */
  @Get('events/:eventId/health-safety/risks')
  listRisks(@Param('eventId') eventId: string, @Req() req: any) {
    return this.svc.listRisks(eventId, req.user.tenantId)
  }

  /** POST /events/:eventId/health-safety/risks */
  @Post('events/:eventId/health-safety/risks')
  @Roles('event_manager', 'workspace_owner', 'team_lead')
  createRisk(@Param('eventId') eventId: string, @Req() req: any, @Body() dto: CreateRiskDto) {
    return this.svc.createRisk(eventId, req.user.tenantId, req.user.id, dto)
  }

  /** PATCH /health-safety/risks/:id */
  @Patch('health-safety/risks/:id')
  @Roles('event_manager', 'workspace_owner', 'team_lead')
  updateRisk(@Param('id') id: string, @Req() req: any, @Body() dto: Partial<CreateRiskDto>) {
    return this.svc.updateRisk(id, req.user.tenantId, dto)
  }

  /** DELETE /health-safety/risks/:id */
  @Delete('health-safety/risks/:id')
  @HttpCode(204)
  @Roles('event_manager', 'workspace_owner')
  deleteRisk(@Param('id') id: string, @Req() req: any) {
    return this.svc.deleteRisk(id, req.user.tenantId)
  }

  // ── INCIDENTS ─────────────────────────────────────────────────────────────

  /** GET /events/:eventId/health-safety/incidents */
  @Get('events/:eventId/health-safety/incidents')
  listIncidents(@Param('eventId') eventId: string, @Req() req: any) {
    return this.svc.listIncidents(eventId, req.user.tenantId)
  }

  /** POST /events/:eventId/health-safety/incidents */
  @Post('events/:eventId/health-safety/incidents')
  createIncident(@Param('eventId') eventId: string, @Req() req: any, @Body() dto: CreateIncidentDto) {
    return this.svc.createIncident(eventId, req.user.tenantId, req.user.id, dto)
  }

  /** PATCH /health-safety/incidents/:id */
  @Patch('health-safety/incidents/:id')
  updateIncident(@Param('id') id: string, @Req() req: any, @Body() dto: any) {
    return this.svc.updateIncident(id, req.user.tenantId, dto)
  }

  // ── CHECKLISTS ────────────────────────────────────────────────────────────

  /** GET /events/:eventId/health-safety/checklists */
  @Get('events/:eventId/health-safety/checklists')
  listChecklists(@Param('eventId') eventId: string, @Req() req: any) {
    return this.svc.listChecklists(eventId, req.user.tenantId)
  }

  /** POST /events/:eventId/health-safety/checklists */
  @Post('events/:eventId/health-safety/checklists')
  @Roles('event_manager', 'workspace_owner', 'team_lead')
  createChecklist(@Param('eventId') eventId: string, @Req() req: any, @Body() dto: CreateChecklistDto) {
    return this.svc.createChecklist(eventId, req.user.tenantId, dto)
  }

  /** POST /health-safety/checklists/:checklistId/items */
  @Post('health-safety/checklists/:checklistId/items')
  addItem(@Param('checklistId') checklistId: string, @Req() req: any, @Body() body: { text: string }) {
    return this.svc.addChecklistItem(checklistId, req.user.tenantId, body.text)
  }

  /** PATCH /health-safety/checklist-items/:itemId/toggle */
  @Patch('health-safety/checklist-items/:itemId/toggle')
  toggleItem(@Param('itemId') itemId: string, @Req() req: any, @Body() body: { checked_by?: string }) {
    return this.svc.toggleChecklistItem(itemId, req.user.tenantId, body.checked_by)
  }

  // ── CROWD DENSITY ─────────────────────────────────────────────────────────

  /** GET /events/:eventId/health-safety/crowd-density */
  @Get('events/:eventId/health-safety/crowd-density')
  getCrowdDensity(@Param('eventId') eventId: string, @Req() req: any) {
    return this.svc.getCrowdDensity(eventId, req.user.tenantId)
  }
}
