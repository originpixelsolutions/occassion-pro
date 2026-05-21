import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import {
  RealtimeEventType,
  RealtimePayload,
  TaskUpdatePayload,
  RunsheetItemPayload,
  VendorAlertPayload,
  GuestCheckInPayload,
  CrowdMetricsPayload,
  BroadcastPayload,
  EmergencyAlertPayload,
} from './dto/realtime-events.dto';

@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);
  private server: Server;

  setServer(server: Server) {
    this.server = server;
  }

  private emit<T>(
    room: string,
    eventType: RealtimeEventType,
    data: T,
    tenantId: string,
    actor?: RealtimePayload['actor'],
  ) {
    if (!this.server) {
      this.logger.warn('WebSocket server not initialized');
      return;
    }

    const payload: RealtimePayload<T> = {
      eventType,
      eventId: room.replace('event:', ''),
      tenantId,
      data,
      actor,
      timestamp: new Date().toISOString(),
    };

    this.server.to(room).emit(eventType, payload);
    this.logger.debug(`[${room}] ${eventType}`);
  }

  // ─── Task Events ──────────────────────────────────────────────────────────

  emitTaskUpdate(
    eventId: string,
    tenantId: string,
    data: TaskUpdatePayload,
    actor?: RealtimePayload['actor'],
  ) {
    this.emit(`event:${eventId}`, RealtimeEventType.TASK_UPDATED, data, tenantId, actor);
  }

  emitTaskCreated(
    eventId: string,
    tenantId: string,
    data: TaskUpdatePayload,
    actor?: RealtimePayload['actor'],
  ) {
    this.emit(`event:${eventId}`, RealtimeEventType.TASK_CREATED, data, tenantId, actor);
  }

  emitTaskCompleted(
    eventId: string,
    tenantId: string,
    data: TaskUpdatePayload,
    actor?: RealtimePayload['actor'],
  ) {
    this.emit(`event:${eventId}`, RealtimeEventType.TASK_COMPLETED, data, tenantId, actor);
  }

  // ─── Runsheet Events ──────────────────────────────────────────────────────

  emitRunsheetItemStarted(
    eventId: string,
    tenantId: string,
    data: RunsheetItemPayload,
    actor?: RealtimePayload['actor'],
  ) {
    this.emit(`event:${eventId}`, RealtimeEventType.RUNSHEET_ITEM_STARTED, data, tenantId, actor);
  }

  emitRunsheetItemCompleted(
    eventId: string,
    tenantId: string,
    data: RunsheetItemPayload,
    actor?: RealtimePayload['actor'],
  ) {
    this.emit(
      `event:${eventId}`,
      RealtimeEventType.RUNSHEET_ITEM_COMPLETED,
      data,
      tenantId,
      actor,
    );
  }

  emitRunsheetItemDelayed(
    eventId: string,
    tenantId: string,
    data: RunsheetItemPayload,
    actor?: RealtimePayload['actor'],
  ) {
    this.emit(`event:${eventId}`, RealtimeEventType.RUNSHEET_ITEM_DELAYED, data, tenantId, actor);
  }

  // ─── Vendor Events ────────────────────────────────────────────────────────

  emitVendorArrived(
    eventId: string,
    tenantId: string,
    data: VendorAlertPayload,
    actor?: RealtimePayload['actor'],
  ) {
    this.emit(`event:${eventId}`, RealtimeEventType.VENDOR_ARRIVED, data, tenantId, actor);
  }

  emitVendorAlert(
    eventId: string,
    tenantId: string,
    data: VendorAlertPayload,
    actor?: RealtimePayload['actor'],
  ) {
    this.emit(`event:${eventId}`, RealtimeEventType.VENDOR_ALERT, data, tenantId, actor);
  }

  // ─── Guest Events ─────────────────────────────────────────────────────────

  emitGuestCheckedIn(
    eventId: string,
    tenantId: string,
    data: GuestCheckInPayload,
  ) {
    this.emit(`event:${eventId}`, RealtimeEventType.GUEST_CHECKED_IN, data, tenantId);
  }

  // ─── Crowd Metrics ────────────────────────────────────────────────────────

  emitCrowdMetrics(eventId: string, tenantId: string, data: CrowdMetricsPayload) {
    this.emit(`event:${eventId}`, RealtimeEventType.CROWD_METRICS, data, tenantId);
  }

  // ─── Command Center ───────────────────────────────────────────────────────

  emitBroadcast(
    eventId: string,
    tenantId: string,
    data: BroadcastPayload,
    actor?: RealtimePayload['actor'],
  ) {
    this.emit(`event:${eventId}`, RealtimeEventType.BROADCAST, data, tenantId, actor);
  }

  emitEmergencyAlert(
    eventId: string,
    tenantId: string,
    data: EmergencyAlertPayload,
    actor?: RealtimePayload['actor'],
  ) {
    this.emit(`event:${eventId}`, RealtimeEventType.EMERGENCY_ALERT, data, tenantId, actor);
  }

  // ─── Payment Events ───────────────────────────────────────────────────────

  emitPaymentReceived(
    eventId: string,
    tenantId: string,
    data: { invoiceId: string; amount: number; currency: string; payerName: string },
  ) {
    this.emit(`event:${eventId}`, RealtimeEventType.PAYMENT_RECEIVED, data, tenantId);
    // Also emit to tenant-wide room
    this.emit(`tenant:${tenantId}`, RealtimeEventType.PAYMENT_RECEIVED, data, tenantId);
  }

  // ─── Tenant-wide broadcast ────────────────────────────────────────────────

  emitToTenant<T>(tenantId: string, eventType: RealtimeEventType, data: T) {
    if (!this.server) return;
    const payload: RealtimePayload<T> = {
      eventType,
      eventId: '',
      tenantId,
      data,
      timestamp: new Date().toISOString(),
    };
    this.server.to(`tenant:${tenantId}`).emit(eventType, payload);
  }

  // ─── Room helpers ─────────────────────────────────────────────────────────

  getRoomSize(room: string): number {
    const sockets = this.server?.sockets?.adapter?.rooms?.get(room);
    return sockets?.size ?? 0;
  }

  getEventRoomSize(eventId: string): number {
    return this.getRoomSize(`event:${eventId}`);
  }
}
