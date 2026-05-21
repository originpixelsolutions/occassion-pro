import { Global, Module } from '@nestjs/common'
import { FieldEncryptionService } from './field-encryption.service'

/**
 * FieldEncryptionModule
 *
 * Global module — import once in AppModule, available everywhere.
 * Provides FieldEncryptionService for AES-256-GCM field encryption.
 */
@Global()
@Module({
  providers: [FieldEncryptionService],
  exports: [FieldEncryptionService],
})
export class FieldEncryptionModule {}
