import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common'
import { PlatformSettingsService } from '../platform-settings/platform-settings.service'

/**
 * AiApiEnabledGuard — applied to any endpoint that performs paid AI API calls
 * (OpenAI / Anthropic / LiteLLM).  Returns 403 when the platform-level
 * `ai_api_enabled` toggle is OFF.
 *
 * IMPORTANT: Rule-based smart features (health scores, budget alerts,
 * duplicate detection, smart seating, vendor conflict detection, etc.)
 * are NEVER gated by this guard — they always run regardless.
 */
@Injectable()
export class AiApiEnabledGuard implements CanActivate {
  constructor(private readonly platformSettings: PlatformSettingsService) {}

  async canActivate(_ctx: ExecutionContext): Promise<boolean> {
    const enabled = await this.platformSettings.isAiApiEnabled()
    if (!enabled) {
      throw new ForbiddenException({
        error: 'AI-powered features (LLM API calls) are not enabled on this platform. Contact your super admin.',
        code: 'AI_API_DISABLED',
      })
    }
    return true
  }
}

/** @deprecated use AiApiEnabledGuard */
export { AiApiEnabledGuard as AiEnabledGuard }
