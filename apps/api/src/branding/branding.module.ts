import { Module } from '@nestjs/common'
import { BrandingService } from './branding.service'
import { BrandingPublicController, BrandingAdminController } from './branding.controller'
import { SupabaseModule } from '../common/supabase/supabase.module'

@Module({
  imports: [SupabaseModule],
  providers: [BrandingService],
  controllers: [BrandingPublicController, BrandingAdminController],
  exports: [BrandingService],
})
export class BrandingModule {}
