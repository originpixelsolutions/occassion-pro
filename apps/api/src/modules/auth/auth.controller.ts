import { Controller, Post, Get, Put, Body, UseGuards, Req } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { Throttle, SkipThrottle } from '@nestjs/throttler'
import { AuthService } from './auth.service'
import { AuthGuard } from '../../common/guards/auth.guard'
import { Public } from '../../common/decorators/tenant.decorator'
import { CurrentUserId, AccessToken } from '../../common/decorators/tenant.decorator'

@ApiTags('Auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ── Rate-limited auth endpoints ──────────────────────────────────────────
  // auth tier: 5 req / 60s — prevents credential stuffing on login/signup

  @Public()
  @Throttle({ auth: { ttl: 60000, limit: 5 } })
  @Post('signup')
  signUp(
    @Req() req: any,
    @Body() dto: { email: string; password: string; full_name: string; tenant_slug?: string },
  ) {
    return this.authService.signUp(dto.email, dto.password, {
      full_name: dto.full_name,
      tenant_slug: dto.tenant_slug,
    }, req.ip)
  }

  @Public()
  @Throttle({ auth: { ttl: 60000, limit: 5 } })
  @Post('signin')
  signIn(
    @Req() req: any,
    @Body() dto: { email: string; password: string },
  ) {
    return this.authService.signIn(dto.email, dto.password, req.ip, req.headers?.['user-agent'])
  }

  @Public()
  @Throttle({ auth: { ttl: 60000, limit: 5 } })
  @Post('refresh')
  refresh(@Body() dto: { refresh_token: string }) {
    return this.authService.refreshToken(dto.refresh_token)
  }

  @Public()
  @Throttle({ auth: { ttl: 60000, limit: 5 } })
  @Post('forgot-password')
  forgotPassword(@Body() dto: { email: string }) {
    return this.authService.initiatePasswordReset(dto.email)
  }

  // ── Authenticated endpoints (skip extra throttling — JWT already required) ─

  @SkipThrottle()
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard)
  @Get('me')
  getMe(@CurrentUserId() u: string, @AccessToken() token: string) {
    return this.authService.getMe(u, token)
  }

  @SkipThrottle()
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard)
  @Put('me')
  updateProfile(
    @Body() dto: any,
    @CurrentUserId() u: string,
    @AccessToken() token: string,
  ) {
    return this.authService.updateProfile(u, dto, token)
  }

  @SkipThrottle()
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard)
  @Post('change-password')
  changePassword(
    @Body() dto: { new_password: string },
    @CurrentUserId() u: string,
  ) {
    return this.authService.changePassword(u, dto.new_password)
  }

  @SkipThrottle()
  @ApiBearerAuth('access-token')
  @UseGuards(AuthGuard)
  @Post('signout')
  signOut(@CurrentUserId() u: string) {
    return this.authService.signOut(u)
  }
}
