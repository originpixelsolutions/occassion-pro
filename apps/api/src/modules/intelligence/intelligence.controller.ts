import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger'
import { IntelligenceService } from './intelligence.service'
import { AuthGuard } from '../../common/guards/auth.guard'
import { TenantId, CurrentUserId, AccessToken } from '../../common/decorators/tenant.decorator'
import { AlertSeverity } from './intelligence.types'

@ApiTags('Intelligence')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard)
@Controller({ version: '1' })
export class IntelligenceController {
  constructor(private readonly intelligenceService: IntelligenceService) {}

  // ─── Event-scoped endpoints ──────────────────────────────────────────────────

  @Get('events/:eventId/intelligence/alerts')
  @ApiOperation({ summary: 'Get active (non-dismissed) alerts for an event' })
  @ApiQuery({ name: 'severity', required: false, enum: ['info', 'warning', 'critical'] })
  getEventAlerts(
    @Param('eventId') eventId: string,
    @Query('severity') severity?: AlertSeverity,
  ) {
    return this.intelligenceService.getEventAlerts(eventId, severity)
  }

  @Post('events/:eventId/intelligence/alerts/:alertId/dismiss')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Dismiss an alert' })
  async dismissAlert(
    @Param('alertId') alertId: string,
    @CurrentUserId() userId: string,
  ) {
    await this.intelligenceService.dismissAlert(alertId, userId)
    return { success: true }
  }

  @Post('events/:eventId/intelligence/recompute')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Trigger manual health score recomputation for an event' })
  async recompute(@Param('eventId') eventId: string) {
    const score = await this.intelligenceService.computeHealthScore(eventId)
    return { message: 'Health score recomputed', score }
  }

  @Get('events/:eventId/intelligence/health-score')
  @ApiOperation({ summary: 'Get cached health score for an event (no recompute)' })
  async getHealthScore(@Param('eventId') eventId: string) {
    const score = await this.intelligenceService.getHealthScore(eventId)
    if (!score) {
      // Lazily compute on first request
      return this.intelligenceService.computeHealthScore(eventId)
    }
    return score
  }

  // ─── Tenant-scoped endpoints ─────────────────────────────────────────────────

  @Get('tenants/me/intelligence/alerts')
  @ApiOperation({ summary: 'Get all active alerts across all events for this tenant' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getTenantAlerts(
    @TenantId() tenantId: string,
    @Query('limit') limit?: number,
  ) {
    return this.intelligenceService.getTenantAlerts(tenantId, limit ? Number(limit) : 50)
  }
}
