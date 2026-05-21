import { Module } from '@nestjs/common'
import { GstService } from './gst.service'
import { GstController } from './gst.controller'
import { SupabaseModule } from '../../common/supabase/supabase.module'

@Module({
  imports: [SupabaseModule],
  providers: [GstService],
  controllers: [GstController],
  exports: [GstService],
})
export class GstModule {}
