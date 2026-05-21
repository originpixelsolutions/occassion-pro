import { IsString, IsBoolean, IsNumber, IsOptional, IsArray, IsEnum, IsUUID, Min, Max } from 'class-validator'

export enum ChecklistCategory {
  Venue = 'venue',
  Finance = 'finance',
  Vendors = 'vendors',
  Guests = 'guests',
  Team = 'team',
  Documents = 'documents',
}

export enum SurveyType {
  Guest = 'guest',
  Vendor = 'vendor',
  Team = 'team',
  Client = 'client',
}

export enum TestimonialSource {
  Survey = 'survey',
  Manual = 'manual',
  WhatsApp = 'whatsapp',
}

export enum SettlementStatus {
  Pending = 'pending',
  Paid = 'paid',
  Disputed = 'disputed',
}

export enum ReportType {
  Internal = 'internal',
  Client = 'client',
}

// ─── Checklist ───────────────────────────────────────────────────────────────

export class UpdateChecklistItemDto {
  @IsBoolean()
  is_completed: boolean

  @IsOptional()
  @IsString()
  notes?: string
}

// ─── Headcount ───────────────────────────────────────────────────────────────

export class MarkAttendedDto {
  @IsArray()
  @IsUUID('4', { each: true })
  guest_ids: string[]
}

// ─── Budget ───────────────────────────────────────────────────────────────────

export class FinalizeBudgetDto {
  @IsOptional()
  @IsString()
  notes?: string
}

// ─── Vendor Settlement ────────────────────────────────────────────────────────

export class UpdateSettlementDto {
  @IsOptional()
  @IsNumber()
  final_amount?: number

  @IsOptional()
  @IsString()
  adjustment_reason?: string

  @IsOptional()
  @IsEnum(SettlementStatus)
  payment_status?: SettlementStatus

  @IsOptional()
  @IsString()
  payment_method?: string

  @IsOptional()
  @IsString()
  receipt_url?: string

  @IsOptional()
  @IsString()
  notes?: string
}

export class MarkPaidDto {
  @IsString()
  payment_method: string

  @IsOptional()
  @IsString()
  receipt_url?: string

  @IsOptional()
  @IsString()
  notes?: string
}

// ─── Thank-You ────────────────────────────────────────────────────────────────

export class SendThankYouDto {
  @IsArray()
  @IsEnum(['whatsapp', 'email', 'sms'], { each: true })
  channels: string[]

  @IsString()
  message: string

  @IsOptional()
  @IsEnum(['all', 'attended', 'vip'])
  guest_filter?: 'all' | 'attended' | 'vip'

  @IsOptional()
  @IsString()
  subject?: string
}

// ─── Survey ───────────────────────────────────────────────────────────────────

export class CreateSurveyDto {
  @IsEnum(SurveyType)
  survey_type: SurveyType

  @IsString()
  title: string

  @IsArray()
  questions: any[]
}

export class SubmitSurveyResponseDto {
  @IsOptional()
  @IsUUID('4')
  respondent_id?: string

  @IsEnum(SurveyType)
  respondent_type: SurveyType

  answers: Record<string, any>
}

// ─── Testimonials ─────────────────────────────────────────────────────────────

export class CreateTestimonialDto {
  @IsString()
  author_name: string

  @IsOptional()
  @IsString()
  author_role?: string

  @IsString()
  content: string

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  rating?: number

  @IsOptional()
  @IsEnum(TestimonialSource)
  source?: TestimonialSource

  @IsOptional()
  @IsString()
  media_url?: string
}

// ─── Report ───────────────────────────────────────────────────────────────────

export class GenerateReportDto {
  @IsEnum(ReportType)
  report_type: ReportType
}
