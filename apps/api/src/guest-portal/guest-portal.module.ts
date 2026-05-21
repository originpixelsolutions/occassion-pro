import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { GuestPortalController } from './guest-portal.controller'
import { GuestPortalService } from './guest-portal.service'
import { SMSService } from './sms.service'

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET', 'changeme'),
        signOptions: { expiresIn: '7d' },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [GuestPortalController],
  providers: [GuestPortalService, SMSService],
  exports: [GuestPortalService, SMSService],
})
export class GuestPortalModule {}
