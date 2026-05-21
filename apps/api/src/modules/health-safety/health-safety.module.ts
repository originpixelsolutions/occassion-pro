import { Module } from '@nestjs/common'
import { HealthSafetyController } from './health-safety.controller'
import { HealthSafetyService } from './health-safety.service'

@Module({
  controllers: [HealthSafetyController],
  providers: [HealthSafetyService],
  exports: [HealthSafetyService],
})
export class HealthSafetyModule {}
