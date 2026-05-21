import {
  Controller, Get, Post, Patch, Param, Body, UseGuards, ParseUUIDPipe,
} from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { ProductionService } from './production.service'
import { AuthGuard } from '../../common/guards/auth.guard'
import { TenantId, AccessToken } from '../../common/decorators/tenant.decorator'

@ApiTags('Production & Logistics')
@Controller({ path: 'production', version: '1' })
@UseGuards(AuthGuard)
@ApiBearerAuth('access-token')
export class ProductionController {
  constructor(private readonly productionService: ProductionService) {}

  // ─── Dashboard ────────────────────────────────────────────────────────────────

  @Get('events/:eventId/dashboard')
  @ApiOperation({ summary: 'Full production & logistics dashboard for an event' })
  getDashboard(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.productionService.getProductionDashboard(eventId, tenantId, token)
  }

  @Get('events/:eventId/readiness')
  @ApiOperation({ summary: 'Production readiness report for an event' })
  getReadinessReport(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.productionService.getProductionReadinessReport(eventId, tenantId, token)
  }

  // ─── Production Setups ───────────────────────────────────────────────────────

  @Get('events/:eventId/setups')
  @ApiOperation({ summary: 'Get all production setups for an event' })
  getSetups(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.productionService.getSetups(eventId, tenantId, token)
  }

  @Post('events/:eventId/setups')
  @ApiOperation({ summary: 'Create or update a production setup' })
  upsertSetup(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() dto: {
      id?: string
      name: string
      category?: string
      description?: string
      location?: string
      status?: string
      setup_start?: string
      setup_end?: string
      teardown_start?: string
      teardown_end?: string
      responsible_id?: string
      vendor_id?: string
      notes?: string
      checklist?: any[]
    },
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.productionService.upsertSetup(eventId, dto, tenantId, token)
  }

  @Patch('setups/:id/status')
  @ApiOperation({ summary: 'Update production setup status' })
  updateSetupStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { status: string },
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.productionService.updateSetupStatus(id, dto.status, tenantId, token)
  }

  @Patch('setups/:id/checklist')
  @ApiOperation({ summary: 'Update setup checklist items' })
  updateChecklist(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { checklist: any[] },
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.productionService.updateSetupChecklist(id, dto.checklist, tenantId, token)
  }

  // ─── Equipment Inventory ─────────────────────────────────────────────────────

  @Get('equipment')
  @ApiOperation({ summary: 'Get equipment inventory for the tenant' })
  getInventory(
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.productionService.getEquipmentInventory(tenantId, token)
  }

  @Post('equipment')
  @ApiOperation({ summary: 'Create or update an equipment item' })
  upsertEquipment(
    @Body() dto: {
      id?: string
      name: string
      category?: string
      make?: string
      model?: string
      serial_number?: string
      quantity_owned?: number
      quantity_available?: number
      unit_cost?: number
      condition?: string
      notes?: string
    },
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.productionService.upsertEquipmentItem(dto, tenantId, token)
  }

  @Get('events/:eventId/equipment')
  @ApiOperation({ summary: 'Get equipment assignments for an event' })
  getEventEquipment(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.productionService.getEventEquipment(eventId, tenantId, token)
  }

  @Post('events/:eventId/equipment/assign')
  @ApiOperation({ summary: 'Assign equipment to an event' })
  assignEquipment(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() dto: {
      equipment_id: string
      setup_id?: string
      quantity?: number
      assigned_to?: string
      notes?: string
    },
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.productionService.assignEquipment(eventId, dto, tenantId, token)
  }

  @Patch('equipment/assignments/:id/status')
  @ApiOperation({ summary: 'Update equipment assignment status' })
  updateEquipmentStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { status: string },
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.productionService.updateEquipmentStatus(id, dto.status, tenantId, token)
  }

  // ─── Load Schedule ───────────────────────────────────────────────────────────

  @Get('events/:eventId/load-schedule')
  @ApiOperation({ summary: 'Get load schedule for an event' })
  getLoadSchedule(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.productionService.getLoadSchedule(eventId, tenantId, token)
  }

  @Post('events/:eventId/load-schedule')
  @ApiOperation({ summary: 'Add or update a load schedule item' })
  upsertLoadSchedule(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() dto: {
      id?: string
      type: string
      title: string
      description?: string
      scheduled_time: string
      duration_minutes?: number
      location?: string
      vendor_id?: string
      vehicle_info?: string
      contact_name?: string
      contact_phone?: string
      notes?: string
    },
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.productionService.upsertLoadScheduleItem(eventId, dto, tenantId, token)
  }

  @Patch('load-schedule/:id/status')
  @ApiOperation({ summary: 'Update load schedule item status' })
  updateLoadStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { status: string },
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.productionService.updateLoadStatus(id, dto.status, tenantId, token)
  }

  // ─── Supplier Coordination ───────────────────────────────────────────────────

  @Get('events/:eventId/suppliers')
  @ApiOperation({ summary: 'Get supplier coordination for an event' })
  getSuppliers(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.productionService.getSupplierCoordination(eventId, tenantId, token)
  }

  @Post('events/:eventId/suppliers')
  @ApiOperation({ summary: 'Upsert supplier coordination record' })
  upsertSupplier(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() dto: {
      vendor_id: string
      category?: string
      brief_sent?: boolean
      confirmed?: boolean
      advance_paid?: boolean
      advance_amount?: number
      balance_due?: number
      arrival_time?: string
      departure_time?: string
      contact_name?: string
      contact_phone?: string
      requirements?: string
      notes?: string
      status?: string
    },
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.productionService.upsertSupplierCoordination(eventId, dto, tenantId, token)
  }

  @Patch('suppliers/:id/brief')
  @ApiOperation({ summary: 'Mark supplier brief as sent' })
  markBriefSent(
    @Param('id', ParseUUIDPipe) id: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.productionService.markSupplierBriefSent(id, tenantId, token)
  }

  @Patch('suppliers/:id/confirm')
  @ApiOperation({ summary: 'Confirm a supplier' })
  confirmSupplier(
    @Param('id', ParseUUIDPipe) id: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.productionService.confirmSupplier(id, tenantId, token)
  }

  // ─── Checklist Templates ─────────────────────────────────────────────────────

  @Get('templates')
  @ApiOperation({ summary: 'Get production checklist templates' })
  getTemplates(
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.productionService.getChecklistTemplates(tenantId, token)
  }

  @Post('templates')
  @ApiOperation({ summary: 'Create a production checklist template' })
  createTemplate(
    @Body() dto: { name: string; category?: string; items: any[]; event_type?: string },
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.productionService.createChecklistTemplate(dto, tenantId, token)
  }
}
