import {
  Injectable, CanActivate, ExecutionContext, UnauthorizedException,
} from '@nestjs/common'
import { ClientPortalService } from './client-portal.service'

/**
 * Guards client-portal routes that require an authenticated client session.
 * Reads the session UUID from the `X-Client-Session` request header.
 * On success, attaches `req.clientSession = { clientId, tenantId, sessionToken }`.
 */
@Injectable()
export class ClientPortalAuthGuard implements CanActivate {
  constructor(private readonly svc: ClientPortalService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest()
    const sessionToken = req.headers['x-client-session'] as string | undefined

    if (!sessionToken?.trim()) {
      throw new UnauthorizedException('Missing X-Client-Session header.')
    }

    // validateSession throws UnauthorizedException if token is invalid/expired
    const { clientId, tenantId } = await this.svc.validateSession(sessionToken.trim())

    req.clientSession = { clientId, tenantId, sessionToken: sessionToken.trim() }
    return true
  }
}
