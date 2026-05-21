import { Module } from '@nestjs/common'
import { RunsheetService } from './runsheet.service'
import { RunsheetController } from './runsheet.controller'
import { RunsheetGateway } from './runsheet.gateway'
import { SupabaseModule } from '../../common/supabase/supabase.module'
import { NotificationsModule } from '../notifications/notifications.module'

@Module({
  imports: [SupabaseModule, NotificationsModule],
  providers: [RunsheetService, RunsheetGateway],
  controllers: [RunsheetController],
  exports: [RunsheetService],
})
export class RunsheetModule {}
