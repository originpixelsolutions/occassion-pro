import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common'

@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
      const request = context.switchToHttp().getRequest()
          const profile = request.profile
              if (!profile?.is_super_admin && profile?.role !== 'super_admin') {
                    throw new ForbiddenException('Super admin access required')
                        }
                            return true
                              }
                              }