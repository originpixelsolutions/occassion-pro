import { Injectable, Inject } from '@nestjs/common'
import { createServerClient, createServiceClient, TypedSupabaseClient } from '@occasionpro/database'

interface SupabaseConfig {
  url: string
  anonKey: string
  serviceRoleKey: string
}

@Injectable()
export class SupabaseService {
  private _serviceClient: TypedSupabaseClient | null = null

  constructor(@Inject('SUPABASE_CONFIG') private readonly config: SupabaseConfig) {}

  /**
   * Create a Supabase client using the user's JWT token from the Authorization header.
   * This client respects RLS policies — use for all user-facing operations.
   */
  forRequest(accessToken: string): TypedSupabaseClient {
    const client = createServerClient(this.config.url, this.config.anonKey)
    // Set the auth session so RLS resolves auth.uid() correctly
    client.auth.setSession({ access_token: accessToken, refresh_token: '' })
    return client
  }

  /**
   * Service-role client — bypasses RLS.
   * Use ONLY for server-side operations like webhooks, background jobs, admin tasks.
   */
  get serviceClient(): TypedSupabaseClient {
    if (!this._serviceClient) {
      this._serviceClient = createServiceClient(
        this.config.url,
        this.config.serviceRoleKey,
      )
    }
    return this._serviceClient
  }

  /**
   * Verify a Supabase JWT and return the user
   */
  async verifyToken(token: string) {
    const client = this.forRequest(token)
    const { data: { user }, error } = await client.auth.getUser(token)
    if (error || !user) return null
    return user
  }

  /**
   * Get a user's profile by their auth UID
   */
  async getProfile(userId: string) {
    const { data } = await this.serviceClient
      .from('profiles')
      .select('*, user_roles(role, is_active, tenant_id)')
      .eq('id', userId)
      .single()
    return data
  }
}
