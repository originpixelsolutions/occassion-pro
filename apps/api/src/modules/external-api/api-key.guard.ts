import {
  Injectable, CanActivate, ExecutionContext,
  UnauthorizedException, ForbiddenException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { ApiKeysService } from './api-keys.service'
import { SecurityAuditService } from '../../common/security/security-audit.service'

export const REQUIRE_SCOPE = 'require_scope'
export const RequireScope = (scope: string) =>
  (target: any, key?: string | symbol, desc?: any) => {
    Reflect.defineMetadata(REQUIRE_SCOPE, scope, desc?.value ?? target)
    return desc ?? target
  }

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly apiKeysSvc: ApiKeysService,
    private readonly reflector: Reflector,
    private readonly audit: SecurityAuditService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest()
    const ip: string = req.ip

    // Extract key from Authorization header or x-api-key header
    const authHeader: string = req.headers['authorization'] ?? ''
    const apiKeyHeader: string = req.headers['x-api-key'] ?? ''

    let rawKey: string | null = null
    if (apiKeyHeader) {
      rawKey = apiKeyHeader.trim()
    } else if (authHeader.toLowerCase().startsWith('bearer ')) {
      rawKey = authHeader.slice(7).trim()
    }

    if (!rawKey) {
      this.audit.log({
        action: 'api_key.missing',
        ip,
        metadata: { path: req.url, method: req.method },
      })
      throw new UnauthorizedException('API key required')
    }

    const result = await this.apiKeysSvc.validateKey(rawKey)
    if (!result) {
      this.audit.log({
        action: 'api_key.invalid',
        ip,
        metadata: { path: req.url, method: req.method },
      })
      throw new UnauthorizedException('Invalid or expired API key')
    }

    const { keyRecord, tenantId } = result

    // Check required scope
    const requiredScope = this.reflector.getAllAndOverride<string>(REQUIRE_SCOPE, [
      ctx.getHandler(),
      ctx.getClass(),
    ])

    if (requiredScope && !keyRecord.scopes.includes(requiredScope)) {
      this.audit.log({
        action: 'api_key.scope_denied',
        tenantId,
        ip,
        metadata: {
          keyId: keyRecord.id,
          required: requiredScope,
          available: keyRecord.scopes,
          path: req.url,
        },
      })
      throw new ForbiddenException(`Scope '${requiredScope}' required`)
    }

    // Check IP allowlist
    if (keyRecord.allowed_ips?.length) {
      const clientIp = req.ip ?? req.connection?.remoteAddress
      if (!keyRecord.allowed_ips.includes(clientIp)) {
        this.audit.log({
          action: 'api_key.ip_blocked',
          tenantId,
          ip,
          metadata: {
            keyId: keyRecord.id,
            allowedIps: keyRecord.allowed_ips,
            path: req.url,
          },
        })
        throw new ForbiddenException('IP not in allowlist')
      }
    }

    // Attach to request
    req.apiKey = keyRecord
    req.tenantId = tenantId
    req.apiKeyId = keyRecord.id

    // SECURITY: Audit successful API key usage (fire-and-forget — never blocks request)
    this.audit.log({
      action: 'api_key.used',
      tenantId,
      ip,
      metadata: {
        keyId: keyRecord.id,
        keyName: keyRecord.name,
        scopes: keyRecord.scopes,
        path: req.url,
        method: req.method,
      },
    })

    return true
  }
}
