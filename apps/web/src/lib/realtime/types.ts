export enum RealtimeEventType {
  TASK_CREATED = 'task:created',
  TASK_UPDATED = 'task:updated',
  TASK_COMPLETED = 'task:completed',
  TASK_ASSIGNED = 'task:assigned',
  RUNSHEET_ITEM_STARTED = 'runsheet:item:started',
  RUNSHEET_ITEM_COMPLETED = 'runsheet:item:completed',
  RUNSHEET_ITEM_DELAYED = 'runsheet:item:delayed',
  RUNSHEET_UPDATED = 'runsheet:updated',
  VENDOR_ARRIVED = 'vendor:arrived',
  VENDOR_ALERT = 'vendor:alert',
  VENDOR_CONFIRMED = 'vendor:confirmed',
  GUEST_CHECKED_IN = 'guest:checked_in',
  GUEST_BATCH_UPDATE = 'guest:batch_update',
  CROWD_METRICS = 'crowd:metrics',
  LOGISTICS_ALERT = 'logistics:alert',
  BROADCAST = 'command:broadcast',
  EMERGENCY_ALERT = 'command:emergency',
  ALL_HANDS = 'command:all_hands',
  USER_JOINED = 'presence:joined',
  USER_LEFT = 'presence:left',
  PRESENCE_LIST = 'presence:list',
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

export interface PresenceUser {
  userId: string;
  name: string;
  role: string;
  avatar?: string;
  joinedAt: string;
  currentEventId?: string;
}

export interface TaskUpdateData {
  taskId: string;
  title: string;
  status: string;
  assigneeId?: string;
  assigneeName?: string;
  priority?: string;
}

export interface RunsheetItemData {
  itemId: string;
  title: string;
  scheduledTime: string;
  actualTime?: string;
  status: string;
  delayMinutes?: number;
}

export interface VendorAlertData {
  vendorId: string;
  vendorName: string;
  category: string;
  alertType: string;
  message: string;
}

export interface GuestCheckInData {
  guestId: string;
  guestName: string;
  tableNumber?: string;
  checkedInAt: string;
  totalCheckedIn: number;
  totalExpected: number;
}

export interface CrowdMetricsData {
  currentOccupancy: number;
  maxCapacity: number;
  checkInsLast10Min: number;
  checkInsTotal: number;
  occupancyPercent: number;
}

export interface BroadcastData {
  message: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  targetRoles?: string[];
  requiresAck: boolean;
}

export interface EmergencyAlertData {
  alertType: string;
  message: string;
  instructions: string[];
  contactPerson: string;
  contactPhone: string;
}
