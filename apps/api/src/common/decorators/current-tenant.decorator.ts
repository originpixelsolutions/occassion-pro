import {
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common'

/**
 * @CurrentTenant()
 *
 * Extracts the tenant ID from the authenticated user's profile AND validates
 * that it matches the :tenantId URL parameter when present.
 *
 * This prevents cross-tenant access attacks where a valid JWT for tenant A
 * is used to access tenant B's resources by manipulating the URL.
 *
 * Usage:
 *   @Get('tenants/:tenantId/events')
 *   getEvents(@CurrentTenant() tenantId: string) {}
 *
 * The decorator will throw ForbiddenException if:
 *   1. No authenticated profile exists on the request
 *   2. The URL :tenantId param doesn't match the JWT tenant_id
 *
 * Super admin bypass: if request.profile.role === 'super_admin', the
 * tenantId from the URL param is returned without cross-checking.
 */
export const CurrentTenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest()
    const profile = request.profile

    if (!profile?.tenant_id) {
      throw new ForbiddenException('No tenant context in token')
    }

    const jwtTenantId: string = profile.tenant_id

    // Super admin can act on any tenant
    if (profile.role === 'super_admin') {
      // Return the URL tenant param if present, otherwise JWT tenant
      return request.params?.tenantId ?? jwtTenantId
    }

    // If route has a :tenantId param, enforce it matches the JWT
    const urlTenantId = request.params?.tenantId
    if (urlTenantId && urlTenantId !== jwtTenantId) {
      throw new ForbiddenException(
        'Cross-tenant access denied: token tenant does not match resource tenant',
      )
    }

    return jwtTenantId
  },
)

/**
 * @RequireTenantMatch()
 *
 * Guard-style decorator that enforces the URL :tenantId matches JWT tenant.
 * Used in combination with @CurrentTenant() or standalone via the guard.
 *
 * Throws ForbiddenException before the handler runs if tenant mismatch detected.
 */
export const TENANT_MATCH_KEY = 'requireTenantMatch'
import { SetMetadata } from '@nestjs/common'
export const RequireTenantMatch = () => SetMetadata(TENANT_MATCH_KEY, true)

/**
 * TenantMatchGuard
 *
 * Apply globally or per-route to enforce that URL :tenantId param always
 * matches the JWT's tenant_id claim. Skips if no :tenantId in route.
 */
import { Injectable, CanActivate } from '@nestjs/common'
import { Reflector } from '@nestjs/core'

@Injectable()
export class TenantMatchGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest()
    const profile = request.profile

    // Not yet authenticated — let AuthGuard handle it
    if (!profile) return true

    // Super admin can access any tenant
    if (profile.role === 'super_admin') return true

    const urlTenantId = request.params?.tenantId
    if (!urlTenantId) return true // No :tenantId in this route

    if (urlTenantId !== profile.tenant_id) {
      throw new ForbiddenException(
        'Cross-tenant access denied',
      )
    }

    return true
  }
}
