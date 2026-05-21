import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { SubscriptionService } from './subscription.service'

@Injectable()
export class SubscriptionScheduler {
  private readonly logger = new Logger(SubscriptionScheduler.name)

  constructor(private readonly subscriptionSvc: SubscriptionService) {}

  /** Runs daily at 01:00 UTC — expire trials + downgrade to Free */
  @Cron('0 1 * * *', { name: 'expire_trials', timeZone: 'UTC' })
  async handleTrialExpiry() {
    this.logger.log('Running daily trial expiry check...')
    await this.subscriptionSvc.checkTrialExpiry()
  }

  /** Runs every 6 hours — refresh usage counters for active tenants */
  @Cron(CronExpression.EVERY_6_HOURS, { name: 'refresh_usage' })
  async handleUsageRefresh() {
    this.logger.debug('Usage refresh job skipped — handled by tenant-level triggers')
    // Individual tenant usage is refreshed on-demand via POST /subscription/refresh-usage
    // Full batch refresh can be added here if needed
  }
}
