import { Module } from '@nestjs/common'
import { GiftsService } from './gifts.service'
import { GiftsController } from './gifts.controller'
import { SupabaseModule } from '../../common/supabase/supabase.module'

@Module({
  imports: [SupabaseModule],
  controllers: [GiftsController],
  providers: [GiftsService],
  exports: [GiftsService],
})
export class GiftsModule {}
