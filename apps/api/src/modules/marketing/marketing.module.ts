import { Module } from '@nestjs/common'
import { MarketingController, MarketingPublicController } from './marketing.controller'
import { MarketingService } from './marketing.service'

@Module({
  controllers: [MarketingController, MarketingPublicController],
  providers: [MarketingService],
  exports: [MarketingService],
})
export class MarketingModule {}
