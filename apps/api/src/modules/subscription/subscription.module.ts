import { Module, Global } from '@nestjs/common'
import { ScheduleModule } from '@nestjs/schedule'
import { SubscriptionController } from './subscription.controller'
import { SubscriptionService } from './subscription.service'
import { PlanEnforcementGuard } from './plan-enforcement.guard'
import { SubscriptionScheduler } from './subscription.scheduler'

@Global()
@Module({
  imports: [ScheduleModule],
  controllers: [SubscriptionController],
  providers: [SubscriptionService, PlanEnforcementGuard, SubscriptionScheduler],
  exports: [SubscriptionService, PlanEnforcementGuard],
})
export class SubscriptionModule {}
