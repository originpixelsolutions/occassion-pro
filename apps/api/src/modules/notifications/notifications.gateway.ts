/**
 * OccasionPro — Notifications WebSocket Gateway
 *
 * Socket.io gateway for real-time notification delivery.
 * Clients join a room named "notifications:{recipientId}" after authenticating.
 *
 * Events emitted to client:
 *   notification:new      → new notification payload
 *   notification:read     → { ids: string[] } — specific notifications marked read
 *   notification:read_all → {} — all notifications marked read
 *   notification:count    → { count: number } — updated unread count
 */

import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets'
import { Server, Socket } from 'socket.io'
import { Logger } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'

@WebSocketGateway({
  namespace: '/notifications',
  cors: {
    origin: process.env.FRONTEND_URL ?? '*',
    credentials: true,
  },
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  private server: Server

  private readonly logger = new Logger(NotificationsGateway.name)
  private readonly connectedClients = new Map<string, Set<string>>() // recipientId → Set<socketId>

  constructor(private readonly jwtService: JwtService) {}

  // ─── Connection lifecycle ───────────────────────────────────────────────────

  async handleConnection(client: Socket) {
    try {
      // Extract JWT from handshake auth or query
      const token =
        client.handshake.auth?.token ??
        client.handshake.query?.token

      if (!token) {
        client.disconnect(true)
        return
      }

      const payload = this.jwtService.verify(token as string)
      const recipientId: string = payload.sub

      if (!recipientId) {
        client.disconnect(true)
        return
      }

      // Join recipient-specific room
      const room = `notifications:${recipientId}`
      await client.join(room)

      // Track connection
      if (!this.connectedClients.has(recipientId)) {
        this.connectedClients.set(recipientId, new Set())
      }
      this.connectedClients.get(recipientId)!.add(client.id)

      // Attach recipientId to socket for disconnect cleanup
      client.data.recipientId = recipientId

      this.logger.debug(`Client ${client.id} connected → room ${room}`)
    } catch (err) {
      this.logger.warn(`Rejected WS connection: ${err}`)
      client.disconnect(true)
    }
  }

  handleDisconnect(client: Socket) {
    const recipientId: string = client.data?.recipientId
    if (recipientId) {
      const sockets = this.connectedClients.get(recipientId)
      if (sockets) {
        sockets.delete(client.id)
        if (sockets.size === 0) {
          this.connectedClients.delete(recipientId)
        }
      }
    }
    this.logger.debug(`Client ${client.id} disconnected`)
  }

  // ─── Client-initiated events ────────────────────────────────────────────────

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket) {
    client.emit('pong', { timestamp: Date.now() })
  }

  // ─── Server-side emit helpers ───────────────────────────────────────────────

  emitToRecipient(recipientId: string, event: string, data: unknown): void {
    const room = `notifications:${recipientId}`
    this.server.to(room).emit(event, data)
  }

  emitToTenant(tenantId: string, event: string, data: unknown): void {
    // Used for broadcast-to-all-team events (e.g., system maintenance)
    this.server.to(`tenant:${tenantId}`).emit(event, data)
  }

  isOnline(recipientId: string): boolean {
    return (this.connectedClients.get(recipientId)?.size ?? 0) > 0
  }

  getOnlineCount(): number {
    return this.connectedClients.size
  }
}
