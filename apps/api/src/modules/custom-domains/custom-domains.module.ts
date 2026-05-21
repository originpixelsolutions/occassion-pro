import { Module } from '@nestjs/common'
import { CustomDomainsController } from './custom-domains.controller'
import { CustomDomainsService } from './custom-domains.service'

@Module({
  controllers: [CustomDomainsController],
  providers:   [CustomDomainsService],
  exports:     [CustomDomainsService],
})
export class CustomDomainsModule {}
