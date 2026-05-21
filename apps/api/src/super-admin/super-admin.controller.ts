import {
  Controller, Get, Post, Patch, Delete, Param, Body, Query,
  Headers, HttpCode, HttpStatus, UseGuards,
} from '@nestjs/common'
import { SuperAdminService } from './super-admin.service'
import { AuthGuard } from '../modules/auth/auth.guard'

@Controller({ path: 'super-admin', version: '1' })
@UseGuards(AuthGuard)
export class SuperAdminController {
  constructor(private readonly svc: SuperAdminService) {}

  private h(auth: string) { return auth?.replace('Bearer ', '') }

  // ─── Platform Overview & Analytics ────────────────────────────────────────

  @Get('overview')
  getOverview(@Headers('authorization') auth: string) {
    return this.svc.getPlatformOverview(this.h(auth))
  }

  @Get('events')
  listEvents(
    @Headers('authorization') auth: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.svc.listPlatformEvents(this.h(auth), { status, search, limit: limit ? +limit : 100, offset: offset ? +offset : 0 })
  }

  @Get('analytics')
  getAnalytics(@Headers('authorization') auth: string) {
    return this.svc.getPlatformAnalytics(this.h(auth))
  }

  @Get('alerts')
  getAlerts(@Headers('authorization') auth: string) {
    return this.svc.getSmartAlerts(this.h(auth))
  }

  @Get('smart-alerts')
  getSmartAlerts(@Headers('authorization') auth: string) {
    return this.svc.getSmartAlerts(this.h(auth))
  }

  // ─── Tenant Management ────────────────────────────────────────────────────

  @Get('tenants')
  listTenants(
    @Headers('authorization') auth: string,
    @Query('status') status?: string,
    @Query('plan') plan?: string,
    @Query('search') search?: string,
    @Query('churnRisk') churnRisk?: string,
  ) {
    return this.svc.listTenants(this.h(auth), { status, plan, search, churnRisk })
  }

  @Get('tenants/:id')
  getTenant(@Param('id') id: string, @Headers('authorization') auth: string) {
    return this.svc.getTenant(this.h(auth), id)
  }

  @Post('tenants/:id/suspend')
  suspendTenant(@Param('id') id: string, @Headers('authorization') auth: string, @Body() body: { reason: string }) {
    return this.svc.suspendTenant(this.h(auth), id, body.reason)
  }

  @Post('tenants/:id/reactivate')
  reactivateTenant(@Param('id') id: string, @Headers('authorization') auth: string) {
    return this.svc.reactivateTenant(this.h(auth), id)
  }

  @Delete('tenants/:id')
  @HttpCode(HttpStatus.OK)
  deleteTenant(@Param('id') id: string, @Headers('authorization') auth: string, @Body() body: { confirmation: string }) {
    return this.svc.deleteTenant(this.h(auth), id, body.confirmation)
  }

  @Post('tenants/:id/plan-override')
  overridePlan(
    @Param('id') id: string,
    @Headers('authorization') auth: string,
    @Body() body: { plan: string; reason: string; until?: string },
  ) {
    return this.svc.overrideTenantPlan(this.h(auth), id, body.plan, body.reason, body.until)
  }

  @Post('tenants/:id/storage-quota')
  setStorageQuota(@Param('id') id: string, @Headers('authorization') auth: string, @Body() body: { quota_gb: number }) {
    return this.svc.setStorageQuota(this.h(auth), id, body.quota_gb)
  }

  @Post('tenants/:id/quota')
  setQuotaAlias(@Param('id') id: string, @Headers('authorization') auth: string, @Body() body: { quota_gb: number }) {
    return this.svc.setStorageQuota(this.h(auth), id, body.quota_gb)
  }

  @Get('tenants/:id/modules')
  getTenantModules(@Param('id') id: string, @Headers('authorization') auth: string) {
    return this.svc.getTenantModules(this.h(auth), id)
  }

  @Post('tenants/:id/modules')
  @Patch('tenants/:id/modules')
  setTenantModules(
    @Param('id') id: string,
    @Headers('authorization') auth: string,
    @Body() body: { modules: Record<string, boolean> },
  ) {
    return this.svc.setTenantModules(this.h(auth), id, body.modules)
  }

  // ─── Platform Users ───────────────────────────────────────────────────────

  @Get('users')
  listUsers(@Headers('authorization') auth: string, @Query('limit') limit?: string) {
    return this.svc.listPlatformUsers(this.h(auth), limit ? parseInt(limit) : 200)
  }

  @Post('users/:id/suspend')
  suspendUser(@Param('id') id: string, @Headers('authorization') auth: string) {
    return this.svc.suspendUser(this.h(auth), id)
  }

  @Post('users/:id/unsuspend')
  unsuspendUser(@Param('id') id: string, @Headers('authorization') auth: string) {
    return this.svc.unsuspendUser(this.h(auth), id)
  }

  @Post('users/:id/reset-password')
  resetPassword(@Param('id') id: string, @Headers('authorization') auth: string) {
    return this.svc.resetUserPassword(this.h(auth), id)
  }

  // ─── AI Config ────────────────────────────────────────────────────────────

  @Get('ai-config')
  getAiConfig(@Headers('authorization') auth: string) {
    return this.svc.getAiConfig(this.h(auth))
  }

  @Patch('ai-config')
  @Post('ai-config')
  updateAiConfig(@Headers('authorization') auth: string, @Body() body: Record<string, unknown>) {
    return this.svc.updateAiConfig(this.h(auth), body)
  }

  // ─── Storage ─────────────────────────────────────────────────────────────

  @Get('storage')
  getStorage(@Headers('authorization') auth: string) {
    return this.svc.getStorageStats(this.h(auth))
  }

  // ─── System Health ────────────────────────────────────────────────────────

  @Get('health')
  getHealth(@Headers('authorization') auth: string) {
    return this.svc.getSystemHealth(this.h(auth))
  }

  // ─── Payment Config ───────────────────────────────────────────────────────

  @Get('payment-config')
  getPaymentConfig(@Headers('authorization') auth: string) {
    return this.svc.getPaymentConfig(this.h(auth))
  }

  @Patch('payment-config')
  @Post('payment-config')
  updatePaymentConfig(@Headers('authorization') auth: string, @Body() body: Record<string, unknown>) {
    return this.svc.updatePaymentConfig(this.h(auth), body)
  }

  // ─── Platform Settings ────────────────────────────────────────────────────

  @Get('platform-settings')
  getPlatformSettings(@Headers('authorization') auth: string) {
    return this.svc.getPlatformSettings(this.h(auth))
  }

  @Post('platform-settings')
  @Patch('platform-settings')
  updatePlatformSettings(@Headers('authorization') auth: string, @Body() body: Record<string, unknown>) {
    return this.svc.updatePlatformSettings(this.h(auth), body)
  }

  // ─── Subscription Plans ───────────────────────────────────────────────────

  @Get('plans')
  getPlans(@Headers('authorization') auth: string) {
    return this.svc.getPlans(this.h(auth))
  }

  @Post('plans')
  createPlan(@Headers('authorization') auth: string, @Body() body: Record<string, unknown>) {
    return this.svc.createPlan(this.h(auth), body)
  }

  @Patch('plans/:id')
  updatePlan(@Param('id') id: string, @Headers('authorization') auth: string, @Body() body: Record<string, unknown>) {
    return this.svc.updatePlan(this.h(auth), id, body)
  }

  @Delete('plans/:id')
  @HttpCode(HttpStatus.OK)
  deletePlan(@Param('id') id: string, @Headers('authorization') auth: string) {
    return this.svc.deletePlan(this.h(auth), id)
  }

  // ─── Automations ──────────────────────────────────────────────────────────

  @Get('automations')
  getAutomations(@Headers('authorization') auth: string) {
    return this.svc.getAutomationStatus(this.h(auth))
  }

  @Get('automations/:job/runs')
  getAutomationRuns(
    @Param('job') job: string,
    @Headers('authorization') auth: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.getAutomationRuns(this.h(auth), job, limit ? parseInt(limit) : 5)
  }

  @Post('automations/:job/trigger')
  triggerAutomation(@Param('job') job: string, @Headers('authorization') auth: string) {
    return this.svc.triggerAutomation(this.h(auth), job)
  }

  @Post('automations/:job/pause')
  pauseAutomation(@Param('job') job: string, @Headers('authorization') auth: string) {
    return this.svc.pauseAutomation(this.h(auth), job)
  }

  @Post('automations/:job/resume')
  resumeAutomation(@Param('job') job: string, @Headers('authorization') auth: string) {
    return this.svc.resumeAutomation(this.h(auth), job)
  }

  // ─── Support Tools ────────────────────────────────────────────────────────

  @Get('tenant-notes')
  getTenantNotes(@Headers('authorization') auth: string, @Query('tenantId') tenantId?: string) {
    return this.svc.getTenantNotes(this.h(auth), tenantId)
  }

  @Post('tenant-notes')
  createTenantNote(
    @Headers('authorization') auth: string,
    @Body() body: { tenant_id: string; note: string; category?: string; is_internal?: boolean },
  ) {
    return this.svc.createTenantNote(this.h(auth), body)
  }

  @Get('announcements')
  getAnnouncements(@Headers('authorization') auth: string) {
    return this.svc.getAnnouncements(this.h(auth))
  }

  @Post('announcements')
  createAnnouncement(@Headers('authorization') auth: string, @Body() body: Record<string, unknown>) {
    return this.svc.createAnnouncement(this.h(auth), body)
  }

  @Delete('announcements/:id')
  @HttpCode(HttpStatus.OK)
  deleteAnnouncement(@Param('id') id: string, @Headers('authorization') auth: string) {
    return this.svc.deleteAnnouncement(this.h(auth), id)
  }

  @Get('impersonation-log')
  getImpersonationLog(@Headers('authorization') auth: string) {
    return this.svc.getImpersonationLog(this.h(auth))
  }
}
