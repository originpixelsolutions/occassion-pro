export enum RealtimeEventType {
  // Task events
  TASK_CREATED = 'task:created',
  TASK_UPDATED = 'task:updated',
  TASK_COMPLETED = 'task:completed',
  TASK_ASSIGNED = 'task:assigned',

  // Runsheet events
  RUNSHEET_ITEM_STARTED = 'runsheet:item:started',
  RUNSHEET_ITEM_COMPLETED = 'runsheet:item:completed',
  RUNSHEET_ITEM_DELAYED = 'runsheet:item:delayed',
  RUNSHEET_UPDATED = 'runsheet:updated',

  // Vendor events
  VENDOR_ARRIVED = 'vendor:arrived',
  VENDOR_ALERT = 'vendor:alert',
  VENDOR_CONFIRMED = 'vendor:confirmed',

  // Guest events
  GUEST_CHECKED_IN = 'guest:checked_in',
  GUEST_BATCH_UPDATE = 'guest:batch_update',

  // Crowd / logistics
  CROWD_METRICS = 'crowd:metrics',
  LOGISTICS_ALERT = 'logistics:alert',

  // Command center
  BROADCAST = 'command:broadcast',
  EMERGENCY_ALERT = 'command:emergency',
  ALL_HANDS = 'command:all_hands',

  // Presence
  USER_JOINED = 'presence:joined',
  USER_LEFT = 'presence:left',
  PRESENCE_LIST = 'presence:list',

  // Financial
  PAYMENT_RECEIVED = 'payment:received',
  INVOICE_SENT = 'invoice:sent',
}

export interface RealtimePayload<T = unknown> {
  eventType: RealtimeEventType;
  eventId: string;
  tenantId: string;
  data: T;
  actor?: {
    userId: string;
    name: string;
    role: string;
  };
  timestamp: string;
}

export interface TaskUpdatePayload {
  taskId: string;
  title: string;
  status: string;
  assigneeId?: string;
  assigneeName?: string;
  priority?: string;
  dueAt?: string;
}

export interface RunsheetItemPayload {
  itemId: string;
  title: string;
  scheduledTime: string;
  actualTime?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'delayed' | 'skipped';
  delayMinutes?: number;
  notes?: string;
}

export interface VendorAlertPayload {
  vendorId: string;
  vendorName: string;
  category: string;
  alertType: 'arrival' | 'delay' | 'issue' | 'confirmed' | 'cancelled';
  message: string;
  estimatedArrival?: string;
}

export interface GuestCheckInPayload {
  guestId: string;
  guestName: string;
  tableNumber?: string;
  checkedInAt: string;
  totalCheckedIn: number;
  totalExpected: number;
}

export interface CrowdMetricsPayload {
  currentOccupancy: number;
  maxCapacity: number;
  checkInsLast10Min: number;
  checkInsTotal: number;
  peakTime?: string;
  occupancyPercent: number;
}

export interface BroadcastPayload {
  message: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  targetRoles?: string[];
  requiresAck: boolean;
}

export interface EmergencyAlertPayload {
  alertType: 'fire' | 'medical' | 'security' | 'weather' | 'evacuation' | 'general';
  message: string;
  instructions: string[];
  contactPerson: string;
  contactPhone: string;
}

export interface JoinEventRoomDto {
  eventId: string;
}

export interface LeaveEventRoomDto {
  eventId: string;
}

export interface SendBroadcastDto {
  eventId: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  targetRoles?: string[];
  requiresAck?: boolean;
}

export interface TriggerEmergencyDto {
  eventId: string;
  alertType: 'fire' | 'medical' | 'security' | 'weather' | 'evacuation' | 'general';
  message: string;
  instructions: string[];
  contactPerson: string;
  contactPhone: string;
}

export interface AckMessageDto {
  eventId: string;
  messageId: string;
}
