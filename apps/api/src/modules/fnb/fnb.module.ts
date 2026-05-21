import { Module } from '@nestjs/common'
import { FnbService } from './fnb.service'
import { FnbController } from './fnb.controller'

@Module({
  controllers: [FnbController],
  providers: [FnbService],
  exports: [FnbService],
})
export class FnbModule {}
