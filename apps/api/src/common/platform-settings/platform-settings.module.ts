import { Module, Global } from '@nestjs/common'
import { PlatformSettingsService } from './platform-settings.service'
import { SupabaseModule } from '../supabase/supabase.module'

@Global()
@Module({
  imports: [SupabaseModule],
  providers: [PlatformSettingsService],
  exports: [PlatformSettingsService],
})
export class PlatformSettingsModule {}
