import { createParamDecorator, ExecutionContext } from '@nestjs/common'

/**
 * Extract the current user's tenant ID from the request
 * Usage: @TenantId() tenantId: string
 */
export const TenantId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest()
    return request.profile?.tenant_id
  },
)

/**
 * Extract the current authenticated user's ID
 * Usage: @CurrentUserId() userId: string
 */
export const CurrentUserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest()
    return request.user?.id
  },
)

/**
 * Extract the full current user profile
 * Usage: @CurrentProfile() profile: Profile
 */
export const CurrentProfile = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest()
    return request.profile
  },
)

/**
 * Extract the raw Supabase access token
 * Usage: @AccessToken() token: string
 */
export const AccessToken = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest()
    return request.accessToken
  },
)

/**
 * Extract the current user's full name from their profile
 * Usage: @CurrentUserName() name: string
 */
export const CurrentUserName = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest()
    const profile = request.profile
    if (!profile) return undefined
    return profile.full_name ?? profile.display_name ?? profile.email ?? undefined
  },
)
