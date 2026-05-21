import { Global, Module } from '@nestjs/common'
import { WebhookSecurityService } from './webhook-security.service'
import { BruteForceService } from './brute-force.service'
import { SecurityAuditService } from './security-audit.service'
import { FieldEncryptionModule } from '../crypto/field-encryption.module'

/**
 * SecurityModule
 *
 * Global module providing:
 *   - WebhookSecurityService: HMAC verification, timestamp check, nonce dedup
 *   - BruteForceService: auth attempt tracking and lockout enforcement
 *   - SecurityAuditService: immutable security event log
 *
 * Import once in AppModule. Available everywhere via @Global().
 */
@Global()
@Module({
  imports: [FieldEncryptionModule],
  providers: [
    WebhookSecurityService,
    BruteForceService,
    SecurityAuditService,
  ],
  exports: [
    WebhookSecurityService,
    BruteForceService,
    SecurityAuditService,
  ],
})
export class SecurityModule {}
