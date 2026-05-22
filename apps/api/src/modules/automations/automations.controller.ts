import {
  Controller, Get, Post, Put, Delete, Patch, Body, Param,
  Query, Req, UseGuards, HttpCode, HttpStatus, BadRequestException,
} from '@nestjs/common'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { TenantGuard } from '../auth/guards/tenant.guard'
import { AutomationsService, CreateRuleDto } from './automations.service'

@Controller('automations')
@UseGuards(JwtAuthGuard, TenantGuard)
export class AutomationsController {
  constructor(private readonly svc: AutomationsService) {}

  // ── Rules ──────────────────────────────────────────────────────────────────

  @Get('rules')
  listRules(@Req() req: any, @Query('event_id') eventId?: string) {
    return this.svc.listRules(req.user.tenant_id, eventId)
  }

  @Get('rules/:id')
  getRule(@Req() req: any, @Param('id') id: string) {
    return this.svc.getRule(req.user.tenant_id, id)
  }

  @Post('rules')
  @HttpCode(HttpStatus.CREATED)
  createRule(@Req() req: any, @Body() dto: CreateRuleDto) {
    if (!dto.name?.trim()) throw new BadRequestException('name is required')
    if (!dto.trigger_type) throw new BadRequestException('trigger_type is required')
    if (!Array.isArray(dto.actions)) throw new BadRequestException('actions must be an array')
    return this.svc.createRule(req.user.tenant_id, req.user.sub, dto)
  }

  @Put('rules/:id')
  updateRule(@Req() req: any, @Param('id') id: string, @Body() dto: Partial<CreateRuleDto>) {
    return this.svc.updateRule(req.user.tenant_id, id, dto)
  }

  @Delete('rules/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteRule(@Req() req: any, @Param('id') id: string) {
    await this.svc.deleteRule(req.user.tenant_id, id)
  }

  @Patch('rules/:id/toggle')
  toggleRule(@Req() req: any, @Param('id') id: string) {
    return this.svc.toggleRule(req.user.tenant_id, id)
  }

  // ── Manual fire ────────────────────────────────────────────────────────────

  @Post('rules/:id/fire')
  @HttpCode(HttpStatus.OK)
  manualFire(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { context?: Record<string, unknown> },
  ) {
    return this.svc.manualFire(req.user.tenant_id, id, body.context ?? {})
  }

  // ── Execution history ──────────────────────────────────────────────────────

  @Get('rules/:id/executions')
  listExecutions(
    @Req() req: any,
    @Param('id') id: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.listExecutions(req.user.tenant_id, id, limit ? parseInt(limit) : 50)
  }

  // ── Analytics ──────────────────────────────────────────────────────────────

  @Get('analytics')
  getAnalytics(@Req() req: any, @Query('event_id') eventId?: string) {
    return this.svc.getAnalytics(req.user.tenant_id, eventId)
  }

  // ── Trigger catalogue (static reference) ──────────────────────────────────

  @Get('triggers')
  getTriggers() {
    return TRIGGER_CATALOGUE
  }

  @Get('action-types')
  getActionTypes() {
    return ACTION_TYPE_CATALOGUE
  }
}

// ── Static catalogues for UI consumption ──────────────────────────────────────

const TRIGGER_CATALOGUE = [
  {
    group: 'Guest',
    triggers: [
      { type: 'guest.rsvp_confirmed',  label: 'Guest confirms RSVP',     context_fields: ['guest.name', 'guest.phone', 'guest.email', 'guest.dietary'] },
      { type: 'guest.rsvp_declined',   label: 'Guest declines RSVP',     context_fields: ['guest.name', 'guest.phone', 'guest.email'] },
      { type: 'guest.rsvp_maybe',      label: 'Guest RSVP "Maybe"',      context_fields: ['guest.name', 'guest.phone'] },
      { type: 'guest.checked_in',      label: 'Guest checks in',         context_fields: ['guest.name', 'guest.phone', 'guest.table', 'checkin.time'] },
      { type: 'guest.added',           label: 'New guest added',         context_fields: ['guest.name', 'guest.phone', 'guest.email'] },
    ],
  },
  {
    group: 'Payment',
    triggers: [
      { type: 'payment.received',   label: 'Payment received',     context_fields: ['payment.amount', 'payment.method', 'payment.reference', 'payer.name'] },
      { type: 'payment.overdue',    label: 'Payment overdue',      context_fields: ['payment.amount', 'payment.due_date', 'payer.name'] },
      { type: 'payment.refunded',   label: 'Payment refunded',     context_fields: ['payment.amount', 'payment.reference'] },
    ],
  },
  {
    group: 'Task',
    triggers: [
      { type: 'task.completed', label: 'Task completed', context_fields: ['task.title', 'task.category', 'task.assignee'] },
      { type: 'task.overdue',   label: 'Task overdue',   context_fields: ['task.title', 'task.due_date', 'task.assignee'] },
      { type: 'task.created',   label: 'Task created',   context_fields: ['task.title', 'task.category'] },
      { type: 'task.assigned',  label: 'Task assigned',  context_fields: ['task.title', 'task.assignee'] },
    ],
  },
  {
    group: 'Vendor',
    triggers: [
      { type: 'vendor.confirmed',        label: 'Vendor confirmed',        context_fields: ['vendor.name', 'vendor.category', 'vendor.amount'] },
      { type: 'vendor.cancelled',        label: 'Vendor cancels',          context_fields: ['vendor.name', 'vendor.category'] },
      { type: 'vendor.invoice_uploaded', label: 'Vendor uploads invoice',  context_fields: ['vendor.name', 'vendor.invoice_amount'] },
    ],
  },
  {
    group: 'Budget',
    triggers: [
      { type: 'budget.category_overspent', label: 'Budget category overspent', context_fields: ['budget.category', 'budget.limit', 'budget.spent', 'budget.overage'] },
      { type: 'budget.total_threshold',    label: 'Total budget threshold hit', context_fields: ['budget.total', 'budget.spent_pct'] },
    ],
  },
  {
    group: 'Event Lifecycle',
    triggers: [
      { type: 'event.day_before',    label: '1 day before event',   context_fields: ['event.name', 'event.date', 'event.venue'] },
      { type: 'event.hours_before_6', label: '6 hours before event', context_fields: ['event.name', 'event.date', 'event.venue'] },
      { type: 'event.started',       label: 'Event starts',         context_fields: ['event.name', 'event.date'] },
      { type: 'event.completed',     label: 'Event completes',      context_fields: ['event.name', 'event.date', 'event.guest_count'] },
    ],
  },
  {
    group: 'WhatsApp',
    triggers: [
      { type: 'whatsapp.reply_received', label: 'WhatsApp reply received', context_fields: ['message.from', 'message.body', 'message.phone'] },
      { type: 'whatsapp.opt_out',        label: 'Guest opts out',           context_fields: ['phone', 'source'] },
    ],
  },
  {
    group: 'Manual',
    triggers: [
      { type: 'manual.trigger', label: 'Manual trigger (button press)', context_fields: [] },
    ],
  },
]

const ACTION_TYPE_CATALOGUE = [
  {
    type: 'webhook.http',
    label: 'HTTP Webhook',
    description: 'POST to any external URL (Slack, Zapier, custom API)',
    fields: ['url', 'method', 'headers', 'body_template', 'timeout_ms', 'retry_count'],
  },
  {
    type: 'email.send',
    label: 'Send Email',
    description: 'Send an email using your configured email provider',
    fields: ['to_template', 'subject_template', 'body_template_html'],
  },
  {
    type: 'whatsapp.send',
    label: 'Send WhatsApp',
    description: 'Send a WhatsApp message to a number from context',
    fields: ['to_field', 'message_template'],
  },
  {
    type: 'sms.send',
    label: 'Send SMS',
    description: 'Send an SMS via your SMS provider',
    fields: ['to_field', 'message_template'],
  },
  {
    type: 'task.create',
    label: 'Create Task',
    description: 'Create a task on the event automatically',
    fields: ['title_template', 'description_template', 'category', 'due_days_offset'],
  },
  {
    type: 'notification.internal',
    label: 'Internal Notification',
    description: 'Push a notification to the platform inbox',
    fields: ['title', 'message_template_text'],
  },
  {
    type: 'field.update',
    label: 'Update Field',
    description: 'Update a field on a guest, vendor, or other entity',
    fields: ['entity', 'entity_id_field', 'field', 'value_template'],
  },
  {
    type: 'delay.wait',
    label: 'Wait / Delay',
    description: 'Pause execution for N seconds before the next action',
    fields: ['seconds'],
  },
  {
    type: 'condition.branch',
    label: 'If / Else Condition',
    description: 'Skip subsequent actions if a condition is not met',
    fields: ['condition_field', 'operator', 'condition_value', 'skip_actions_on_false'],
  },
]
