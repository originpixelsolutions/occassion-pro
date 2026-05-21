import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { DisbursementsService, CreateScheduleDto, CreateMilestoneDto, ApproveDto } from './disbursements.service'
import { AuthGuard } from '../../common/guards/auth.guard'
import { TenantId, CurrentUserId, AccessToken } from '../../common/decorators/tenant.decorator'

// ─── Authenticated endpoints ──────────────────────────────────────────────────
@ApiTags('Vendor Disbursements')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard)
@Controller({ path: 'disbursements', version: '1' })
export class DisbursementsController {
  constructor(private readonly service: DisbursementsService) {}

  // ── Payment schedules ────────────────────────────────────────────────────────

  @Get('events/:eventId/schedules')
  @ApiOperation({ summary: 'List all vendor payment schedules for an event' })
  getSchedules(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.getSchedules(eventId, tenantId, token)
  }

  @Post('events/:eventId/schedules')
  @ApiOperation({ summary: 'Create a vendor payment schedule with milestones' })
  createSchedule(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() dto: CreateScheduleDto,
    @TenantId() tenantId: string,
    @CurrentUserId() userId: string,
    @AccessToken() token: string,
  ) {
    return this.service.createSchedule(eventId, dto, tenantId, userId, token)
  }

  @Get('schedules/:scheduleId')
  @ApiOperation({ summary: 'Get a single payment schedule with all milestones' })
  getSchedule(
    @Param('scheduleId', ParseUUIDPipe) scheduleId: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.getSchedule(scheduleId, tenantId, token)
  }

  @Patch('schedules/:scheduleId')
  @ApiOperation({ summary: 'Update payment schedule notes/totals' })
  updateSchedule(
    @Param('scheduleId', ParseUUIDPipe) scheduleId: string,
    @Body() dto: Partial<CreateScheduleDto>,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.updateSchedule(scheduleId, dto, tenantId, token)
  }

  // ── Milestones ───────────────────────────────────────────────────────────────

  @Post('schedules/:scheduleId/milestones')
  @ApiOperation({ summary: 'Add a payment milestone to a schedule' })
  addMilestone(
    @Param('scheduleId', ParseUUIDPipe) scheduleId: string,
    @Body() dto: CreateMilestoneDto,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.addMilestone(scheduleId, dto, tenantId, token)
  }

  @Patch('milestones/:milestoneId')
  @ApiOperation({ summary: 'Update a pending milestone' })
  updateMilestone(
    @Param('milestoneId', ParseUUIDPipe) milestoneId: string,
    @Body() dto: Partial<CreateMilestoneDto>,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.updateMilestone(milestoneId, dto, tenantId, token)
  }

  // ── Approval workflow ────────────────────────────────────────────────────────

  @Post('milestones/:milestoneId/request-approval')
  @ApiOperation({ summary: 'Submit a milestone for approval by designated approvers' })
  requestApproval(
    @Param('milestoneId', ParseUUIDPipe) milestoneId: string,
    @Body('approver_ids') approverIds: string[],
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.requestApproval(milestoneId, approverIds, tenantId, token)
  }

  @Post('milestones/:milestoneId/decide')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve or reject a disbursement milestone (approver action)' })
  decideApproval(
    @Param('milestoneId', ParseUUIDPipe) milestoneId: string,
    @Body() dto: ApproveDto,
    @TenantId() tenantId: string,
    @CurrentUserId() userId: string,
    @AccessToken() token: string,
  ) {
    return this.service.decideApproval(milestoneId, dto, tenantId, userId, token)
  }

  // ── Payout dispatch ──────────────────────────────────────────────────────────

  @Post('milestones/:milestoneId/disburse')
  @ApiOperation({ summary: 'Initiate payout for an approved milestone via Razorpay' })
  disburse(
    @Param('milestoneId', ParseUUIDPipe) milestoneId: string,
    @Body() body: { bank_account_id: string; payment_mode?: string },
    @TenantId() tenantId: string,
    @CurrentUserId() userId: string,
    @AccessToken() token: string,
  ) {
    return this.service.initiateDisbursement(
      milestoneId,
      body.bank_account_id,
      body.payment_mode ?? 'bank_transfer',
      tenantId,
      userId,
      token,
    )
  }

  // ── Reconciliation ───────────────────────────────────────────────────────────

  @Get('events/:eventId/reconciliation')
  @ApiOperation({ summary: 'Get disbursement reconciliation vs budget actuals' })
  getReconciliation(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.getReconciliation(eventId, tenantId, token)
  }

  // ── Bank Accounts ────────────────────────────────────────────────────────────

  @Get('vendors/:vendorId/bank-accounts')
  @ApiOperation({ summary: 'List bank/UPI accounts for a vendor' })
  getBankAccounts(
    @Param('vendorId', ParseUUIDPipe) vendorId: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.getBankAccounts(vendorId, tenantId, token)
  }

  @Post('vendors/:vendorId/bank-accounts')
  @ApiOperation({ summary: 'Add a bank/UPI account for a vendor' })
  addBankAccount(
    @Param('vendorId', ParseUUIDPipe) vendorId: string,
    @Body() dto: any,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.service.addBankAccount(dto, vendorId, tenantId, token)
  }
}

// ─── Razorpay Webhook (no auth) ──────────────────────────────────────────────
@ApiTags('Disbursement Webhooks')
@Controller({ path: 'disbursements/webhook', version: '1' })
export class DisbursementWebhookController {
  constructor(private readonly service: DisbursementsService) {}

  @Post('razorpay')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Razorpay payout webhook (delivery receipt)' })
  razorpayWebhook(@Body() body: any) {
    return this.service.handleRazorpayWebhook(body)
  }
}
