import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, Version, ParseUUIDPipe,
} from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { PlaybooksService } from './playbooks.service'
import { AuthGuard } from '../../common/guards/auth.guard'
import { TenantId, AccessToken, CurrentUserId } from '../../common/decorators/tenant.decorator'

@ApiTags('Playbooks')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard)
@Controller({ path: 'playbooks', version: '1' })
export class PlaybooksController {
  constructor(private readonly svc: PlaybooksService) {}

  // ── Playbooks ─────────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'List all playbooks (system + tenant)' })
  list(
    @AccessToken() token: string,
    @Query('event_type') eventType?: string,
    @Query('category') category?: string,
    @Query('search') search?: string,
  ) {
    return this.svc.listPlaybooks(token, { eventType, category, search })
  }

  @Get('history')
  @ApiOperation({ summary: 'Get playbook application history' })
  history(
    @AccessToken() token: string,
    @Query('event_id') eventId?: string,
    @Query('playbook_id') playbookId?: string,
  ) {
    return this.svc.getApplicationHistory(token, { eventId, playbookId })
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get full playbook details with all sections' })
  getOne(@Param('id', ParseUUIDPipe) id: string, @AccessToken() token: string) {
    return this.svc.getPlaybook(id, token)
  }

  @Post()
  @ApiOperation({ summary: 'Create a new custom playbook' })
  create(@AccessToken() token: string, @Body() dto: any) {
    return this.svc.createPlaybook(token, dto)
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a playbook' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @AccessToken() token: string,
    @Body() dto: any,
  ) {
    return this.svc.updatePlaybook(id, token, dto)
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a custom playbook' })
  delete(@Param('id', ParseUUIDPipe) id: string, @AccessToken() token: string) {
    return this.svc.deletePlaybook(id, token)
  }

  // ── Apply ─────────────────────────────────────────────────────────────────

  @Post(':id/apply/:eventId')
  @ApiOperation({ summary: 'Apply a playbook to an event (creates tasks, budget items, etc.)' })
  apply(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @AccessToken() token: string,
    @Body() options: {
      applyTasks?: boolean
      applyBudget?: boolean
      applyVendors?: boolean
      applyChecklist?: boolean
      applyRunsheet?: boolean
      eventDate?: string
    },
  ) {
    return this.svc.applyToEvent(id, eventId, token, options)
  }

  // ── Create from event ─────────────────────────────────────────────────────

  @Post('create-from-event/:eventId')
  @ApiOperation({ summary: 'Create a new playbook from an existing event' })
  createFromEvent(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @AccessToken() token: string,
    @Body() dto: { name: string; description?: string },
  ) {
    return this.svc.createFromEvent(eventId, token, dto)
  }

  // ── Items ─────────────────────────────────────────────────────────────────

  @Post(':id/tasks')
  addTask(
    @Param('id', ParseUUIDPipe) id: string,
    @AccessToken() token: string,
    @Body() dto: any,
  ) {
    return this.svc.addTask(id, token, dto)
  }

  @Post(':id/budget-items')
  addBudgetItem(
    @Param('id', ParseUUIDPipe) id: string,
    @AccessToken() token: string,
    @Body() dto: any,
  ) {
    return this.svc.addBudgetItem(id, token, dto)
  }

  @Post(':id/vendor-requirements')
  addVendorRequirement(
    @Param('id', ParseUUIDPipe) id: string,
    @AccessToken() token: string,
    @Body() dto: any,
  ) {
    return this.svc.addVendorRequirement(id, token, dto)
  }

  @Post(':id/checklist-items')
  addChecklistItem(
    @Param('id', ParseUUIDPipe) id: string,
    @AccessToken() token: string,
    @Body() dto: any,
  ) {
    return this.svc.addChecklistItem(id, token, dto)
  }

  @Post(':id/runsheet-items')
  addRunsheetItem(
    @Param('id', ParseUUIDPipe) id: string,
    @AccessToken() token: string,
    @Body() dto: any,
  ) {
    return this.svc.addRunsheetItem(id, token, dto)
  }

  @Delete('items/:table/:itemId')
  @ApiOperation({ summary: 'Delete a single item from any playbook section' })
  deleteItem(
    @Param('table') table: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @AccessToken() token: string,
  ) {
    return this.svc.deleteItem(table, itemId, token)
  }
}
