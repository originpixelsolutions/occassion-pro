import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { NotificationsService } from './notifications.service'
import { NotificationsController } from './notifications.controller'
import { NotificationsGateway } from './notifications.gateway'
import { NotificationsProcessor } from './notifications.processor'
import { CommunicationsModule } from '../communications/communications.module'

@Module({
  imports: [
    CommunicationsModule,
    // Register the 'notifications' queue for delayed reminder jobs
    BullModule.registerQueue({
      name: 'notifications',
    }),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsGateway, NotificationsProcessor],
  exports: [NotificationsService],
})
export class NotificationsModule {}
