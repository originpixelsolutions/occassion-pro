import {
  Controller, Get, Post, Delete, Body, Param, UseGuards, Req, HttpCode,
} from '@nestjs/common'
import { Request } from 'express'
import { PaymentService } from './payment.service'
import { AuthGuard } from '../auth/auth.guard'
import { WorkspaceRoleGuard } from '../../common/guards/workspace-role.guard'
import { RequireTenantRole } from '../../common/decorators/require-tenant-role.decorator'

/**
 * Payment Controller — Tenant Workspace Payment Settings & Actions
 *
 * Provider Config (Owner only):
 *   GET  /providers              — list all available providers (settings UI)
 *   GET  /config                 — get current tenant payment config (no secrets)
 *   POST /config                 — save/update provider credentials [Owner]
 *   POST /config/test            — test current provider connection [Owner]
 *   DELETE /config               — disconnect provider [Owner]
 *
 * Payment Link (event_manager+):
 *   POST /link                   — create & send payment link for an invoice
 *
 * Offline Payment (event_manager+):
 *   POST /offline                — record manual/offline payment for an invoice
 *
 * Payment History (any member):
 *   GET  /invoice/:invoiceId     — all payments for an invoice
 */
@Controller('payments')
@UseGuards(AuthGuard)
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  private tenantId(req: Request): string {
    return (req as Request & { tenantId: string }).tenantId
  }

  // ─── Provider List (read-only, any member) ─────────────────────────────────

  @Get('providers')
  getProviders() {
    return this.paymentService.getProvidersList()
  }

  @Get('config')
  getConfig(@Req() req: Request) {
    return this.paymentService.getConfig(this.tenantId(req))
  }

  // ─── Provider Config Management (Owner only) ──────────────────────────────

  @Post('config')
  @HttpCode(200)
  @UseGuards(WorkspaceRoleGuard)
  @RequireTenantRole('owner')
  saveConfig(@Req() req: Request, @Body() body: Record<string, unknown>) {
    return this.paymentService.saveConfig(this.tenantId(req), body)
  }

  @Post('config/test')
  @HttpCode(200)
  @UseGuards(WorkspaceRoleGuard)
  @RequireTenantRole('owner')
  testConnection(@Req() req: Request) {
    return this.paymentService.testConnection(this.tenantId(req))
  }

  @Delete('config')
  @HttpCode(204)
  @UseGuards(WorkspaceRoleGuard)
  @RequireTenantRole('owner')
  disconnectProvider(@Req() req: Request) {
    return this.paymentService.disconnectProvider(this.tenantId(req))
  }

  // ─── Payment Links (event_manager or above) ────────────────────────────────

  @Post('link')
  @HttpCode(200)
  @UseGuards(WorkspaceRoleGuard)
  @RequireTenantRole('event_manager')
  createPaymentLink(
    @Req() req: Request,
    @Body() body: {
      invoiceId: string
      amount: number
      currency: string
      description: string
      customerName?: string
      customerEmail?: string
      customerPhone?: string
      callbackUrl?: string
      expiryMinutes?: number
    },
  ) {
    return this.paymentService.createPaymentLink(this.tenantId(req), body)
  }

  // ─── Offline Payment (event_manager or above) ─────────────────────────────

  @Post('offline')
  @HttpCode(200)
  @UseGuards(WorkspaceRoleGuard)
  @RequireTenantRole('event_manager')
  recordOfflinePayment(
    @Req() req: Request,
    @Body() body: {
      invoiceId: string
      amount: number
      currency?: string
      method: 'cash' | 'cheque' | 'neft' | 'rtgs' | 'upi' | 'other'
      referenceNumber?: string
      paymentDate: string
      notes?: string
      receivedBy?: string
    },
  ) {
    return this.paymentService.recordOfflinePayment(this.tenantId(req), body)
  }

  // ─── Payment History (any member) ─────────────────────────────────────────

  @Get('invoice/:invoiceId')
  getInvoicePayments(@Req() req: Request, @Param('invoiceId') invoiceId: string) {
    return this.paymentService.getInvoicePayments(this.tenantId(req), invoiceId)
  }
}
