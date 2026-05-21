import {
  Injectable, CanActivate, ExecutionContext, SetMetadata, ForbiddenException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { SubscriptionService, PlanFeatureKey, PlanSlug } from './subscription.service'

// ── @RequireFeature ────────────────────────────────────────────────────────
// Blocks route if tenant's plan does not have the given feature enabled.
// Usage: @RequireFeature('ai_proposals')
export const REQUIRE_FEATURE = 'require_feature'
export const RequireFeature = (feature: PlanFeatureKey) => SetMetadata(REQUIRE_FEATURE, feature)

// ── @RequirePlan ───────────────────────────────────────────────────────────
// Blocks route if tenant's plan rank is below the required minimum.
// Usage: @RequirePlan('starter')   (allows starter | growth | agency)
//        @RequirePlan('growth')    (allows growth | agency)
export const REQUIRE_PLAN = 'require_plan'
export const RequirePlan = (minPlan: PlanSlug) => SetMetadata(REQUIRE_PLAN, minPlan)

const PLAN_RANK: Record<PlanSlug, number> = {
  free:    0,
  starter: 1,
  growth:  2,
  agency:  3,
}

@Injectable()
export class PlanEnforcementGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly subscriptionSvc: SubscriptionService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest()
    const tenantId = req.user?.tenantId
    if (!tenantId) return false

    // ── Feature check ──────────────────────────────────────────────────────
    const feature = this.reflector.getAllAndOverride<PlanFeatureKey>(REQUIRE_FEATURE, [
      ctx.getHandler(),
      ctx.getClass(),
    ])
    if (feature) {
      await this.subscriptionSvc.requireFeature(tenantId, feature)
    }

    // ── Plan rank check ────────────────────────────────────────────────────
    const minPlan = this.reflector.getAllAndOverride<PlanSlug>(REQUIRE_PLAN, [
      ctx.getHandler(),
      ctx.getClass(),
    ])
    if (minPlan) {
      const plan = await this.subscriptionSvc.getTenantPlan(tenantId)
      const currentSlug = (plan?.plan_slug ?? 'free') as PlanSlug
      const currentRank  = PLAN_RANK[currentSlug] ?? 0
      const required     = PLAN_RANK[minPlan] ?? 0
      if (currentRank < required) {
        throw new ForbiddenException(
          `This feature requires the ${minPlan.charAt(0).toUpperCase() + minPlan.slice(1)} plan or higher. Please upgrade your subscription.`
        )
      }
    }

    return true
  }
}
