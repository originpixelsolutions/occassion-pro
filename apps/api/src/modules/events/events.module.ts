import { NotificationsModule } from '../notifications/notifications.module'
import { Module } from '@nestjs/common'
import { EventsController } from './events.controller'
import { EventsService } from './events.service'
import { EventAccessController } from './event-access.controller'
import { EventAccessService } from './event-access.service'
import { TasksController } from './tasks/tasks.controller'
import { TasksService } from './tasks/tasks.service'
import { RunsheetController } from './runsheet/runsheet.controller'
import { RunsheetService } from './runsheet/runsheet.service'

@Module({
  imports: [NotificationsModule],
  controllers: [EventsController, EventAccessController, TasksController, RunsheetController],
  providers: [EventsService, EventAccessService, TasksService, RunsheetService],
  exports: [EventsService],
})
export class EventsModule {}
