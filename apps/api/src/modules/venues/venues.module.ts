import { Module } from '@nestjs/common'
import { VenuesController } from './venues.controller'
import { VenuesService } from './venues.service'
import { FloorPlansController } from './floor-plans/floor-plans.controller'
import { FloorPlansService } from './floor-plans/floor-plans.service'

@Module({
  controllers: [VenuesController, FloorPlansController],
  providers: [VenuesService, FloorPlansService],
  exports: [VenuesService],
})
export class VenuesModule {}
