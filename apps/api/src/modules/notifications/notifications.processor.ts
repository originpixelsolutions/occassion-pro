/**
 * OccasionPro — Notifications Queue Processor
 *
 * Processes delayed notification jobs from the 'notifications' BullMQ queue.
 * Replaces the in-process setTimeout approach so reminders survive restarts
 * and deployments.
 *
 * Queued by: NotificationsService.scheduleEventReminders()
 * Queue name: 'notifications'
 * Job name: 'send-reminder'
 */

import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Logger } from '@nestjs/common'
import { Job } from 'bullmq'
import { NotificationsService, RecipientType } from './notifications.service'

export interface SendReminderJobData {
  tenantId: string
  templateKey: string
  eventName: string
  eventStart: string
  recipientIds: string[]
}

@Processor('notifications')
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name)

  constructor(private readonly notifications: NotificationsService) {
    super()
  }

  async process(job: Job): Promise<void> {
    this.logger.log(`Processing job ${job.id} — name: ${job.name}`)

    if (job.name === 'send-reminder') {
      await this.handleSendReminder(job.data as SendReminderJobData)
    } else {
      this.logger.warn(`Unknown job name: ${job.name}`)
    }
  }

  private async handleSendReminder(data: SendReminderJobData): Promise<void> {
    const { tenantId, templateKey, eventName, eventStart, recipientIds } = data

    try {
      await this.notifications.sendBulkNotification({
        tenantId,
        templateKey,
        variables: {
          event_name: eventName,
          event_start: eventStart,
        },
        recipients: recipientIds.map(id => ({
          recipientType: 'team' as RecipientType,
          recipientId: id,
        })),
      })
      this.logger.log(
        `Reminder "${templateKey}" sent for ${recipientIds.length} recipients (tenant: ${tenantId})`,
      )
    } catch (err) {
      this.logger.error(`Failed to send reminder "${templateKey}": ${(err as Error).message}`)
      throw err // Re-throw so BullMQ retries the job
    }
  }
}
