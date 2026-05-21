import { Module } from '@nestjs/common'
import { SuperAdminController } from './super-admin.controller'
import { SuperAdminService } from './super-admin.service'
import { AutomationModule } from '../modules/automation/automation.module'
import { PlatformSettingsModule } from '../common/platform-settings/platform-settings.module'

@Module({
  imports: [AutomationModule, PlatformSettingsModule],
  controllers: [SuperAdminController],
  providers: [SuperAdminService],
  exports: [SuperAdminService],
})
export class SuperAdminModule {}
