import { Module } from '@nestjs/common'
import { MicrositesController, PublicMicrositesController, StandaloneMicrositesController } from './microsites.controller'
import { MicrositesService } from './microsites.service'
import { TicketingService } from './ticketing/ticketing.service'
import { RazorpayService } from '../finance/razorpay/razorpay.service'
import { MicrositeV2Service } from './microsite-v2.service'
import { MicrositeV2Controller, MicrositePublicController } from './microsite-v2.controller'

@Module({
  controllers: [
    MicrositesController,
    PublicMicrositesController,
    StandaloneMicrositesController,
    MicrositeV2Controller,
    MicrositePublicController,
  ],
  providers: [MicrositesService, TicketingService, RazorpayService, MicrositeV2Service],
  exports: [MicrositesService, TicketingService, MicrositeV2Service],
})
export class MicrositesModule {}
