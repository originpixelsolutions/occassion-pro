import { Module } from '@nestjs/common'
import { TenantPaymentsService } from './tenant-payments.service'
import { TenantPaymentsController } from './tenant-payments.controller'

@Module({
  controllers: [TenantPaymentsController],
  providers: [TenantPaymentsService],
  exports: [TenantPaymentsService],
})
export class TenantPaymentsModule {}
