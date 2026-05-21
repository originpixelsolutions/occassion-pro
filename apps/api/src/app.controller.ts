import { Controller, Get } from '@nestjs/common'
import { ApiTags, ApiOperation } from '@nestjs/swagger'
import { AppService } from './app.service'

@ApiTags('System')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'API root — version and status' })
  getRoot() {
    return this.appService.getStatus()
  }

  @Get('health')
  @ApiOperation({ summary: 'Health check — used by Railway, Kubernetes, and load balancers' })
  healthCheck() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? 'unknown',
    }
  }
}
