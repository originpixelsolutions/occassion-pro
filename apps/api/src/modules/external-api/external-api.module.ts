import { Module } from '@nestjs/common'
import { ApiKeysService } from './api-keys.service'
import { WebhooksService } from './webhooks.service'
import { AccessRequestsService } from './access-requests.service'
import {
  ExternalApiController,
  SuperAdminApiKeysController,
} from './external-api.controller'
import { PublicApiV1Controller } from './public-api-v1.controller'
import { ApiKeyGuard } from './api-key.guard'
import { SupabaseModule } from '../../common/supabase/supabase.module'

@Module({
  imports: [SupabaseModule],
  controllers: [
    ExternalApiController,
    SuperAdminApiKeysController,
    PublicApiV1Controller,
  ],
  providers: [ApiKeysService, WebhooksService, AccessRequestsService, ApiKeyGuard],
  exports: [ApiKeysService, WebhooksService, AccessRequestsService, ApiKeyGuard],
})
export class ExternalApiModule {}
