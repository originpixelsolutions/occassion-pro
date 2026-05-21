import {
  Controller, Post, Get, Delete, Param, Body, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common'
import { CustomDomainsService } from './custom-domains.service'
import { AuthGuard } from '../../common/guards/auth.guard'

@Controller('tenants/:tenantId/custom-domain')
@UseGuards(AuthGuard)
export class CustomDomainsController {
  constructor(private readonly service: CustomDomainsService) {}

  // POST /tenants/:tenantId/custom-domain
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async addDomain(
    @Param('tenantId') tenantId: string,
    @Body('domain') domain: string,
  ) {
    return this.service.addDomain(tenantId, domain)
  }

  // GET /tenants/:tenantId/custom-domain
  @Get()
  async getDomainStatus(@Param('tenantId') tenantId: string) {
    return this.service.getDomainStatus(tenantId)
  }

  // POST /tenants/:tenantId/custom-domain/verify
  @Post('verify')
  @HttpCode(HttpStatus.OK)
  async verifyDomain(@Param('tenantId') tenantId: string) {
    return this.service.verifyDomain(tenantId)
  }

  // POST /tenants/:tenantId/custom-domain/check-ssl
  @Post('check-ssl')
  @HttpCode(HttpStatus.OK)
  async checkSsl(@Param('tenantId') tenantId: string) {
    await this.service.checkSslStatus(tenantId)
    return this.service.getDomainStatus(tenantId)
  }

  // DELETE /tenants/:tenantId/custom-domain
  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeDomain(@Param('tenantId') tenantId: string) {
    return this.service.removeDomain(tenantId)
  }
}
