import { Module } from '@nestjs/common'
import { DpdpService } from './dpdp.service'
import { DpdpController, DpdpPublicController } from './dpdp.controller'
import { CommunicationsModule } from '../communications/communications.module'

@Module({
  imports: [CommunicationsModule],
  controllers: [DpdpController, DpdpPublicController],
  providers: [DpdpService],
  exports: [DpdpService],   // Exported so other modules can call recordConsent()
})
export class DpdpModule {}
