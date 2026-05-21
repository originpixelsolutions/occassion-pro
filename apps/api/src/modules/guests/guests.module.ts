import { Module } from '@nestjs/common'
import { NotificationsModule } from '../notifications/notifications.module'
import { GuestsController, StandaloneGuestsController } from './guests.controller'
import { GuestsService } from './guests.service'
import { CheckinController } from './checkin/checkin.controller'
import { CheckinService } from './checkin/checkin.service'
import { BadgesController } from './badges/badges.controller'
import { BadgesService } from './badges/badges.service'
import { GuestsAdvancedController } from './guests-advanced.controller'
import { GuestsAdvancedService } from './guests-advanced.service'
import { InvitationController, PublicInvitationController } from './invitation/invitation.controller'
import { InvitationService } from './invitation/invitation.service'
import { RsvpController, PublicRsvpController } from './rsvp/rsvp.controller'
import { RsvpService } from './rsvp/rsvp.service'
import { RegistrationController, PublicRegistrationController } from './registration/registration.controller'
import { RegistrationService } from './registration/registration.service'
import { AccommodationController } from './accommodation/accommodation.controller'
import { AccommodationService } from './accommodation/accommodation.service'
import { GuestImportController } from './import/guest-import.controller'
import { GuestImportService } from './import/guest-import.service'
import { TableConfigController, PublicTableViewController } from './table-config/table-config.controller'
import { TableConfigService } from './table-config/table-config.service'

@Module({
  imports: [NotificationsModule],
  controllers: [
    GuestsController,
    StandaloneGuestsController,
    CheckinController,
    BadgesController,
    GuestsAdvancedController,
    InvitationController,
    PublicInvitationController,
    RsvpController,
    PublicRsvpController,
    RegistrationController,
    PublicRegistrationController,
    AccommodationController,
    GuestImportController,
    TableConfigController,
    PublicTableViewController,
  ],
  providers: [
    GuestsService,
    CheckinService,
    BadgesService,
    GuestsAdvancedService,
    InvitationService,
    RsvpService,
    RegistrationService,
    AccommodationService,
    GuestImportService,
    TableConfigService,
  ],
  exports: [GuestsService, RsvpService],
})
export class GuestsModule {}
