import { Module } from '@nestjs/common'
import { ScheduleModule } from '@nestjs/schedule'
import { IntelligenceService } from './intelligence.service'
import { IntelligenceController } from './intelligence.controller'
import { IntelligenceScheduler } from './intelligence.scheduler'
import { NotificationsModule } from '../notifications/notifications.module'

@Module({
  imports: [
    ScheduleModule.forRoot(), // idempotent — safe to call multiple times in NestJS
    NotificationsModule,
  ],
  controllers: [IntelligenceController],
  providers: [IntelligenceService, IntelligenceScheduler],
  exports: [IntelligenceService], // exportable so other services can call computeAlerts reactively
})
export class IntelligenceModule {}
