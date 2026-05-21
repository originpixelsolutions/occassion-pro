import { Module } from '@nestjs/common'
import { DecorController } from './decor.controller'
import { DecorService } from './decor.service'
import { SupabaseModule } from '../../common/supabase/supabase.module'
import { AuthModule } from '../auth/auth.module'

@Module({
  imports: [SupabaseModule, AuthModule],
  controllers: [DecorController],
  providers: [DecorService],
  exports: [DecorService],
})
export class DecorModule {}
