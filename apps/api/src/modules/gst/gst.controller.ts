import {
  Controller, Get, Post, Patch, Delete, Body, Param,
  Query, Request, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { TenantGuard } from '../../common/guards/tenant.guard'
import { GstService,
  UpsertGstSettingsDto, CreateTaxRateDto, CreateTaxInvoiceDto,
  UpdateTaxInvoiceDto, CreateFilingDto, UpdateFilingDto,
} from './gst.service'

@Controller(':tenant/gst')
@UseGuards(JwtAuthGuard, TenantGuard)
export class GstController {
  constructor(private readonly gst: GstService) {}

  // ── Dashboard ──────────────────────────────────────────────────────────────

  @Get('dashboard')
  dashboard(
    @Request() req: any,
    @Query('event_id') eventId?: string,
    @Query('period') period?: string,
  ) {
    return this.gst.getDashboard(req.tenantId, eventId, period)
  }

  // ── Settings ───────────────────────────────────────────────────────────────

  @Get('settings')
  getSettings(@Request() req: any) {
    return this.gst.getSettings(req.tenantId)
  }

  @Patch('settings')
  upsertSettings(@Request() req: any, @Body() dto: UpsertGstSettingsDto) {
    return this.gst.upsertSettings(req.tenantId, dto)
  }

  // ── Tax Rates ──────────────────────────────────────────────────────────────

  @Get('rates')
  getTaxRates(@Request() req: any) {
    return this.gst.getTaxRates(req.tenantId)
  }

  @Post('rates')
  createTaxRate(@Request() req: any, @Body() dto: CreateTaxRateDto) {
    return this.gst.createTaxRate(req.tenantId, dto)
  }

  @Patch('rates/:rateId')
  updateTaxRate(
    @Request() req: any,
    @Param('rateId') rateId: string,
    @Body() dto: Partial<CreateTaxRateDto>,
  ) {
    return this.gst.updateTaxRate(req.tenantId, rateId, dto)
  }

  @Delete('rates/:rateId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteTaxRate(@Request() req: any, @Param('rateId') rateId: string) {
    return this.gst.deleteTaxRate(req.tenantId, rateId)
  }

  // ── Tax Invoices ───────────────────────────────────────────────────────────

  @Get('invoices')
  getInvoices(
    @Request() req: any,
    @Query('event_id') eventId?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.gst.getInvoices(
      req.tenantId, eventId, status,
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
    )
  }

  @Get('invoices/:invoiceId')
  getInvoice(@Request() req: any, @Param('invoiceId') invoiceId: string) {
    return this.gst.getInvoiceById(req.tenantId, invoiceId)
  }

  @Post('invoices')
  createInvoice(@Request() req: any, @Body() dto: CreateTaxInvoiceDto) {
    return this.gst.createInvoice(req.tenantId, req.user.id, dto)
  }

  @Patch('invoices/:invoiceId')
  updateInvoice(
    @Request() req: any,
    @Param('invoiceId') invoiceId: string,
    @Body() dto: UpdateTaxInvoiceDto,
  ) {
    return this.gst.updateInvoice(req.tenantId, invoiceId, dto)
  }

  @Post('invoices/:invoiceId/cancel')
  cancelInvoice(
    @Request() req: any,
    @Param('invoiceId') invoiceId: string,
    @Body() body: { reason: string },
  ) {
    return this.gst.cancelInvoice(req.tenantId, invoiceId, body.reason)
  }

  // ── GST Filings ────────────────────────────────────────────────────────────

  @Get('filings')
  getFilings(@Request() req: any, @Query('year') year?: string) {
    return this.gst.getFilings(req.tenantId, year)
  }

  @Post('filings')
  createFiling(@Request() req: any, @Body() dto: CreateFilingDto) {
    return this.gst.createFiling(req.tenantId, dto)
  }

  @Patch('filings/:filingId')
  updateFiling(
    @Request() req: any,
    @Param('filingId') filingId: string,
    @Body() dto: UpdateFilingDto,
  ) {
    return this.gst.updateFiling(req.tenantId, filingId, dto, req.user.id)
  }

  // ── ITC Ledger ─────────────────────────────────────────────────────────────

  @Get('itc')
  getItc(@Request() req: any, @Query('period') period?: string) {
    return this.gst.getItcLedger(req.tenantId, period)
  }

  // ── Reports ────────────────────────────────────────────────────────────────

  @Get('reports/gstr1')
  getGstr1(@Request() req: any, @Query('period') period: string) {
    return this.gst.getGstr1Data(req.tenantId, period)
  }

  @Get('reports/gstr3b')
  getGstr3b(@Request() req: any, @Query('period') period: string) {
    return this.gst.getGstr3bData(req.tenantId, period)
  }
}
