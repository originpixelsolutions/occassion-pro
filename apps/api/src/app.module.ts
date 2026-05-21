import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { ThrottlerModule } from '@nestjs/throttler'
import { ScheduleModule } from '@nestjs/schedule'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { CacheModule } from '@nestjs/cache-manager'
import { BullModule } from '@nestjs/bullmq'
import { createKeyv } from '@keyv/redis'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { SupabaseModule } from './common/supabase/supabase.module'
import { AuthModule } from './modules/auth/auth.module'
import { TenantsModule } from './modules/tenants/tenants.module'
import { EventsModule } from './modules/events/events.module'
import { CrmModule } from './modules/crm/crm.module'
import { FinanceModule } from './modules/finance/finance.module'
import { VenuesModule } from './modules/venues/venues.module'
import { VendorsModule } from './modules/vendors/vendors.module'
import { GuestsModule } from './modules/guests/guests.module'
import { InventoryModule } from './modules/inventory/inventory.module'
import { MicrositesModule } from './modules/microsites/microsites.module'
import { TeamModule } from './modules/team/team.module'
import { AiModule } from './modules/ai/ai.module'
import { WebhooksModule } from './modules/webhooks/webhooks.module'
import { NotificationsModule } from './modules/notifications/notifications.module'
import { StorageModule } from './modules/storage/storage.module'
import { HealthModule } from './modules/health/health.module'
import { RealtimeModule } from './realtime/realtime.module'
import { GuestPortalModule } from './guest-portal/guest-portal.module'
import { AnalyticsModule } from './modules/analytics/analytics.module'
import { VendorPortalModule } from './vendor-portal/vendor-portal.module'
import { ShortLinksModule } from './modules/short-links/short-links.module'
import { EventTypesModule } from './modules/event-types/event-types.module'
import { AuditModule } from './modules/audit/audit.module'
import { SubscriptionModule } from './modules/subscription/subscription.module'
import { SuperAdminModule } from './super-admin/super-admin.module'
import { CommandCenterModule } from './modules/command-center/command-center.module'
import { ProductionModule } from './modules/production/production.module'
import { HospitalityModule } from './modules/hospitality/hospitality.module'
import { ArtistsModule } from './modules/artists/artists.module'
import { ClientPortalModule } from './modules/client-portal/client-portal.module'
import { WorkforceModule } from './modules/workforce/workforce.module'
import { MarketingModule } from './modules/marketing/marketing.module'
import { SupportModule } from './modules/support/support.module'
import { IntegrationsModule } from './modules/integrations/integrations.module'
import { DocumentsModule } from './modules/documents/documents.module'
import { PlaybooksModule } from './modules/playbooks/playbooks.module'
import { RbacModule } from './modules/rbac/rbac.module'
import appConfig from './config/app.config'
import supabaseConfig from './config/supabase.config'
import redisConfig from './config/redis.config'
import razorpayConfig from './config/razorpay.config'
import aiConfig from './config/ai.config'
import { BrandingModule } from './branding/branding.module'
import { PlatformSettingsModule } from './common/platform-settings/platform-settings.module'
import { FnbModule } from './modules/fnb/fnb.module'
import { TenantPaymentsModule } from './modules/tenant-payments/tenant-payments.module'
import { MessagingModule } from './modules/messaging/messaging.module'
import { PermitsModule } from './modules/permits/permits.module'
import { MediaModule } from './modules/media/media.module'
import { DecorModule } from './modules/decor/decor.module'
import { PrintingModule } from './modules/printing/printing.module'
import { SurveysModule } from './modules/surveys/surveys.module'
import { HealthSafetyModule } from './modules/health-safety/health-safety.module'
import { AutomationModule } from './modules/automation/automation.module'
import { PaymentModule } from './modules/payments/payment.module'
import { ExternalApiModule } from './modules/external-api/external-api.module'
import { GiftsModule } from './modules/gifts/gifts.module'
import { InvitationsModule } from './modules/invitations/invitations.module'
import { FloorPlanModule } from './modules/floor-plan/floor-plan.module'
import { RunsheetModule } from './modules/runsheet/runsheet.module'
import { ConferenceModule } from './modules/conference/conference.module'
import { PostEventModule } from './modules/post-event/post-event.module'
import { CommunicationsModule } from './modules/communications/communications.module'
import { IntelligenceModule } from './modules/intelligence/intelligence.module'
import { ExportsModule } from './modules/exports/exports.module'
import { CustomDomainsModule } from './modules/custom-domains/custom-domains.module'
import { FieldEncryptionModule } from './common/crypto/field-encryption.module'
import { SecurityModule } from './common/security/security.module'
import { DpdpModule } from './modules/dpdp/dpdp.module'
import { GstModule } from './modules/gst/gst.module'
import { AutomationsModule } from './modules/automations/automations.module'
import { SmsModule } from './modules/sms/sms.module'
import { WebsiteBuilderModule } from './modules/website-builder/website-builder.module'
import { DisbursementsModule } from './modules/disbursements/disbursements.module'
import { SystemSettingsModule } from './system-settings/system-settings.module'

@Module({
  imports: [
    BrandingModule,
    PlatformSettingsModule,
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      expandVariables: true,
      load: [appConfig, supabaseConfig, redisConfig, razorpayConfig, aiConfig],
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          // Default tier: 100 req / 60s per IP
          {
            name:  'default',
            ttl:   config.get<number>('THROTTLE_TTL', 60000),
            limit: config.get<number>('THROTTLE_LIMIT', 100),
          },
          // Auth tier: 5 req / 60s — applied with @Throttle({ auth: ... }) on auth controllers
          {
            name:  'auth',
            ttl:   60000,
            limit: 5,
          },
          // OTP/magic-link tier: 3 req / 15min — strictest for credential endpoints
          {
            name:  'otp',
            ttl:   900000, // 15 minutes
            limit: 3,
          },
        ],
      }),
    }),
    FieldEncryptionModule,
    SecurityModule,
    CacheModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        stores: [createKeyv(config.get<string>('redis.url', 'redis://localhost:6379'))],
        ttl: 300000,
      }),
    }),
    // ── BullMQ — job queue backed by Redis (same instance as cache) ───────────
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          url: config.get<string>('redis.url', 'redis://localhost:6379'),
        },
        defaultJobOptions: {
          removeOnComplete: 100,   // keep last 100 completed jobs for debugging
          removeOnFail: 500,       // keep last 500 failed jobs for diagnosis
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
        },
      }),
    }),
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot({ wildcard: true, delimiter: '.', maxListeners: 20 }),
    SupabaseModule,
    HealthModule,
    StorageModule,
    RealtimeModule,
    AuthModule,
    TenantsModule,
    EventsModule,
    CrmModule,
    FinanceModule,
    VenuesModule,
    VendorsModule,
    GuestsModule,
    InventoryModule,
    MicrositesModule,
    TeamModule,
    AiModule,
    WebhooksModule,
    NotificationsModule,
    GuestPortalModule,
    AnalyticsModule,
    VendorPortalModule,
    ShortLinksModule,
    EventTypesModule,
    AuditModule,
    SubscriptionModule,
    SuperAdminModule,
    CommandCenterModule,
    ProductionModule,
    HospitalityModule,
    ArtistsModule,
    ClientPortalModule,
    WorkforceModule,
    MarketingModule,
    SupportModule,
    IntegrationsModule,
    DocumentsModule,
    PlaybooksModule,
    RbacModule,
    FnbModule,
    TenantPaymentsModule,
    MessagingModule,
    PermitsModule,
    MediaModule,
    DecorModule,
    PrintingModule,
    SurveysModule,
    HealthSafetyModule,
    AutomationModule,
    PaymentModule,
    ExternalApiModule,
    GiftsModule,
    InvitationsModule,
    FloorPlanModule,
    RunsheetModule,
    ConferenceModule,
    PostEventModule,
    CommunicationsModule,
    IntelligenceModule,
    ExportsModule,
    CustomDomainsModule,
    DpdpModule,
    GstModule,
    AutomationsModule,
    SmsModule,
    WebsiteBuilderModule,
    DisbursementsModule,
    SystemSettingsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
