import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { SmsService } from './sms.service'
import { SmsController, SmsWebhookController } from './sms.controller'

@Module({
  imports: [ConfigModule],
  controllers: [SmsController, SmsWebhookController],
  providers: [SmsService],
  exports: [SmsService],
})
export class SmsModule {}
