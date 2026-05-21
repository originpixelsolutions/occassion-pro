import { Module } from '@nestjs/common'
import { FloorPlanController } from './floor-plan.controller'
import { FloorPlanService } from './floor-plan.service'

@Module({
  controllers: [FloorPlanController],
  providers: [FloorPlanService],
  exports: [FloorPlanService],
})
export class FloorPlanModule {}
