import { Module } from '@nestjs/common'
import { ConferenceService } from './conference.service'
import { ConferenceController } from './conference.controller'
import { SupabaseModule } from '../../common/supabase/supabase.module'

@Module({
  imports: [SupabaseModule],
  providers: [ConferenceService],
  controllers: [ConferenceController],
  exports: [ConferenceService],
})
export class ConferenceModule {}
