import { Controller, Post, Delete, Param, Body, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { StorageService, StorageBucket } from './storage.service'
import { AuthGuard } from '../../common/guards/auth.guard'
import { TenantId, AccessToken } from '../../common/decorators/tenant.decorator'

@ApiTags('Storage')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard)
@Controller({ path: 'storage', version: '1' })
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post('upload-url')
  getUploadUrl(
    @Body() dto: { bucket: StorageBucket; filename: string; content_type: string },
    @TenantId() t: string,
  ) {
    return this.storageService.getUploadUrl({
      bucket: dto.bucket,
      tenantId: t,
      filename: `${Date.now()}_${dto.filename}`,
      contentType: dto.content_type,
    })
  }

  @Post('download-url')
  getDownloadUrl(@Body() dto: { key: string }) {
    return this.storageService.getDownloadUrl(dto.key).then((url) => ({ url }))
  }

  @Delete(':key')
  deleteFile(@Param('key') key: string) {
    return this.storageService.deleteFile(decodeURIComponent(key)).then(() => ({ deleted: true }))
  }
}
