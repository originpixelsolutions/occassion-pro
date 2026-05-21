import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { SupabaseService } from '../supabase/supabase.service'
import { IS_PUBLIC_KEY } from '../decorators/public.decorator'

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Skip auth for public routes
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) return true

    const request = context.switchToHttp().getRequest()
    const token = this.extractToken(request)
    if (!token) throw new UnauthorizedException('Missing access token')

    const user = await this.supabase.verifyToken(token)
    if (!user) throw new UnauthorizedException('Invalid or expired token')

    const profile = await this.supabase.getProfile(user.id)
    if (!profile) throw new UnauthorizedException('User profile not found')

    // Attach user and profile to request for downstream use
    request.user = user
    request.profile = profile
    request.accessToken = token

    return true
  }

  private extractToken(request: any): string | null {
    const authHeader = request.headers?.authorization as string
    if (!authHeader) return null
    const [type, token] = authHeader.split(' ')
    return type === 'Bearer' ? (token ?? null) : null
  }
}
