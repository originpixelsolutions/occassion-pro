import {
  Controller, Get, Patch, Body, Param,
  UseGuards, HttpCode, HttpStatus, Query,
} from '@nestjs/common';
import { SystemSettingsService } from './system-settings.service';
import { UpdateSettingDto, BulkUpdateSettingsDto } from './dto/update-setting.dto';
import { JwtAuthGuard }       from '../auth/guards/jwt-auth.guard';
import { SuperAdminGuard }    from '../auth/guards/super-admin.guard';

@Controller('admin/system-settings')
@UseGuards(JwtAuthGuard, SuperAdminGuard)   // double-guard: JWT + super_admin role check
export class SystemSettingsController {
  constructor(private readonly svc: SystemSettingsService) {}

  /** GET /admin/system-settings
   *  Returns all settings. Sensitive values are masked (has_value: true/false).
   *  Pass ?reveal=1 to get actual values (logged separately for audit). */
  @Get()
  findAll(@Query('reveal') reveal?: string) {
    return this.svc.findAll(reveal === '1');
  }

  /** PATCH /admin/system-settings/:key
   *  Update a single setting. */
  @Patch(':key')
  @HttpCode(HttpStatus.OK)
  update(
    @Param('key') key: string,
    @Body() dto: UpdateSettingDto,
  ) {
    return this.svc.update(key, dto.value);
  }

  /** PATCH /admin/system-settings (bulk)
   *  Update multiple settings at once. */
  @Patch()
  @HttpCode(HttpStatus.NO_CONTENT)
  async bulkUpdate(@Body() dto: BulkUpdateSettingsDto) {
    await this.svc.bulkUpdate(dto.settings);
    this.svc.clearCache();
  }
}
