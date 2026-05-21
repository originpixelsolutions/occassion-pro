import { Controller, Get } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { Public } from '../../common/decorators/tenant.decorator'
import { SupabaseService } from '../../common/supabase/supabase.service'

@ApiTags('Health')
@Controller({ path: 'health', version: '1' })
export class HealthController {
  constructor(private readonly supabase: SupabaseService) {}

  @Public()
  @Get()
  async check() {
    const start = Date.now()
    let dbStatus = 'ok'
    let dbLatency = 0

    try {
      const t = Date.now()
      await this.supabase.serviceClient.from('tenants').select('id').limit(1)
      dbLatency = Date.now() - t
    } catch {
      dbStatus = 'error'
    }

    return {
      status: dbStatus === 'ok' ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version ?? '1.0.0',
      checks: {
        database: { status: dbStatus, latency_ms: dbLatency },
        api: { status: 'ok', latency_ms: Date.now() - start },
      },
    }
  }

  @Public()
  @Get('ready')
  ready() {
    return { ready: true }
  }

  @Public()
  @Get('live')
  live() {
    return { alive: true }
  }
}
