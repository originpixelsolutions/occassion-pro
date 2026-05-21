import { Module } from '@nestjs/common'
import { VendorPortalController } from './vendor-portal.controller'
import { VendorPortalAuthService } from './vendor-portal-auth.service'
import { VendorPortalService } from './vendor-portal.service'
import { VendorPortalAuthGuard } from './vendor-portal-auth.guard'

@Module({
  controllers: [VendorPortalController],
  providers: [VendorPortalAuthService, VendorPortalService, VendorPortalAuthGuard],
  exports: [VendorPortalService, VendorPortalAuthGuard],
})
export class VendorPortalModule {}
