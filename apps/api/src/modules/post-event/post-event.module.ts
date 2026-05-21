import { Module } from '@nestjs/common'
import { SupabaseModule } from '../../common/supabase/supabase.module'
import { PostEventService } from './post-event.service'
import { PostEventController } from './post-event.controller'

@Module({
  imports: [SupabaseModule],
  providers: [PostEventService],
  controllers: [PostEventController],
  exports: [PostEventService],
})
export class PostEventModule {}
