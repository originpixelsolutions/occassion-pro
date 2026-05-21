import { Module } from '@nestjs/common'
import { WebhooksController, InternalWebhooksController } from './webhooks.controller'
import { WebhooksService } from './webhooks.service'

@Module({
  controllers: [WebhooksController, InternalWebhooksController],
  providers: [WebhooksService],
  exports: [WebhooksService],
})
export class WebhooksModule {}
