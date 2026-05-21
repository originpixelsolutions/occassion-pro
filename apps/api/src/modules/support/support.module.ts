import { Module } from '@nestjs/common'
import { SupportController } from './support.controller'
import { SupportService } from './support.service'
import { SupportBotService } from './support-bot.service'
import { PlatformSupportService } from './platform-support.service'
import {
  PlatformSupportController,
  SuperAdminSupportController,
} from './platform-support.controller'

@Module({
  controllers: [
    SupportController,
    PlatformSupportController,
    SuperAdminSupportController,
  ],
  providers: [
    SupportService,
    SupportBotService,
    PlatformSupportService,
  ],
  exports: [SupportService, SupportBotService, PlatformSupportService],
})
export class SupportModule {}
