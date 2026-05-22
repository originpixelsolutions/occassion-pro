import { Controller, Get, Query, Param, ParseUUIDPipe, UseGuards, Res, Header } from '@nestjs/common'
import type { Response } from 'express'
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger'
import { AnalyticsService } from './analytics.service'
import { AuthGuard } from '../../common/guards/auth.guard'
import { TenantId, AccessToken } from '../../common/decorators/tenant.decorator'

type Period = 'this_month' | 'last_month' | 'this_quarter' | 'this_year' | 'all_time'

@ApiTags('Analytics')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard)
@Controller({ path: 'analytics', version: '1' })
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Executive KPI summary — events, revenue, leads, profitability' })
  @ApiQuery({ name: 'period', enum: ['this_month', 'last_month', 'this_quarter', 'this_year', 'all_time'], required: false })
  getSummary(
    @TenantId() tenantId: string,
    @AccessToken() token: string,
    @Query('period') period: Period = 'this_month',
  ) {
    return this.analyticsService.getExecutiveSummary(tenantId, token, period)
  }

  @Get('revenue-trends')
  @ApiOperation({ summary: 'Monthly revenue, expenses, and profit trends' })
  @ApiQuery({ name: 'months', type: Number, required: false })
  getRevenueTrends(
    @TenantId() tenantId: string,
    @AccessToken() token: string,
    @Query('months') months = 12,
  ) {
    return this.analyticsService.getRevenueTrends(tenantId, token, Number(months))
  }

  @Get('event-performance')
  @ApiOperation({ summary: 'Per-event P&L, guest attendance, and task completion matrix' })
  @ApiQuery({ name: 'limit', type: Number, required: false })
  getEventPerformance(
    @TenantId() tenantId: string,
    @AccessToken() token: string,
    @Query('limit') limit = 20,
  ) {
    return this.analyticsService.getEventPerformance(tenantId, token, Number(limit))
  }

  @Get('lead-funnel')
  @ApiOperation({ summary: 'CRM lead pipeline funnel and conversion analytics' })
  @ApiQuery({ name: 'months', type: Number, required: false })
  getLeadFunnel(
    @TenantId() tenantId: string,
    @AccessToken() token: string,
    @Query('months') months = 6,
  ) {
    return this.analyticsService.getLeadFunnel(tenantId, token, Number(months))
  }

  @Get('expenses')
  @ApiOperation({ summary: 'Expense breakdown by category' })
  @ApiQuery({ name: 'event_id', required: false })
  getExpenses(
    @TenantId() tenantId: string,
    @AccessToken() token: string,
    @Query('event_id') eventId?: string,
  ) {
    return this.analyticsService.getExpenseBreakdown(tenantId, token, eventId)
  }

  @Get('guests')
  @ApiOperation({ summary: 'Guest analytics — RSVP, check-in, dietary, categories' })
  @ApiQuery({ name: 'event_id', required: false })
  getGuestAnalytics(
    @TenantId() tenantId: string,
    @AccessToken() token: string,
    @Query('event_id') eventId?: string,
  ) {
    return this.analyticsService.getGuestAnalytics(tenantId, token, eventId)
  }

  @Get('team')
  @ApiOperation({ summary: 'Team performance — task completion rates and lead conversion' })
  getTeamPerformance(
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.analyticsService.getTeamPerformance(tenantId, token)
  }

  // ── Cross-event BI endpoints ──────────────────────────────────────────────

  @Get('cross-event')
  @ApiOperation({ summary: 'Cross-event KPI summary with custom date range' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  getCrossEvent(
    @TenantId() tenantId: string,
    @AccessToken() token: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const toDate = to ?? new Date().toISOString()
    const fromDate = from ?? new Date(new Date().getFullYear(), 0, 1).toISOString()
    return this.analyticsService.getCrossEventSummary(tenantId, token, fromDate, toDate)
  }

  @Get('vendor-spend')
  @ApiOperation({ summary: 'Vendor and expense spend by category across events' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  getVendorSpend(
    @TenantId() tenantId: string,
    @AccessToken() token: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const toDate = to ?? new Date().toISOString()
    const fromDate = from ?? new Date(new Date().getFullYear(), 0, 1).toISOString()
    return this.analyticsService.getVendorSpendByCategory(tenantId, token, fromDate, toDate)
  }

  @Get('guest-headcount')
  @ApiOperation({ summary: 'Monthly guest headcount trend + YoY comparison' })
  @ApiQuery({ name: 'months', type: Number, required: false })
  getGuestHeadcount(
    @TenantId() tenantId: string,
    @AccessToken() token: string,
    @Query('months') months = 24,
  ) {
    return this.analyticsService.getGuestHeadcountTrend(tenantId, token, Number(months))
  }

  @Get('event-types')
  @ApiOperation({ summary: 'Revenue and guest count by event type' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  getEventTypes(
    @TenantId() tenantId: string,
    @AccessToken() token: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const toDate = to ?? new Date().toISOString()
    const fromDate = from ?? new Date(new Date().getFullYear(), 0, 1).toISOString()
    return this.analyticsService.getTopEventTypes(tenantId, token, fromDate, toDate)
  }

  @Get('csv-export')
  @ApiOperation({ summary: 'Export event performance data as CSV' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  async exportCSV(
    @TenantId() tenantId: string,
    @AccessToken() token: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @Res() res: Response,
  ) {
    const toDate = to ?? new Date().toISOString()
    const fromDate = from ?? new Date(new Date().getFullYear(), 0, 1).toISOString()
    const csv = await this.analyticsService.exportCrossEventCSV(tenantId, token, fromDate, toDate)
    const filename = `event-analytics-${new Date().toISOString().slice(0, 10)}.csv`
    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.send(csv)
  }
}
