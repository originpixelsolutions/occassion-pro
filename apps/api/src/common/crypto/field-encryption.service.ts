import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHash,
} from 'crypto'

/**
 * FieldEncryptionService
 *
 * AES-256-GCM field-level encryption for sensitive database columns.
 * Encryption key comes from FIELD_ENCRYPTION_KEY env var (must be a
 * 64-character hex string representing 32 bytes).
 *
 * Wire format (Base64-encoded):
 *   [12 bytes IV][16 bytes auth tag][N bytes ciphertext]
 *
 * Usage:
 *   const encrypted = await encryptionService.encrypt('secret value')
 *   const plain     = await encryptionService.decrypt(encrypted)
 *
 * Fields encrypted in OccasionPro:
 *   - tenant_payment_gateways.config       (API keys, webhook secrets)
 *   - tenant_custom_domains.metadata       (CF token fragments)
 *   - messaging.whatsapp_session_data      (WA session keys)
 *   - integrations.credentials             (OAuth tokens, API secrets)
 *
 * Security notes:
 *   - Each encrypt call generates a fresh random 12-byte IV
 *   - GCM auth tag (16 bytes) provides integrity + authenticity
 *   - Key rotation: increment key version and re-encrypt affected rows
 *   - Key must NOT be stored in DB — use env vars / KMS (AWS Secrets, GCP KMS)
 */
@Injectable()
export class FieldEncryptionService implements OnModuleInit {
  private readonly logger = new Logger(FieldEncryptionService.name)
  private key!: Buffer
  private readonly ALGORITHM = 'aes-256-gcm'
  private readonly IV_LENGTH = 12     // bytes — GCM recommended
  private readonly TAG_LENGTH = 16    // bytes — GCM auth tag

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const rawKey = this.config.get<string>('FIELD_ENCRYPTION_KEY')

    if (!rawKey) {
      this.logger.warn(
        'FIELD_ENCRYPTION_KEY not set — field encryption disabled. ' +
        'Generate with: openssl rand -hex 32',
      )
      // Use a deterministic dev key derived from a constant so dev/test works
      // NEVER use this in production — the warning above makes it explicit
      this.key = createHash('sha256').update('dev-insecure-key-DO-NOT-USE-PROD').digest()
      return
    }

    if (rawKey.length !== 64 || !/^[0-9a-fA-F]+$/.test(rawKey)) {
      throw new Error(
        'FIELD_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes). ' +
        'Generate with: openssl rand -hex 32',
      )
    }

    this.key = Buffer.from(rawKey, 'hex')
    this.logger.log('Field encryption initialized ✓')
  }

  /**
   * Encrypt a plaintext string.
   * Returns a Base64-encoded string containing IV + auth tag + ciphertext.
   * Returns null if input is null/undefined.
   */
  encrypt(plaintext: string): string
  encrypt(plaintext: null | undefined): null
  encrypt(plaintext: string | null | undefined): string | null {
    if (plaintext === null || plaintext === undefined) return null

    const iv = randomBytes(this.IV_LENGTH)
    const cipher = createCipheriv(this.ALGORITHM, this.key, iv, {
      authTagLength: this.TAG_LENGTH,
    })

    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ])

    const authTag = cipher.getAuthTag()

    // Combine: [IV (12)] + [authTag (16)] + [ciphertext (N)]
    const combined = Buffer.concat([iv, authTag, encrypted])
    return combined.toString('base64')
  }

  /**
   * Decrypt a Base64-encoded ciphertext string produced by encrypt().
   * Returns the original plaintext string.
   * Throws if the ciphertext is tampered with (GCM auth tag mismatch).
   */
  decrypt(ciphertext: string): string
  decrypt(ciphertext: null | undefined): null
  decrypt(ciphertext: string | null | undefined): string | null {
    if (ciphertext === null || ciphertext === undefined) return null

    let combined: Buffer
    try {
      combined = Buffer.from(ciphertext, 'base64')
    } catch {
      throw new Error('FieldEncryptionService: invalid ciphertext encoding')
    }

    if (combined.length < this.IV_LENGTH + this.TAG_LENGTH + 1) {
      throw new Error('FieldEncryptionService: ciphertext too short — possible corruption')
    }

    const iv      = combined.subarray(0, this.IV_LENGTH)
    const authTag = combined.subarray(this.IV_LENGTH, this.IV_LENGTH + this.TAG_LENGTH)
    const data    = combined.subarray(this.IV_LENGTH + this.TAG_LENGTH)

    const decipher = createDecipheriv(this.ALGORITHM, this.key, iv, {
      authTagLength: this.TAG_LENGTH,
    })
    decipher.setAuthTag(authTag)

    try {
      const decrypted = Buffer.concat([decipher.update(data), decipher.final()])
      return decrypted.toString('utf8')
    } catch {
      throw new Error(
        'FieldEncryptionService: decryption failed — data may be tampered with or key is wrong',
      )
    }
  }

  /**
   * Encrypt a JSON-serializable object.
   * Convenience wrapper: JSON.stringify → encrypt.
   */
  encryptObject<T>(obj: T): string | null {
    if (obj === null || obj === undefined) return null
    return this.encrypt(JSON.stringify(obj))
  }

  /**
   * Decrypt a JSON object previously encrypted with encryptObject().
   */
  decryptObject<T>(ciphertext: string | null | undefined): T | null {
    const plaintext = this.decrypt(ciphertext as string)
    if (plaintext === null) return null
    try {
      return JSON.parse(plaintext) as T
    } catch {
      throw new Error('FieldEncryptionService: decrypted data is not valid JSON')
    }
  }

  /**
   * Hash a value for safe storage in logs / auth_attempts table.
   * Uses SHA-256 — NOT reversible, suitable for IPs and identifiers.
   */
  hashForStorage(value: string): string {
    return createHash('sha256')
      .update(value)
      .update(this.config.get('HASH_PEPPER', 'occasionpro-pepper'))
      .digest('hex')
  }

  /**
   * Returns true if the service is using the dev fallback key.
   * Use this to gate production behavior.
   */
  isDevMode(): boolean {
    return !this.config.get<string>('FIELD_ENCRYPTION_KEY')
  }
}
