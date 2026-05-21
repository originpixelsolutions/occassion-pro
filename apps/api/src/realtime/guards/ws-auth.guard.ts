import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { createClient } from '@supabase/supabase-js';
import { Socket } from 'socket.io';

@Injectable()
export class WsAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client: Socket = context.switchToWs().getClient();
    const token =
      client.handshake.auth?.token ||
      client.handshake.headers?.authorization?.replace('Bearer ', '');

    if (!token) {
      throw new WsException('Missing authentication token');
    }

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      throw new WsException('Invalid or expired token');
    }

    // Attach user and tenant to socket data
    const { data: memberData } = await supabase
      .from('user_roles')
      .select('tenant_id, role')
      .eq('user_id', data.user.id)
      .single();

    client.data.user = data.user;
    client.data.tenantId = memberData?.tenant_id;
    client.data.role = memberData?.role;

    return true;
  }
}
