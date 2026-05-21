import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common'
import { VendorPortalAuthService } from './vendor-portal-auth.service'

@Injectable()
export class VendorPortalAuthGuard implements CanActivate {
  constructor(private readonly authSvc: VendorPortalAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest()
    const sessionToken = req.headers['x-vendor-session'] as string | undefined

    if (!sessionToken?.trim()) {
      throw new UnauthorizedException('Missing X-Vendor-Session header.')
    }

    const { vendorId } = await this.authSvc.validateSession(sessionToken.trim())
    req.vendorSession = { vendorId, sessionToken: sessionToken.trim() }
    return true
  }
}
