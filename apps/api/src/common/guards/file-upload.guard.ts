import {
  Injectable,
  CanActivate,
  ExecutionContext,
  BadRequestException,
  PayloadTooLargeException,
  Logger,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { SetMetadata } from '@nestjs/common'
import { extname, basename } from 'path'

// ── File type magic bytes (first N bytes of file identify actual type) ─────
// This prevents extension spoofing (e.g. shell.php renamed to image.jpg)
const MAGIC_BYTES: Record<string, Buffer[]> = {
  'image/jpeg': [Buffer.from([0xff, 0xd8, 0xff])],
  'image/png':  [Buffer.from([0x89, 0x50, 0x4e, 0x47])],
  'image/gif':  [Buffer.from([0x47, 0x49, 0x46, 0x38])],
  'image/webp': [Buffer.from([0x52, 0x49, 0x46, 0x46])],
  'image/svg+xml': [Buffer.from([0x3c, 0x73, 0x76, 0x67]), Buffer.from([0x3c, 0x3f, 0x78, 0x6d])],
  'application/pdf': [Buffer.from([0x25, 0x50, 0x44, 0x46])],
  'application/zip': [Buffer.from([0x50, 0x4b, 0x03, 0x04])],
}

// Allowed MIME types per upload category
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
const ALLOWED_DOCUMENT_TYPES = ['application/pdf', 'application/zip']
const ALLOWED_ALL = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_DOCUMENT_TYPES]

// ── Decorator metadata keys ─────────────────────────────────────────────────
export const FILE_UPLOAD_OPTS_KEY = 'fileUploadOpts'

export interface FileUploadOptions {
  maxSizeBytes?: number        // Default: 5MB for images, 50MB for docs
  allowedTypes?: string[]      // MIME types (default: ALLOWED_IMAGE_TYPES)
  checkMagicBytes?: boolean    // Default: true
  sanitizeFilename?: boolean   // Default: true
}

/**
 * @AllowFileUpload(options)
 * Apply to route handlers that accept file uploads.
 */
export const AllowFileUpload = (opts: FileUploadOptions = {}) =>
  SetMetadata(FILE_UPLOAD_OPTS_KEY, opts)

/**
 * FileUploadGuard
 *
 * Validates uploaded files before they reach the handler:
 *   1. MIME type allowlist check
 *   2. File size limit (5MB images / 50MB documents)
 *   3. Magic byte verification (checks actual file type, not just extension)
 *   4. Filename sanitization (strips path traversal, special chars)
 *
 * Works with Fastify multipart (fastify-multipart).
 * Apply via @UseGuards(FileUploadGuard) on upload endpoints.
 *
 * SECURITY: Never trust the Content-Type header or file extension alone.
 * Always verify magic bytes to prevent polyglot file attacks.
 */
@Injectable()
export class FileUploadGuard implements CanActivate {
  private readonly logger = new Logger(FileUploadGuard.name)

  // Default limits
  private readonly DEFAULT_IMAGE_MAX = 5 * 1024 * 1024    // 5MB
  private readonly DEFAULT_DOC_MAX   = 50 * 1024 * 1024   // 50MB

  // Dangerous filename patterns
  private readonly DANGEROUS_FILENAME_RE = /[<>:"/\\|?*\x00-\x1F]/g
  private readonly PATH_TRAVERSAL_RE = /\.\./
  private readonly NULL_BYTE_RE = /\x00/

  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const opts = this.reflector.get<FileUploadOptions>(
      FILE_UPLOAD_OPTS_KEY,
      context.getHandler(),
    ) ?? {}

    const request = context.switchToHttp().getRequest()

    // Only validate if there's a file upload in this request
    const contentType = (request.headers?.['content-type'] ?? '') as string
    if (!contentType.includes('multipart/form-data')) {
      return true // Not a file upload request
    }

    // For Fastify multipart: files are available at request.files or request.file
    const files = await this.extractFiles(request)
    if (!files.length) return true

    const allowedTypes = opts.allowedTypes ?? ALLOWED_IMAGE_TYPES
    const checkMagicBytes = opts.checkMagicBytes !== false

    for (const file of files) {
      this.validateMimeType(file, allowedTypes)
      this.validateFileSize(file, opts.maxSizeBytes, allowedTypes)
      if (checkMagicBytes && file.buffer) {
        this.validateMagicBytes(file)
      }
      if (opts.sanitizeFilename !== false) {
        file.filename = this.sanitizeFilename(file.filename)
      }
    }

    return true
  }

  private async extractFiles(request: any): Promise<FileInfo[]> {
    // Handle fastify-multipart's isMultipart check
    if (typeof request.file === 'function') {
      try {
        const file = await request.file()
        return file ? [this.toFileInfo(file)] : []
      } catch {
        return []
      }
    }

    // Already parsed files object
    if (request.files) {
      const files = Array.isArray(request.files)
        ? request.files
        : Object.values(request.files).flat()
      return (files as any[]).map(this.toFileInfo)
    }

    return []
  }

  private toFileInfo(f: any): FileInfo {
    return {
      filename:  f.filename ?? f.name ?? 'unknown',
      mimetype:  f.mimetype ?? f.type ?? '',
      size:      f.file?.bytesRead ?? f.size ?? 0,
      buffer:    f._buf ?? f.buffer ?? null,
    }
  }

  private validateMimeType(file: FileInfo, allowed: string[]): void {
    if (!allowed.includes(file.mimetype)) {
      throw new BadRequestException(
        `File type '${file.mimetype}' is not allowed. Accepted: ${allowed.join(', ')}`,
      )
    }
  }

  private validateFileSize(
    file: FileInfo,
    maxBytes: number | undefined,
    allowedTypes: string[],
  ): void {
    const isDocument = ALLOWED_DOCUMENT_TYPES.some((t) => allowedTypes.includes(t))
    const defaultMax = isDocument ? this.DEFAULT_DOC_MAX : this.DEFAULT_IMAGE_MAX
    const limit = maxBytes ?? defaultMax

    if (file.size > limit) {
      const limitMB = Math.round(limit / 1024 / 1024)
      throw new PayloadTooLargeException(
        `File '${file.filename}' exceeds maximum size of ${limitMB}MB`,
      )
    }
  }

  private validateMagicBytes(file: FileInfo): void {
    if (!file.buffer || file.buffer.length < 4) return

    const expected = MAGIC_BYTES[file.mimetype]
    if (!expected) return // No magic bytes defined for this type

    const fileStart = file.buffer.subarray(0, 12)
    const isValid = expected.some((magic) =>
      fileStart.subarray(0, magic.length).equals(magic),
    )

    if (!isValid) {
      this.logger.warn(
        `Magic byte mismatch for '${file.filename}': claimed ${file.mimetype} but file header doesn't match`,
      )
      throw new BadRequestException(
        'File content does not match its declared type',
      )
    }
  }

  /**
   * Sanitize filename: strip path traversal, null bytes, dangerous chars.
   * Returns a safe filename with only alphanumeric, dash, underscore, dot.
   */
  sanitizeFilename(filename: string): string {
    if (!filename) return 'upload'

    // Get the base name only (strip any path components)
    let safe = basename(filename)

    // Remove null bytes
    safe = safe.replace(this.NULL_BYTE_RE, '')

    // Remove path traversal attempts
    if (this.PATH_TRAVERSAL_RE.test(safe)) {
      safe = safe.replace(/\.\./g, '')
    }

    // Strip dangerous characters — keep alphanumeric, dash, underscore, dot
    safe = safe.replace(this.DANGEROUS_FILENAME_RE, '')
    safe = safe.replace(/[^a-zA-Z0-9._-]/g, '_')

    // Ensure extension is preserved and safe
    const ext = extname(safe).toLowerCase()
    const dangerousExts = ['.php', '.exe', '.sh', '.bat', '.cmd', '.ps1', '.py', '.rb', '.pl']
    if (dangerousExts.includes(ext)) {
      safe = safe.slice(0, -ext.length) + '.blocked'
    }

    // Limit length
    if (safe.length > 255) {
      const nameExt = extname(safe)
      safe = safe.slice(0, 255 - nameExt.length) + nameExt
    }

    return safe || 'upload'
  }
}

interface FileInfo {
  filename: string
  mimetype: string
  size: number
  buffer: Buffer | null
}
