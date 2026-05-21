import { Module } from '@nestjs/common'
import { AiController } from './ai.controller'
import { AiService } from './ai.service'
import { AiWorkflowsService } from './ai-workflows.service'

@Module({
  controllers: [AiController],
  providers: [AiService, AiWorkflowsService],
  exports: [AiService, AiWorkflowsService],
})
export class AiModule {}
