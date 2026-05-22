import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { JwtModule } from '@nestjs/jwt'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { NotificationsService } from './notifications.service'
import { NotificationsController } from './notifications.controller'
import { NotificationsGateway } from './notifications.gateway'
import { NotificationsProcessor } from './notifications.processor'
import { CommunicationsModule } from '../communications/communications.module'

@Module({
  imports: [
    CommunicationsModule,
    // Register the 'notifications' queue for delayed reminder jobs
    BullModule.registerQueue({
      name: 'notifications',
    }),
    // JwtModule so NotificationsGateway can verify socket auth tokens
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get('SUPABASE_JWT_SECRET') ?? config.get('JWT_SECRET', 'changeme'),
        signOptions: { expiresIn: '7d' },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsGateway, NotificationsProcessor],
  exports: [NotificationsService],
})
export class NotificationsModule {}
