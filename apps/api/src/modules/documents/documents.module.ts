import { Module } from '@nestjs/common'
import { DocumentsController } from './documents.controller'
import { DocumentsService } from './documents.service'
import { SupabaseModule } from '../../common/supabase/supabase.module'
import { AuthModule } from '../auth/auth.module'

@Module({
  imports: [SupabaseModule, AuthModule],
  controllers: [DocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
