import { Controller, Get, Post, Patch, Delete, Param, Body, Query, Headers, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { AuthGuard } from '../../common/guards/auth.guard'
import { DocumentsService } from './documents.service'

@ApiTags('Documents')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller({ path: 'documents', version: '1' })
export class DocumentsController {
  constructor(private readonly svc: DocumentsService) {}
  private tok(auth: string) { return auth?.replace('Bearer ', '') }

  @Get('events/:eventId')
  listDocuments(
    @Param('eventId') eventId: string,
    @Headers('authorization') auth: string,
    @Headers('x-tenant-id') tenantId: string,
    @Query('folder') folder?: string,
    @Query('type') type?: string,
    @Query('visibility') visibility?: string,
  ) { return this.svc.listDocuments(eventId, tenantId, this.tok(auth), { folder, type, visibility }) }

  @Get('events/:eventId/stats')
  getStats(@Param('eventId') eventId: string, @Headers('authorization') auth: string, @Headers('x-tenant-id') tenantId: string) {
    return this.svc.getStats(eventId, tenantId, this.tok(auth))
  }

  @Get(':id')
  getDocument(@Param('id') id: string, @Headers('authorization') auth: string, @Headers('x-tenant-id') tenantId: string) {
    return this.svc.getDocument(id, tenantId, this.tok(auth))
  }

  @Post()
  createDocument(@Headers('authorization') auth: string, @Headers('x-tenant-id') tenantId: string, @Body() body: any) {
    return this.svc.createDocument(tenantId, this.tok(auth), body)
  }

  @Post(':id/version')
  uploadNewVersion(@Param('id') id: string, @Headers('authorization') auth: string, @Headers('x-tenant-id') tenantId: string, @Body() body: any) {
    return this.svc.uploadNewVersion(id, tenantId, this.tok(auth), body)
  }

  @Patch(':id')
  updateDocument(@Param('id') id: string, @Headers('authorization') auth: string, @Headers('x-tenant-id') tenantId: string, @Body() body: any) {
    return this.svc.updateDocument(id, tenantId, this.tok(auth), body)
  }

  @Post(':id/approve')
  approveDocument(@Param('id') id: string, @Headers('authorization') auth: string, @Headers('x-tenant-id') tenantId: string, @Body() body: { status: string; approved_by?: string }) {
    return this.svc.approveDocument(id, tenantId, this.tok(auth), body)
  }

  @Delete(':id')
  deleteDocument(@Param('id') id: string, @Headers('authorization') auth: string, @Headers('x-tenant-id') tenantId: string) {
    return this.svc.deleteDocument(id, tenantId, this.tok(auth))
  }
}
