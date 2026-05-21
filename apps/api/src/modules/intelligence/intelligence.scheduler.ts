import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { IntelligenceService } from './intelligence.service'

@Injectable()
export class IntelligenceScheduler {
  private readonly logger = new Logger(IntelligenceScheduler.name)

  constructor(private readonly intelligenceService: IntelligenceService) {}

  /**
   * Recompute health scores every 6 hours for all active events.
   * Runs at 00:00, 06:00, 12:00, 18:00 UTC daily.
   */
  @Cron('0 0,6,12,18 * * *')
  async handleScheduledRecompute(): Promise<void> {
    this.logger.log('Scheduled health score recomputation triggered')
    try {
      await this.intelligenceService.scheduleHealthRecompute()
    } catch (err) {
      this.logger.error('Scheduled recomputation failed', err)
    }
  }

  /**
   * Daily cleanup: remove expired alerts that were auto-expired.
   * Runs at 03:00 UTC.
   */
  @Cron('0 3 * * *')
  async handleExpiredAlertCleanup(): Promise<void> {
    this.logger.log('Cleaning up expired smart_alerts')
    // This is handled at the DB level via expires_at, but we log here for observability.
    // A full purge query would require service-client access — handled in IntelligenceService if needed.
  }
}
