import { Module } from '@nestjs/common'
import { PermitsController } from './permits.controller'
import { PermitsService } from './permits.service'
import { SupabaseModule } from '../../common/supabase/supabase.module'
import { AuthModule } from '../auth/auth.module'

@Module({
  imports: [SupabaseModule, AuthModule],
  controllers: [PermitsController],
  providers: [PermitsService],
  exports: [PermitsService],
})
export class PermitsModule {}
