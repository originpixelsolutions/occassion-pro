import {
  Body, Controller, Delete, Get, Param, Patch,
  UseGuards, Request,
} from '@nestjs/common'
import { BrandingService, BrandingTokenSet } from './branding.service'
import { UpsertBrandingDto } from './branding.dto'
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'
import { RolesGuard } from '../common/guards/roles.guard'
import { Roles } from '../../common/decorators/roles.decorator'

// ─────────────────────────────────────────────────────────────────────────────
// Public endpoint — no auth required, used by frontend on load
// GET /v1/branding/:tenantId   (tenantId may be "default")
// ─────────────────────────────────────────────────────────────────────────────
@Controller('branding')
export class BrandingPublicController {
  constructor(private readonly svc: BrandingService) {}

  @Get(':tenantId')
  getBranding(@Param('tenantId') tenantId: string): Promise<BrandingTokenSet> {
    return this.svc.getBranding(tenantId === 'default' ? null : tenantId)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin endpoints — Super Admin only
// ─────────────────────────────────────────────────────────────────────────────
@Controller('admin/branding')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('super_admin')
export class BrandingAdminController {
  constructor(private readonly svc: BrandingService) {}

  /** List all tenant branding configs */
  @Get()
  listAll() {
    return this.svc.listAllBrandings()
  }

  /** Get single tenant branding */
  @Get(':tenantId')
  getOne(@Param('tenantId') tenantId: string) {
    return this.svc.getBranding(tenantId === 'default' ? null : tenantId)
  }

  /** Upsert branding for a tenant (or platform default) */
  @Patch(':tenantId')
  upsert(
    @Param('tenantId') tenantId: string,
    @Body() dto: UpsertBrandingDto,
  ) {
    return this.svc.upsertBranding(tenantId === 'default' ? null : tenantId, dto)
  }

  /** Reset tenant branding to platform defaults */
  @Delete(':tenantId')
  reset(@Param('tenantId') tenantId: string) {
    if (tenantId === 'default') throw new Error('Cannot reset platform defaults')
    return this.svc.resetToDefaults(tenantId)
  }
}
