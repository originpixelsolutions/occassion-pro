import { Module } from '@nestjs/common'
import { ClientPortalController, ClientPortalPublicController } from './client-portal.controller'
import { ClientPortalService } from './client-portal.service'
import { NotificationsModule } from '../notifications/notifications.module'

@Module({
  imports: [NotificationsModule],
  controllers: [ClientPortalController, ClientPortalPublicController],
  providers: [ClientPortalService],
  exports: [ClientPortalService],
})
export class ClientPortalModule {}
