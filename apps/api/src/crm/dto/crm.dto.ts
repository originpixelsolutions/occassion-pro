import {
  IsString,
  IsOptional,
  IsNumber,
  IsEnum,
  IsUUID,
  IsArray,
  IsDateString,
  IsEmail,
  IsObject,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum LeadStatus {
  NEW = 'new',
  CONTACTED = 'contacted',
  QUALIFIED = 'qualified',
  PROPOSAL_SENT = 'proposal_sent',
  NEGOTIATION = 'negotiation',
  WON = 'won',
  LOST = 'lost',
  ON_HOLD = 'on_hold',
}

export enum LeadSource {
  WEBSITE = 'website',
  REFERRAL = 'referral',
  SOCIAL_MEDIA = 'social_media',
  COLD_OUTREACH = 'cold_outreach',
  EVENT = 'event',
  PARTNER = 'partner',
  MICROSITE = 'microsite',
  OTHER = 'other',
}

export enum ActivityType {
  CALL = 'call',
  EMAIL = 'email',
  MEETING = 'meeting',
  WHATSAPP = 'whatsapp',
  SITE_VISIT = 'site_visit',
  PROPOSAL_SENT = 'proposal_sent',
  FOLLOW_UP = 'follow_up',
  NOTE = 'note',
}

export class CreateLeadDto {
  @IsString()
  client_name: string;

  @IsEmail()
  client_email: string;

  @IsOptional()
  @IsString()
  client_phone?: string;

  @IsOptional()
  @IsString()
  company_name?: string;

  @IsOptional()
  @IsString()
  event_type?: string;

  @IsOptional()
  @IsDateString()
  event_date?: string;

  @IsOptional()
  @IsString()
  venue_preference?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  budget_min?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  budget_max?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  guest_count?: number;

  @IsOptional()
  @IsEnum(LeadSource)
  source?: LeadSource;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsUUID()
  assigned_to?: string;

  @IsOptional()
  @IsObject()
  custom_fields?: Record<string, unknown>;
}

export class UpdateLeadDto {
  @IsOptional()
  @IsEnum(LeadStatus)
  status?: LeadStatus;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  score?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  deal_value?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  probability?: number;

  @IsOptional()
  @IsDateString()
  expected_close_date?: string;

  @IsOptional()
  @IsUUID()
  assigned_to?: string;

  @IsOptional()
  @IsString()
  loss_reason?: string;

  @IsOptional()
  @IsObject()
  custom_fields?: Record<string, unknown>;
}

export class CreateActivityDto {
  @IsUUID()
  lead_id: string;

  @IsEnum(ActivityType)
  type: ActivityType;

  @IsString()
  subject: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  scheduled_at?: string;

  @IsOptional()
  @IsDateString()
  completed_at?: string;

  @IsOptional()
  @IsString()
  outcome?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(60)
  duration_minutes?: number;

  @IsOptional()
  @IsBoolean()
  is_completed?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { IsBoolean } = require('class-validator');

export class ScheduleFollowUpDto {
  @IsUUID()
  lead_id: string;

  @IsDateString()
  follow_up_date: string;

  @IsEnum(ActivityType)
  type: ActivityType;

  @IsString()
  subject: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateProposalDto {
  @IsUUID()
  lead_id: string;

  @IsString()
  title: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  total_amount?: number;

  @IsOptional()
  @IsDateString()
  valid_until?: string;

  @IsOptional()
  @IsArray()
  line_items?: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    category: string;
  }>;

  @IsOptional()
  @IsString()
  terms?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class LeadQueryDto {
  @IsOptional()
  @IsEnum(LeadStatus)
  status?: LeadStatus;

  @IsOptional()
  @IsEnum(LeadSource)
  source?: LeadSource;

  @IsOptional()
  @IsUUID()
  assigned_to?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  sort_by?: string = 'created_at';

  @IsOptional()
  @IsString()
  sort_order?: 'asc' | 'desc' = 'desc';
}
