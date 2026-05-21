import { Module } from '@nestjs/common'
import { ClientPortalController } from './client-portal.controller'
import { ClientPortalService } from './client-portal.service'
import { ClientPortalAuthGuard } from './client-portal-auth.guard'

@Module({
  controllers: [ClientPortalController],
  providers: [ClientPortalService, ClientPortalAuthGuard],
  exports: [ClientPortalService, ClientPortalAuthGuard],
})
export class ClientPortalModule {}
