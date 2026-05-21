import { Module } from '@nestjs/common'
import { LeadsController } from './leads/leads.controller'
import { LeadsService } from './leads/leads.service'
import { ContactsController } from './contacts/contacts.controller'
import { ContactsService } from './contacts/contacts.service'
import { ProposalsController } from './proposals/proposals.controller'
import { ProposalsService } from './proposals/proposals.service'

@Module({
  controllers: [LeadsController, ContactsController, ProposalsController],
  providers: [LeadsService, ContactsService, ProposalsService],
  exports: [LeadsService],
})
export class CrmModule {}
