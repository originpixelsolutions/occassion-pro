import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common'
import { PlatformSettingsService } from '../platform-settings/platform-settings.service'

/**
 * AiEnabledGuard — applies to any controller/endpoint that provides AI-powered features.
 * Returns 403 when the platform-level ai_enabled toggle is OFF.
 */
@Injectable()
export class AiEnabledGuard implements CanActivate {
  constructor(private readonly platformSettings: PlatformSettingsService) {}

  async canActivate(_ctx: ExecutionContext): Promise<boolean> {
    const enabled = await this.platformSettings.isAiEnabled()
    if (!enabled) {
      throw new ForbiddenException({
        error: 'AI features are not enabled on this platform',
        code: 'AI_DISABLED',
      })
    }
    return true
  }
}
