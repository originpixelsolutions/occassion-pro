import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  ConnectedSocket,
  MessageBody,
  WsException,
} from '@nestjs/websockets';
import { UseGuards, Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { WsAuthGuard } from './guards/ws-auth.guard';
import { RealtimeService } from './realtime.service';
import {
  JoinEventRoomDto,
  LeaveEventRoomDto,
  SendBroadcastDto,
  TriggerEmergencyDto,
  AckMessageDto,
  RealtimeEventType,
} from './dto/realtime-events.dto';
import { createClient } from '@supabase/supabase-js';

interface PresenceUser {
  userId: string;
  name: string;
  role: string;
  avatar?: string;
  joinedAt: string;
  currentEventId?: string;
}

@WebSocketGateway({
  cors: {
    origin: process.env.WEB_URL || '*',
    credentials: true,
  },
  namespace: '/realtime',
  transports: ['websocket', 'polling'],
})
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(RealtimeGateway.name);
  // socketId → PresenceUser
  private readonly presenceMap = new Map<string, PresenceUser>();
  // eventId → Set<socketId>
  private readonly eventPresence = new Map<string, Set<string>>();

  constructor(private readonly realtimeService: RealtimeService) {}

  afterInit(server: Server) {
    this.realtimeService.setServer(server);
    this.logger.log('WebSocket Gateway initialized');
  }

  async handleConnection(client: Socket) {
    const token =
      client.handshake.auth?.token ||
      client.handshake.headers?.authorization?.replace('Bearer ', '');

    if (!token) {
      this.logger.warn(`Connection rejected: no token (${client.id})`);
      client.disconnect(true);
      return;
    }

    try {
      const supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
      );

      const { data, error } = await supabase.auth.getUser(token);
      if (error || !data.user) {
        client.disconnect(true);
        return;
      }

      const { data: member } = await supabase
        .from('user_roles')
        .select('tenant_id, role, users(full_name, avatar_url)')
        .eq('user_id', data.user.id)
        .single();

      client.data.userId = data.user.id;
      client.data.tenantId = member?.tenant_id;
      client.data.role = member?.role;
      client.data.name = (member?.users as any)?.full_name || data.user.email;

      // Join tenant-wide room for cross-event notifications
      if (member?.tenant_id) {
        await client.join(`tenant:${member.tenant_id}`);
      }

      // Track presence
      const presence: PresenceUser = {
        userId: data.user.id,
        name: client.data.name,
        role: member?.role || 'viewer',
        avatar: (member?.users as any)?.avatar_url,
        joinedAt: new Date().toISOString(),
      };
      this.presenceMap.set(client.id, presence);

      this.logger.log(`Connected: ${client.data.name} [${client.data.role}] (${client.id})`);
    } catch (err) {
      this.logger.error(`Auth error on connect: ${err.message}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    const presence = this.presenceMap.get(client.id);
    if (presence?.currentEventId) {
      this.removeFromEventPresence(client, presence.currentEventId);
    }
    this.presenceMap.delete(client.id);
    this.logger.log(`Disconnected: ${client.data?.name} (${client.id})`);
  }

  // ─── Room Management ──────────────────────────────────────────────────────

  @UseGuards(WsAuthGuard)
  @SubscribeMessage('join:event')
  async handleJoinEvent(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: JoinEventRoomDto,
  ) {
    const { eventId } = dto;
    const tenantId = client.data.tenantId;

    // Verify tenant owns this event
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    const { data: event } = await supabase
      .from('events')
      .select('id, name, status')
      .eq('id', eventId)
      .eq('tenant_id', tenantId)
      .single();

    if (!event) {
      throw new WsException('Event not found or access denied');
    }

    const room = `event:${eventId}`;
    await client.join(room);

    // Update presence
    const presence = this.presenceMap.get(client.id);
    if (presence) {
      // Leave previous event room if any
      if (presence.currentEventId && presence.currentEventId !== eventId) {
        this.removeFromEventPresence(client, presence.currentEventId);
      }
      presence.currentEventId = eventId;
    }

    // Track in event presence map
    if (!this.eventPresence.has(eventId)) {
      this.eventPresence.set(eventId, new Set());
    }
    this.eventPresence.get(eventId)!.add(client.id);

    // Broadcast presence update to room
    const presentUsers = this.getEventPresenceList(eventId);
    this.server.to(room).emit(RealtimeEventType.PRESENCE_LIST, {
      eventId,
      users: presentUsers,
      count: presentUsers.length,
    });

    // Notify others that user joined
    client.to(room).emit(RealtimeEventType.USER_JOINED, {
      userId: client.data.userId,
      name: client.data.name,
      role: client.data.role,
      joinedAt: new Date().toISOString(),
    });

    this.logger.log(`${client.data.name} joined event:${eventId}`);

    return {
      success: true,
      event: { id: event.id, name: event.name, status: event.status },
      presentUsers,
    };
  }

  @UseGuards(WsAuthGuard)
  @SubscribeMessage('leave:event')
  async handleLeaveEvent(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: LeaveEventRoomDto,
  ) {
    const { eventId } = dto;
    this.removeFromEventPresence(client, eventId);
    await client.leave(`event:${eventId}`);

    const presence = this.presenceMap.get(client.id);
    if (presence) {
      presence.currentEventId = undefined;
    }

    return { success: true };
  }

  // ─── Command Center ───────────────────────────────────────────────────────

  @UseGuards(WsAuthGuard)
  @SubscribeMessage('command:broadcast')
  async handleBroadcast(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: SendBroadcastDto,
  ) {
    // Only event managers and above can broadcast
    if (!['super_admin', 'company_admin', 'event_manager'].includes(client.data.role)) {
      throw new WsException('Insufficient permissions to broadcast');
    }

    this.realtimeService.emitBroadcast(dto.eventId, client.data.tenantId, {
      message: dto.message,
      priority: dto.priority,
      targetRoles: dto.targetRoles,
      requiresAck: dto.requiresAck ?? false,
    }, {
      userId: client.data.userId,
      name: client.data.name,
      role: client.data.role,
    });

    this.logger.log(
      `Broadcast by ${client.data.name} to event:${dto.eventId}: "${dto.message}"`,
    );

    return { success: true, broadcastAt: new Date().toISOString() };
  }

  @UseGuards(WsAuthGuard)
  @SubscribeMessage('command:emergency')
  async handleEmergency(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: TriggerEmergencyDto,
  ) {
    // Only admins and event managers can trigger emergency alerts
    if (!['super_admin', 'company_admin', 'event_manager'].includes(client.data.role)) {
      throw new WsException('Insufficient permissions');
    }

    this.logger.warn(
      `🚨 EMERGENCY ALERT by ${client.data.name}: ${dto.alertType} — ${dto.message}`,
    );

    this.realtimeService.emitEmergencyAlert(
      dto.eventId,
      client.data.tenantId,
      {
        alertType: dto.alertType,
        message: dto.message,
        instructions: dto.instructions,
        contactPerson: dto.contactPerson,
        contactPhone: dto.contactPhone,
      },
      {
        userId: client.data.userId,
        name: client.data.name,
        role: client.data.role,
      },
    );

    return { success: true, triggeredAt: new Date().toISOString() };
  }

  // ─── Task Real-time Updates ───────────────────────────────────────────────

  @UseGuards(WsAuthGuard)
  @SubscribeMessage('task:status')
  async handleTaskStatus(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    dto: { eventId: string; taskId: string; status: string; notes?: string },
  ) {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const { data: task, error } = await supabase
      .from('event_tasks')
      .update({
        status: dto.status,
        notes: dto.notes,
        updated_at: new Date().toISOString(),
        ...(dto.status === 'completed' ? { completed_at: new Date().toISOString() } : {}),
      })
      .eq('id', dto.taskId)
      .eq('event_id', dto.eventId)
      .select('id, title, status, assignee_id, priority')
      .single();

    if (error || !task) {
      throw new WsException('Task not found');
    }

    const eventType =
      dto.status === 'completed'
        ? RealtimeEventType.TASK_COMPLETED
        : RealtimeEventType.TASK_UPDATED;

    this.realtimeService.emitTaskUpdate(dto.eventId, client.data.tenantId, {
      taskId: task.id,
      title: task.title,
      status: task.status,
      assigneeId: task.assignee_id,
      priority: task.priority,
    }, {
      userId: client.data.userId,
      name: client.data.name,
      role: client.data.role,
    });

    return { success: true, task };
  }

  // ─── Runsheet Live Control ────────────────────────────────────────────────

  @UseGuards(WsAuthGuard)
  @SubscribeMessage('runsheet:advance')
  async handleRunsheetAdvance(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    dto: { eventId: string; itemId: string; status: string; notes?: string },
  ) {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const now = new Date().toISOString();
    const updates: Record<string, unknown> = {
      status: dto.status,
      updated_at: now,
    };

    if (dto.status === 'in_progress') updates.actual_start = now;
    if (dto.status === 'completed') updates.actual_end = now;
    if (dto.notes) updates.notes = dto.notes;

    const { data: item, error } = await supabase
      .from('runsheet_items')
      .update(updates)
      .eq('id', dto.itemId)
      .eq('event_id', dto.eventId)
      .select('id, title, scheduled_time, actual_start, status, duration_minutes')
      .single();

    if (error || !item) {
      throw new WsException('Runsheet item not found');
    }

    const eventType =
      dto.status === 'in_progress'
        ? RealtimeEventType.RUNSHEET_ITEM_STARTED
        : dto.status === 'completed'
        ? RealtimeEventType.RUNSHEET_ITEM_COMPLETED
        : RealtimeEventType.RUNSHEET_UPDATED;

    const room = `event:${dto.eventId}`;
    this.server.to(room).emit(eventType, {
      eventType,
      eventId: dto.eventId,
      tenantId: client.data.tenantId,
      data: {
        itemId: item.id,
        title: item.title,
        scheduledTime: item.scheduled_time,
        actualTime: item.actual_start,
        status: item.status,
      },
      actor: {
        userId: client.data.userId,
        name: client.data.name,
        role: client.data.role,
      },
      timestamp: now,
    });

    return { success: true, item };
  }

  // ─── Vendor Check-in ──────────────────────────────────────────────────────

  @UseGuards(WsAuthGuard)
  @SubscribeMessage('vendor:checkin')
  async handleVendorCheckin(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    dto: { eventId: string; vendorId: string; notes?: string },
  ) {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const { data: booking } = await supabase
      .from('vendor_event_assignments')
      .update({ arrival_confirmed: true, arrival_time: new Date().toISOString() })
      .eq('event_id', dto.eventId)
      .eq('vendor_id', dto.vendorId)
      .select('vendor_id, vendors(name, category)')
      .single();

    if (!booking) {
      throw new WsException('Vendor booking not found');
    }

    this.realtimeService.emitVendorArrived(dto.eventId, client.data.tenantId, {
      vendorId: dto.vendorId,
      vendorName: (booking.vendors as any)?.name,
      category: (booking.vendors as any)?.category,
      alertType: 'arrival',
      message: `${(booking.vendors as any)?.name} has arrived`,
    });

    return { success: true };
  }

  // ─── Presence Ping ────────────────────────────────────────────────────────

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket) {
    return { pong: true, serverTime: new Date().toISOString() };
  }

  @UseGuards(WsAuthGuard)
  @SubscribeMessage('presence:list')
  handlePresenceList(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: { eventId: string },
  ) {
    const users = this.getEventPresenceList(dto.eventId);
    return { eventId: dto.eventId, users, count: users.length };
  }

  // ─── Ack ──────────────────────────────────────────────────────────────────

  @UseGuards(WsAuthGuard)
  @SubscribeMessage('ack')
  handleAck(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: AckMessageDto,
  ) {
    const room = `event:${dto.eventId}`;
    client.to(room).emit('ack:received', {
      messageId: dto.messageId,
      ackedBy: { userId: client.data.userId, name: client.data.name },
      ackedAt: new Date().toISOString(),
    });
    return { success: true };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private removeFromEventPresence(client: Socket, eventId: string) {
    const room = `event:${eventId}`;
    const eventSockets = this.eventPresence.get(eventId);
    if (eventSockets) {
      eventSockets.delete(client.id);
      if (eventSockets.size === 0) {
        this.eventPresence.delete(eventId);
      }
    }

    // Notify others
    client.to(room).emit(RealtimeEventType.USER_LEFT, {
      userId: client.data.userId,
      name: client.data.name,
      leftAt: new Date().toISOString(),
    });
  }

  private getEventPresenceList(eventId: string): PresenceUser[] {
    const socketIds = this.eventPresence.get(eventId);
    if (!socketIds) return [];

    const users: PresenceUser[] = [];
    for (const socketId of socketIds) {
      const presence = this.presenceMap.get(socketId);
      if (presence) users.push(presence);
    }
    return users;
  }
}
