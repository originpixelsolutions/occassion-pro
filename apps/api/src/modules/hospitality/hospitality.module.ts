import { Module } from '@nestjs/common'
import { HospitalityController } from './hospitality.controller'
import { HospitalityService } from './hospitality.service'

@Module({
  controllers: [HospitalityController],
  providers: [HospitalityService],
  exports: [HospitalityService],
})
export class HospitalityModule {}
