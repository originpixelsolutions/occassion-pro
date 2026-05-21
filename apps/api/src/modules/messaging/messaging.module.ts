import { Module } from '@nestjs/common'
import { MessagingController } from './messaging.controller'
import { MessagingService } from './messaging.service'
import { SupabaseModule } from '../../common/supabase/supabase.module'
import { AuthModule } from '../auth/auth.module'

@Module({
  imports: [SupabaseModule, AuthModule],
  controllers: [MessagingController],
  providers: [MessagingService],
  exports: [MessagingService],
})
export class MessagingModule {}
