import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets'
import { Server, Socket } from 'socket.io'
import { OnEvent } from '@nestjs/event-emitter'
import { Logger } from '@nestjs/common'

interface PresenceUser {
  userId: string
  userName: string
  avatar?: string
  color: string
  activeItemId?: string
  joinedAt: number
}

// Pool of colors for user presence
const PRESENCE_COLORS = [
  '#3b82f6', '#8b5cf6', '#ec4899', '#10b981',
  '#f59e0b', '#ef4444', '#06b6d4', '#84cc16',
]

@WebSocketGateway({
  namespace: 'runsheet',
  cors: { origin: '*' },
})
export class RunsheetGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server

  private logger = new Logger('RunsheetGateway')

  // room → Map<socketId, PresenceUser>
  private rooms = new Map<string, Map<string, PresenceUser>>()

  // ─── Connection ────────────────────────────────────────────────────────────
  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`)
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`)

    // Remove from all rooms and broadcast presence update
    for (const [room, users] of this.rooms.entries()) {
      if (users.has(client.id)) {
        const user = users.get(client.id)
        users.delete(client.id)
        this.broadcastPresence(room)
        this.server.to(room).emit('user_left', { userId: user?.userId })
        if (users.size === 0) this.rooms.delete(room)
      }
    }
  }

  // ─── Join runsheet room ────────────────────────────────────────────────────
  @SubscribeMessage('join_runsheet')
  handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { runsheetId: string; userId: string; userName: string; avatar?: string },
  ) {
    const room = `runsheet:${data.runsheetId}`
    client.join(room)

    if (!this.rooms.has(room)) this.rooms.set(room, new Map())
    const users = this.rooms.get(room)!

    // Assign a color based on existing users count
    const color = PRESENCE_COLORS[users.size % PRESENCE_COLORS.length]

    users.set(client.id, {
      userId: data.userId,
      userName: data.userName,
      avatar: data.avatar,
      color,
      joinedAt: Date.now(),
    })

    // Send current presence to joining user
    client.emit('presence_sync', this.getPresenceList(room))

    // Broadcast updated presence to everyone
    this.broadcastPresence(room)

    client.emit('joined', { room, color })
    this.logger.log(`${data.userName} joined ${room}`)
  }

  // ─── Leave runsheet room ───────────────────────────────────────────────────
  @SubscribeMessage('leave_runsheet')
  handleLeave(@ConnectedSocket() client: Socket, @MessageBody() data: { runsheetId: string }) {
    const room = `runsheet:${data.runsheetId}`
    client.leave(room)

    const users = this.rooms.get(room)
    if (users) {
      const user = users.get(client.id)
      users.delete(client.id)
      this.broadcastPresence(room)
      this.server.to(room).emit('user_left', { userId: user?.userId })
    }
  }

  // ─── Cursor / focus move ───────────────────────────────────────────────────
  @SubscribeMessage('cursor_move')
  handleCursorMove(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { runsheetId: string; itemId: string | null },
  ) {
    const room = `runsheet:${data.runsheetId}`
    const users = this.rooms.get(room)

    if (users && users.has(client.id)) {
      const user = users.get(client.id)!
      user.activeItemId = data.itemId ?? undefined
      users.set(client.id, user)

      // Broadcast cursor position to others (not self)
      client.to(room).emit('cursor_updated', {
        userId: user.userId,
        itemId: data.itemId,
        color: user.color,
      })
    }
  }

  // ─── Typing indicator ─────────────────────────────────────────────────────
  @SubscribeMessage('typing')
  handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { runsheetId: string; itemId: string; field: string },
  ) {
    const room = `runsheet:${data.runsheetId}`
    const users = this.rooms.get(room)

    if (users && users.has(client.id)) {
      const user = users.get(client.id)!
      client.to(room).emit('user_typing', {
        userId: user.userId,
        userName: user.userName,
        color: user.color,
        itemId: data.itemId,
        field: data.field,
      })
    }
  }

  // ─── Event-driven broadcasts (from RunsheetService via EventEmitter) ───────
  @OnEvent('runsheet.item_created')
  handleItemCreated(payload: { runsheetId: string; item: any; userId: string }) {
    this.server.to(`runsheet:${payload.runsheetId}`).emit('item_created', {
      item: payload.item,
      by: payload.userId,
    })
  }

  @OnEvent('runsheet.item_updated')
  handleItemUpdated(payload: { runsheetId: string; item: any; userId: string }) {
    this.server.to(`runsheet:${payload.runsheetId}`).emit('item_updated', {
      item: payload.item,
      by: payload.userId,
    })
  }

  @OnEvent('runsheet.item_deleted')
  handleItemDeleted(payload: { runsheetId: string; itemId: string; userId: string }) {
    this.server.to(`runsheet:${payload.runsheetId}`).emit('item_deleted', {
      itemId: payload.itemId,
      by: payload.userId,
    })
  }

  @OnEvent('runsheet.item_status_changed')
  handleStatusChanged(payload: {
    runsheetId: string
    itemId: string
    status: string
    delayMinutes?: number
    userId: string
  }) {
    this.server.to(`runsheet:${payload.runsheetId}`).emit('item_status_changed', {
      itemId: payload.itemId,
      status: payload.status,
      delayMinutes: payload.delayMinutes,
      by: payload.userId,
    })
  }

  @OnEvent('runsheet.reordered')
  handleReordered(payload: { runsheetId: string; items: any[]; userId: string }) {
    this.server.to(`runsheet:${payload.runsheetId}`).emit('items_reordered', {
      items: payload.items,
      by: payload.userId,
    })
  }

  @OnEvent('runsheet.locked')
  handleLocked(payload: { runsheetId: string; userId: string }) {
    this.server.to(`runsheet:${payload.runsheetId}`).emit('runsheet_locked', {
      by: payload.userId,
    })
  }

  @OnEvent('runsheet.unlocked')
  handleUnlocked(payload: { runsheetId: string; userId: string }) {
    this.server.to(`runsheet:${payload.runsheetId}`).emit('runsheet_unlocked', {
      by: payload.userId,
    })
  }

  @OnEvent('runsheet.restored')
  handleRestored(payload: { runsheetId: string; versionId: string; userId: string }) {
    this.server.to(`runsheet:${payload.runsheetId}`).emit('runsheet_restored', {
      versionId: payload.versionId,
      by: payload.userId,
    })
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────
  private getPresenceList(room: string): PresenceUser[] {
    const users = this.rooms.get(room)
    if (!users) return []
    return Array.from(users.values())
  }

  private broadcastPresence(room: string) {
    this.server.to(room).emit('presence_updated', this.getPresenceList(room))
  }
}
