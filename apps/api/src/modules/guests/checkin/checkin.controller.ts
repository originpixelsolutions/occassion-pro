import { Controller, Get, Post, Param, Body, Query, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { CheckinService } from './checkin.service'
import { AuthGuard } from '../../../common/guards/auth.guard'
import { Public } from '../../../common/decorators/public.decorator'
import { TenantId, CurrentUserId, AccessToken } from '../../../common/decorators/tenant.decorator'

@ApiTags('Guests')
@ApiBearerAuth('access-token')
@Controller({ path: 'events/:eventId/checkin', version: '1' })
export class CheckinController {
  constructor(private readonly checkinService: CheckinService) {}

  @Get('stats')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Get real-time check-in statistics' })
  getLiveStats(
    @Param('eventId') eventId: string,
    @TenantId() tenantId: string,
    @AccessToken() token: string,
  ) {
    return this.checkinService.getLiveStats(eventId, tenantId, token)
  }

  @Post('scan')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Process a QR code scan (staff)' })
  scan(
    @Body('qrCode') qrCode: string,
    @Body('zoneId') zoneId: string | undefined,
    @CurrentUserId() userId: string,
    @AccessToken() token: string,
  ) {
    return this.checkinService.scanQrCode(qrCode, zoneId, userId, false, undefined, token)
  }

  @Post('kiosk/scan')
  @ApiOperation({ summary: 'Kiosk self-service QR scan (uses service token)' })
  kioskScan(
    @Body('qrCode') qrCode: string,
    @Body('zoneId') zoneId: string | undefined,
    @Body('deviceId') deviceId: string | undefined,
    @Body('serviceToken') serviceToken: string,
  ) {
    // Kiosk uses a long-lived service token issued per-device
    return this.checkinService.scanQrCode(qrCode, zoneId, undefined, true, deviceId, serviceToken)
  }
}
