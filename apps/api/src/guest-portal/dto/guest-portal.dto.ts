import {
  IsString,
  IsOptional,
  IsEnum,
  IsUUID,
  IsEmail,
  IsArray,
  IsBoolean,
  IsNumber,
  Min,
  IsDateString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum RsvpStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  DECLINED = 'declined',
  MAYBE = 'maybe',
  WAITLISTED = 'waitlisted',
}

export enum ApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  REVISION_REQUESTED = 'revision_requested',
}

export enum DocumentType {
  PROPOSAL = 'proposal',
  CONTRACT = 'contract',
  INVOICE = 'invoice',
  TIMELINE = 'timeline',
  FLOOR_PLAN = 'floor_plan',
  MOOD_BOARD = 'mood_board',
  VENDOR_LIST = 'vendor_list',
  SEATING_CHART = 'seating_chart',
  MENU = 'menu',
  RUNSHEET = 'runsheet',
  OTHER = 'other',
}

export enum MilestoneStatus {
  UPCOMING = 'upcoming',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  OVERDUE = 'overdue',
}

export class CreateClientPortalDto {
  @IsUUID()
  event_id: string;

  @IsString()
  client_name: string;

  @IsEmail()
  client_email: string;

  @IsOptional()
  @IsString()
  client_phone?: string;

  @IsOptional()
  @IsString()
  access_code?: string; // If not provided, auto-generated

  @IsOptional()
  @IsDateString()
  access_expires_at?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowed_sections?: string[]; // Which portal sections the client can see
}

export class PortalRsvpDto {
  @IsEnum(RsvpStatus)
  status: RsvpStatus;

  @IsOptional()
  @IsNumber()
  @Min(0)
  plus_ones?: number;

  @IsOptional()
  @IsString()
  dietary_requirements?: string;

  @IsOptional()
  @IsString()
  message?: string;
}

export class PortalApprovalDto {
  @IsString()
  item_id: string; // ID of the item being approved (timeline item, vendor, etc.)

  @IsString()
  item_type: string; // 'timeline_item' | 'vendor' | 'floor_plan' | 'budget_allocation'

  @IsEnum(ApprovalStatus)
  status: ApprovalStatus;

  @IsOptional()
  @IsString()
  notes?: string; // Reason for rejection or revision request
}

export class PortalMessageDto {
  @IsString()
  message: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachment_urls?: string[];
}

export class ShareDocumentDto {
  @IsUUID()
  event_id: string;

  @IsString()
  document_name: string;

  @IsEnum(DocumentType)
  document_type: DocumentType;

  @IsString()
  file_url: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  requires_approval?: boolean;

  @IsOptional()
  @IsBoolean()
  is_visible_to_client?: boolean;
}

export class CreateMilestoneDto {
  @IsUUID()
  event_id: string;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsDateString()
  due_date: string;

  @IsEnum(MilestoneStatus)
  @IsOptional()
  status?: MilestoneStatus;

  @IsOptional()
  @IsNumber()
  @Min(0)
  sort_order?: number;
}

export class GuestImportDto {
  @IsUUID()
  event_id: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GuestEntryDto)
  guests: GuestEntryDto[];
}

export class GuestEntryDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  table_number?: string;

  @IsOptional()
  @IsString()
  meal_preference?: string;

  @IsOptional()
  @IsString()
  category?: string; // 'family', 'friend', 'colleague', 'vip', etc.

  @IsOptional()
  @IsBoolean()
  is_vip?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  plus_ones?: number;
}

export class SendPortalInviteDto {
  @IsUUID()
  event_id: string;

  @IsArray()
  @IsEmail({ each: true })
  emails: string[];

  @IsOptional()
  @IsString()
  custom_message?: string;
}
