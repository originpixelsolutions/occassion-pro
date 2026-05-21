import { Module, Global } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { SupabaseService } from './supabase.service'

@Global()
@Module({
  providers: [
    SupabaseService,
    {
      provide: 'SUPABASE_CONFIG',
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        url: config.getOrThrow<string>('supabase.url'),
        anonKey: config.getOrThrow<string>('supabase.anonKey'),
        serviceRoleKey: config.getOrThrow<string>('supabase.serviceRoleKey'),
      }),
    },
  ],
  exports: [SupabaseService],
})
export class SupabaseModule {}
