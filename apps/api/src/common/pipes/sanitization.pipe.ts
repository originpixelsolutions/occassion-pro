import {
  Injectable,
  PipeTransform,
  ArgumentMetadata,
  BadRequestException,
  Logger,
} from '@nestjs/common'

// xss package: whitelist-mode XSS sanitizer
// npm install xss
import xss from 'xss'

/**
 * SanitizationPipe
 *
 * Globally strips XSS payloads from all string inputs using the `xss`
 * package in whitelist mode with zero allowed tags. Applied before
 * class-validator runs so validators see clean input.
 *
 * Skips:
 *  - Non-string primitives (numbers, booleans)
 *  - null / undefined
 *  - Fields explicitly tagged with @SkipSanitize() (future use)
 *
 * Security note: This is a defense-in-depth layer. Primary XSS protection
 * is React's auto-escaping on the frontend. This guards server-side
 * storage and any server-rendered output.
 */
@Injectable()
export class SanitizationPipe implements PipeTransform {
  private readonly logger = new Logger(SanitizationPipe.name)

  // xss options: whitelist mode with empty tag list = strip ALL HTML tags
  private readonly xssOptions: xss.IWhiteList = {}

  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    if (value === null || value === undefined) return value

    // Sanitize body objects deeply
    if (metadata.type === 'body' && typeof value === 'object') {
      return this.sanitizeObject(value as Record<string, unknown>)
    }

    // Sanitize individual query/param strings
    if (metadata.type === 'query' || metadata.type === 'param') {
      if (typeof value === 'string') {
        return this.sanitizeString(value)
      }
      if (typeof value === 'object' && value !== null) {
        return this.sanitizeObject(value as Record<string, unknown>)
      }
    }

    return value
  }

  private sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {}

    for (const [key, val] of Object.entries(obj)) {
      if (typeof val === 'string') {
        result[key] = this.sanitizeString(val)
      } else if (Array.isArray(val)) {
        result[key] = val.map((item) =>
          typeof item === 'string'
            ? this.sanitizeString(item)
            : typeof item === 'object' && item !== null
              ? this.sanitizeObject(item as Record<string, unknown>)
              : item,
        )
      } else if (typeof val === 'object' && val !== null) {
        result[key] = this.sanitizeObject(val as Record<string, unknown>)
      } else {
        result[key] = val
      }
    }

    return result
  }

  private sanitizeString(input: string): string {
    const sanitized = xss(input, {
      whiteList: this.xssOptions, // empty = no tags allowed
      stripIgnoreTag: true,       // strip tags not in whitelist
      stripIgnoreTagBody: ['script', 'style'], // remove content too
      css: false,                 // strip style attributes
    })

    // Log potential XSS attempts (sanitized string differs significantly)
    if (sanitized !== input && input.length > 0) {
      const hadScriptTag = /<script[\s\S]*?>[\s\S]*?<\/script>/i.test(input)
      const hadEventHandler = /on\w+\s*=/i.test(input)
      if (hadScriptTag || hadEventHandler) {
        this.logger.warn(
          `XSS attempt detected and stripped: ${input.substring(0, 100)}...`,
        )
      }
    }

    return sanitized
  }
}

/**
 * StrictSanitizationPipe
 *
 * Rejects (400) rather than strips if XSS payload detected.
 * Use on endpoints where HTML is never valid (e.g. auth, IDs).
 */
@Injectable()
export class StrictSanitizationPipe implements PipeTransform {
  private readonly xssPattern =
    /<script|<\/script|javascript:|onerror=|onload=|<iframe|<object|<embed|<svg/i

  transform(value: unknown, _metadata: ArgumentMetadata): unknown {
    if (typeof value === 'string' && this.xssPattern.test(value)) {
      throw new BadRequestException('Input contains invalid characters')
    }
    if (typeof value === 'object' && value !== null) {
      this.checkObject(value as Record<string, unknown>)
    }
    return value
  }

  private checkObject(obj: Record<string, unknown>): void {
    for (const val of Object.values(obj)) {
      if (typeof val === 'string' && this.xssPattern.test(val)) {
        throw new BadRequestException('Input contains invalid characters')
      }
      if (typeof val === 'object' && val !== null) {
        this.checkObject(val as Record<string, unknown>)
      }
    }
  }
}
