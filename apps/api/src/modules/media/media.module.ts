import { Module } from '@nestjs/common'
import { MediaController } from './media.controller'
import { MediaService } from './media.service'
import { SupabaseModule } from '../../common/supabase/supabase.module'
import { AuthModule } from '../auth/auth.module'

@Module({
  imports: [SupabaseModule, AuthModule],
  controllers: [MediaController],
  providers: [MediaService],
  exports: [MediaService],
})
export class MediaModule {}
