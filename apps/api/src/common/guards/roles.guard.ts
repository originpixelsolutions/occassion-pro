import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { UserRole } from '@occasionpro/database'
import { ROLES_KEY } from '../decorators/roles.decorator'

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    )
    if (!requiredRoles || requiredRoles.length === 0) return true

    const { profile } = context.switchToHttp().getRequest()
    if (!profile) throw new ForbiddenException('No profile found')

    const userRoles: { role: UserRole; is_active: boolean }[] =
      profile.user_roles ?? []

    const activeRoles = userRoles
      .filter((r) => r.is_active)
      .map((r) => r.role)

    // Super admin bypasses all role checks
    if (activeRoles.includes('super_admin')) return true

    const hasRole = requiredRoles.some((role) => activeRoles.includes(role))
    if (!hasRole) {
      throw new ForbiddenException(
        `Requires one of: ${requiredRoles.join(', ')}`,
      )
    }

    return true
  }
}
