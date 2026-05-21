import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { WebsiteBuilderService } from './website-builder.service'
import { WebsiteBuilderController, PublicWebsiteController } from './website-builder.controller'

@Module({
  imports: [ConfigModule],
  controllers: [WebsiteBuilderController, PublicWebsiteController],
  providers: [WebsiteBuilderService],
  exports: [WebsiteBuilderService],
})
export class WebsiteBuilderModule {}
