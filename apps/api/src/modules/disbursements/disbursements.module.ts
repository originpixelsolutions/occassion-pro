import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { DisbursementsService } from './disbursements.service'
import { DisbursementsController, DisbursementWebhookController } from './disbursements.controller'

@Module({
  imports: [ConfigModule],
  controllers: [DisbursementsController, DisbursementWebhookController],
  providers: [DisbursementsService],
  exports: [DisbursementsService],
})
export class DisbursementsModule {}
