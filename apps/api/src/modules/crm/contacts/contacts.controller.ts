import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { ContactsService } from './contacts.service'
import { AuthGuard } from '../../../common/guards/auth.guard'
import { TenantId, CurrentUserId, AccessToken } from '../../../common/decorators/tenant.decorator'

@ApiTags('CRM')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard)
@Controller({ path: 'contacts', version: '1' })
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Get()
  findAll(@TenantId() tenantId: string, @AccessToken() token: string, @Query('page') page?: number, @Query('search') search?: string, @Query('companyId') companyId?: string) {
    return this.contactsService.findAll(tenantId, token, { page, search, companyId })
  }

  @Post()
  create(@Body() dto: any, @TenantId() tenantId: string, @CurrentUserId() userId: string, @AccessToken() token: string) {
    return this.contactsService.create({ ...dto, tenant_id: tenantId, created_by: userId }, token)
  }
}
