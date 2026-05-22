import { Module } from '@nestjs/common'
import { TeamController } from './team.controller'
import { TeamService } from './team.service'
import { TeamInvitationsController, InviteController } from './team-invitations.controller'
import { TeamInvitationsService } from './team-invitations.service'
import { NotificationsModule } from '../notifications/notifications.module'

@Module({
  imports: [NotificationsModule],
  controllers: [TeamController, TeamInvitationsController, InviteController],
  providers: [TeamService, TeamInvitationsService],
  exports: [TeamService, TeamInvitationsService],
})
export class TeamModule {}
