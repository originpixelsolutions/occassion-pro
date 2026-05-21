import { Module } from '@nestjs/common'
import { VendorsController, EventVendorsController } from './vendors.controller'
import { VendorsService } from './vendors.service'
import { ContractsController, EventContractsController } from './contracts/contracts.controller'
import { ContractsService } from './contracts/contracts.service'

@Module({
  controllers: [VendorsController, EventVendorsController, ContractsController, EventContractsController],
  providers: [VendorsService, ContractsService],
  exports: [VendorsService],
})
export class VendorsModule {}
