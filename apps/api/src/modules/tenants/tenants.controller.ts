import { Controller, Get, Put, Post, Param, Body, UseGuards, ParseIntPipe } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { TenantsService } from './tenants.service'
import { AuthGuard } from '../../common/guards/auth.guard'
import { WorkspaceRoleGuard } from '../../common/guards/workspace-role.guard'
import { RequireTenantRole } from '../../common/decorators/require-tenant-role.decorator'
import { TenantId, CurrentUserId, AccessToken } from '../../common/decorators/tenant.decorator'

@ApiTags('Tenants')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard)
@Controller({ path: 'tenants', version: '1' })
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  // ─── Read: any authenticated member ───────────────────────────────────────

  @Get('me')
  @ApiOperation({ summary: 'Get current tenant details' })
  getMyTenant(@TenantId() t: string, @AccessToken() token: string) {
    return this.tenantsService.findOne(t, token)
  }

  @Get('me/stats')
  @ApiOperation({ summary: 'Get tenant stats' })
  getStats(@TenantId() t: string, @AccessToken() token: string) {
    return this.tenantsService.getStats(t, token)
  }

  @Get('me/usage')
  @ApiOperation({ summary: 'Get tenant usage (storage, events, seats)' })
  getUsage(@TenantId() t: string, @AccessToken() token: string) {
    return this.tenantsService.getUsage(t, token)
  }

  // ─── Write: Workspace Owner only ──────────────────────────────────────────

  @Put('me')
  @UseGuards(WorkspaceRoleGuard)
  @RequireTenantRole('owner')
  @ApiOperation({ summary: 'Update workspace settings [Owner only]' })
  update(
    @Body() dto: any,
    @TenantId() t: string,
    @AccessToken() token: string,
  ) {
    return this.tenantsService.update(t, dto, t, token)
  }

  @Put('me/branding')
  @UseGuards(WorkspaceRoleGuard)
  @RequireTenantRole('owner')
  @ApiOperation({ summary: 'Update workspace branding [Owner only]' })
  updateBranding(
    @Body() dto: any,
    @TenantId() t: string,
    @AccessToken() token: string,
  ) {
    return this.tenantsService.updateBranding(t, dto, t, token)
  }

  // ─── Onboarding ──────────────────────────────────────────────────────────────

  @Get('me/onboarding')
  @ApiOperation({ summary: 'Get onboarding status for current tenant' })
  getOnboardingStatus(
    @TenantId() t: string,
    @AccessToken() token: string,
  ) {
    return this.tenantsService.getOnboardingStatus(t, token)
  }

  @Post('me/onboarding/step/:step')
  @ApiOperation({ summary: 'Complete onboarding step N (1-5). Step 5 marks onboarding done.' })
  completeOnboardingStep(
    @Param('step', ParseIntPipe) step: number,
    @TenantId() t: string,
    @AccessToken() token: string,
  ) {
    return this.tenantsService.completeOnboardingStep(t, step, token)
  }

  @Post('me/onboarding/complete')
  @ApiOperation({ summary: 'Skip/complete onboarding wizard entirely' })
  completeOnboarding(
    @TenantId() t: string,
    @AccessToken() token: string,
  ) {
    return this.tenantsService.completeOnboarding(t, token)
  }
}
