import {
  Injectable,
  CanActivate,
  ExecutionContext,
  BadRequestException,
  Logger,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'

/**
 * Decorator to skip SQL injection guard on a specific route.
 * Use on routes where SQL-like keywords are legitimately expected
 * (e.g. a query-builder endpoint, admin raw query tool).
 *
 * @example
 * @SkipSqlInjectionGuard()
 * @Post('raw-query')
 * runQuery() {}
 */
export const SKIP_SQL_GUARD_KEY = 'skipSqlInjectionGuard'
import { SetMetadata } from '@nestjs/common'
export const SkipSqlInjectionGuard = () => SetMetadata(SKIP_SQL_GUARD_KEY, true)

/**
 * SqlInjectionGuard
 *
 * Defense-in-depth layer: scans request params, query strings, and body
 * for common SQL injection patterns and returns 400 if detected.
 *
 * NOTE: This is NOT the primary SQL injection defense. The Supabase
 * parameterized client already prevents injection at the query layer.
 * This guard adds an early-rejection layer to catch obvious attacks
 * before they reach service logic.
 *
 * Patterns checked:
 *  - Classic: ' OR 1=1, ' OR '1'='1
 *  - UNION-based: UNION SELECT, UNION ALL SELECT
 *  - Stacked queries: ; DROP TABLE, ;--, ; INSERT
 *  - Comment injection: --, #, /*
 *  - Time-based: SLEEP(), WAITFOR DELAY, BENCHMARK()
 *  - Blind: AND 1=1, AND 1=2
 *  - Boolean: 'a'='a', true=true
 */
@Injectable()
export class SqlInjectionGuard implements CanActivate {
  private readonly logger = new Logger(SqlInjectionGuard.name)

  // Patterns that indicate SQL injection attempts
  // Ordered from most to least specific to minimize false positives
  private readonly SQL_PATTERNS: RegExp[] = [
    // UNION-based injection
    /\bUNION\s+(ALL\s+)?SELECT\b/i,
    // Stacked queries
    /;\s*(DROP|DELETE|UPDATE|INSERT|TRUNCATE|ALTER|CREATE)\s/i,
    // Comment-based termination
    /('|")\s*(--|#|\/\*)/,
    // Classic tautologies
    /('\s*OR\s*'?\s*\d+\s*=\s*\d+)/i,
    /('\s*OR\s*'\w+'\s*=\s*'\w+')/i,
    /\bOR\s+1\s*=\s*1\b/i,
    /\bAND\s+1\s*=\s*[12]\b/i,
    // Time-based blind injection
    /\bSLEEP\s*\(\s*\d+\s*\)/i,
    /\bWAITFOR\s+DELAY\b/i,
    /\bBENCHMARK\s*\(/i,
    // System function abuse
    /\bINFORMATION_SCHEMA\b/i,
    /\bSYS\.?\b(TABLES|COLUMNS|OBJECTS)\b/i,
    /\bPG_SLEEP\s*\(/i,
    // Hex/char encoding bypass attempts
    /0x[0-9a-fA-F]{4,}/,
    /\bCHAR\s*\(\s*\d+/i,
    // Null byte injection
    /\x00/,
  ]

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Allow skip for designated routes
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_SQL_GUARD_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (skip) return true

    const request = context.switchToHttp().getRequest()

    // Check query params
    if (request.query && this.containsSqlInjection(request.query)) {
      this.logAndReject(request, 'query params')
    }

    // Check URL params
    if (request.params && this.containsSqlInjection(request.params)) {
      this.logAndReject(request, 'URL params')
    }

    // Check body (only for non-binary content types)
    const contentType = (request.headers?.['content-type'] ?? '') as string
    if (
      request.body &&
      !contentType.includes('multipart') &&
      !contentType.includes('octet-stream') &&
      this.containsSqlInjection(request.body)
    ) {
      this.logAndReject(request, 'request body')
    }

    return true
  }

  private containsSqlInjection(obj: unknown): boolean {
    if (typeof obj === 'string') {
      return this.SQL_PATTERNS.some((pattern) => pattern.test(obj))
    }

    if (Array.isArray(obj)) {
      return obj.some((item) => this.containsSqlInjection(item))
    }

    if (typeof obj === 'object' && obj !== null) {
      return Object.values(obj as Record<string, unknown>).some((val) =>
        this.containsSqlInjection(val),
      )
    }

    return false
  }

  private logAndReject(request: any, location: string): never {
    const ip = request.ip ?? request.socket?.remoteAddress ?? 'unknown'
    const path = request.url ?? 'unknown'

    this.logger.warn(
      `SQL injection pattern detected — IP: ${ip}, path: ${path}, location: ${location}`,
    )

    throw new BadRequestException(
      'Request contains invalid characters',
    )
  }
}
