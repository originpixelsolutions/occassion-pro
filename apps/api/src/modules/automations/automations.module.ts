import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { AutomationsService } from './automations.service'
import { AutomationsController } from './automations.controller'
import { CommunicationsModule } from '../communications/communications.module'

/**
 * AutomationsModule
 *
 * Provides a no-code trigger → action automation rules engine.
 *
 * ── Usage from other modules ────────────────────────────────────────────────
 *   @Module({ imports: [AutomationsModule] })
 *
 *   constructor(private readonly automations: AutomationsService) {}
 *
 *   // Fire from any service when something happens:
 *   await this.automations.fire('guest.rsvp_confirmed', tenantId, eventId, {
 *     'guest.name': guest.name,
 *     'guest.phone': guest.phone,
 *     'guest.email': guest.email,
 *     'guest.dietary': guest.dietary_requirement,
 *   })
 *
 * ── Supported trigger types ─────────────────────────────────────────────────
 *   guest.*  payment.*  task.*  vendor.*
 *   budget.*  event.*  whatsapp.*  manual.trigger
 *
 * ── Supported action types ──────────────────────────────────────────────────
 *   webhook.http  email.send  whatsapp.send  sms.send
 *   task.create  notification.internal  field.update
 *   delay.wait  condition.branch
 */
@Module({
  imports: [ConfigModule, CommunicationsModule],
  controllers: [AutomationsController],
  providers: [AutomationsService],
  exports: [AutomationsService],
})
export class AutomationsModule {}
