import {
  IsString, IsOptional, IsBoolean, IsNumber, IsEnum,
  IsEmail, IsArray, IsUUID, Min, Max, IsDateString,
  IsInt, IsPositive, ValidateNested, IsObject,
} from 'class-validator'
import { Type } from 'class-transformer'

// ─── Enums ─────────────────────────────────────────────────────────────────

export enum TicketType {
  General   = 'general',
  VIP       = 'vip',
  Speaker   = 'speaker',
  Sponsor   = 'sponsor',
  Exhibitor = 'exhibitor',
  Student   = 'student',
  Group     = 'group',
  Virtual   = 'virtual',
  Press     = 'press',
  Staff     = 'staff',
}

export enum RegistrationStatus {
  Pending    = 'pending',
  Confirmed  = 'confirmed',
  Cancelled  = 'cancelled',
  Waitlisted = 'waitlisted',
  CheckedIn  = 'checked_in',
  NoShow     = 'no_show',
}

export enum SessionType {
  Keynote    = 'keynote',
  Panel      = 'panel',
  Workshop   = 'workshop',
  Breakout   = 'breakout',
  Lightning  = 'lightning',
  Networking = 'networking',
  Fireside   = 'fireside',
  Demo       = 'demo',
  Poster     = 'poster',
  Exhibition = 'exhibition',
}

export enum SessionStatus {
  Scheduled = 'scheduled',
  Live      = 'live',
  Completed = 'completed',
  Cancelled = 'cancelled',
}

export enum SpeakerStatus {
  Invited   = 'invited',
  Confirmed = 'confirmed',
  Declined  = 'declined',
  Cancelled = 'cancelled',
}

export enum SponsorTier {
  Title     = 'title',
  Platinum  = 'platinum',
  Gold      = 'gold',
  Silver    = 'silver',
  Bronze    = 'bronze',
  Partner   = 'partner',
  Media     = 'media',
  Community = 'community',
}

export enum ExhibitorStatus {
  Pending   = 'pending',
  Confirmed = 'confirmed',
  Setup     = 'setup',
  Active    = 'active',
  Concluded = 'concluded',
}

export enum QuestionStatus {
  Pending   = 'pending',
  Approved  = 'approved',
  Answered  = 'answered',
  Dismissed = 'dismissed',
}

export enum PollStatus {
  Draft    = 'draft',
  Active   = 'active',
  Closed   = 'closed',
  Archived = 'archived',
}

// ─── Settings ──────────────────────────────────────────────────────────────

export class UpdateConferenceSettingsDto {
  @IsOptional() @IsBoolean() is_enabled?: boolean
  @IsOptional() @IsBoolean() ticketing_enabled?: boolean
  @IsOptional() @IsBoolean() ceu_tracking_enabled?: boolean
  @IsOptional() @IsBoolean() networking_enabled?: boolean
  @IsOptional() @IsBoolean() live_qa_enabled?: boolean
  @IsOptional() @IsBoolean() polling_enabled?: boolean
  @IsOptional() @IsInt() @IsPositive() max_attendees?: number
  @IsOptional() @IsDateString() registration_opens_at?: string
  @IsOptional() @IsDateString() registration_closes_at?: string
  @IsOptional() @IsDateString() early_bird_until?: string
  @IsOptional() @IsString() welcome_message?: string
  @IsOptional() @IsString() code_of_conduct_url?: string
  @IsOptional() @IsString() hashtag?: string
  @IsOptional() @IsString() wifi_name?: string
  @IsOptional() @IsString() wifi_password?: string
  @IsOptional() @IsString() streaming_url?: string
  @IsOptional() @IsObject() branding_colors?: Record<string, string>
  @IsOptional() @IsObject() meta?: Record<string, any>
}

// ─── Tickets ───────────────────────────────────────────────────────────────

export class CreateTicketDto {
  @IsString() name: string
  @IsOptional() @IsString() description?: string
  @IsOptional() @IsEnum(TicketType) ticket_type?: TicketType
  @IsOptional() @IsNumber() price?: number
  @IsOptional() @IsNumber() early_bird_price?: number
  @IsOptional() @IsString() currency_code?: string
  @IsOptional() @IsInt() quantity_total?: number
  @IsOptional() @IsBoolean() is_active?: boolean
  @IsOptional() @IsBoolean() is_visible?: boolean
  @IsOptional() @IsDateString() sale_starts_at?: string
  @IsOptional() @IsDateString() sale_ends_at?: string
  @IsOptional() @IsInt() max_per_order?: number
  @IsOptional() @IsInt() min_per_order?: number
  @IsOptional() @IsBoolean() includes_meal?: boolean
  @IsOptional() @IsBoolean() includes_kit?: boolean
  @IsOptional() @IsBoolean() includes_recording?: boolean
  @IsOptional() @IsString() color?: string
  @IsOptional() @IsInt() sort_order?: number
}

export class UpdateTicketDto extends CreateTicketDto {}

// ─── Registrations ─────────────────────────────────────────────────────────

export class CreateRegistrationDto {
  @IsUUID() ticket_id: string
  @IsOptional() @IsUUID() guest_id?: string
  @IsString() first_name: string
  @IsString() last_name: string
  @IsEmail() email: string
  @IsOptional() @IsString() phone?: string
  @IsOptional() @IsString() company?: string
  @IsOptional() @IsString() job_title?: string
  @IsOptional() @IsString() dietary_requirements?: string
  @IsOptional() @IsString() t_shirt_size?: string
  @IsOptional() @IsString() badge_name?: string
  @IsOptional() @IsString() badge_company?: string
  @IsOptional() @IsBoolean() is_complimentary?: boolean
  @IsOptional() @IsObject() custom_fields?: Record<string, any>
  @IsOptional() @IsString() notes?: string
}

export class UpdateRegistrationDto {
  @IsOptional() @IsEnum(RegistrationStatus) status?: RegistrationStatus
  @IsOptional() @IsString() first_name?: string
  @IsOptional() @IsString() last_name?: string
  @IsOptional() @IsString() company?: string
  @IsOptional() @IsString() job_title?: string
  @IsOptional() @IsString() dietary_requirements?: string
  @IsOptional() @IsString() badge_name?: string
  @IsOptional() @IsString() badge_company?: string
  @IsOptional() @IsObject() custom_fields?: Record<string, any>
  @IsOptional() @IsString() notes?: string
}

export class CheckInDto {
  @IsString() registration_number: string
  @IsOptional() @IsUUID() checked_in_by?: string
}

// ─── Speakers ──────────────────────────────────────────────────────────────

export class CreateSpeakerDto {
  @IsString() first_name: string
  @IsString() last_name: string
  @IsOptional() @IsEmail() email?: string
  @IsOptional() @IsString() phone?: string
  @IsOptional() @IsString() company?: string
  @IsOptional() @IsString() job_title?: string
  @IsOptional() @IsString() bio?: string
  @IsOptional() @IsString() photo_url?: string
  @IsOptional() @IsEnum(SpeakerStatus) status?: SpeakerStatus
  @IsOptional() @IsBoolean() is_keynote?: boolean
  @IsOptional() @IsBoolean() is_featured?: boolean
  @IsOptional() @IsString() linkedin_url?: string
  @IsOptional() @IsString() twitter_handle?: string
  @IsOptional() @IsString() website_url?: string
  @IsOptional() @IsArray() @IsString({ each: true }) topics?: string[]
  @IsOptional() @IsBoolean() travel_required?: boolean
  @IsOptional() @IsBoolean() hotel_required?: boolean
  @IsOptional() @IsNumber() honorarium?: number
  @IsOptional() @IsString() dietary_requirements?: string
  @IsOptional() @IsString() notes?: string
}

export class UpdateSpeakerDto extends CreateSpeakerDto {}

// ─── Sessions ──────────────────────────────────────────────────────────────

export class CreateSessionDto {
  @IsString() title: string
  @IsOptional() @IsString() description?: string
  @IsOptional() @IsEnum(SessionType) session_type?: SessionType
  @IsOptional() @IsString() track?: string
  @IsOptional() @IsString() room?: string
  @IsOptional() @IsInt() room_capacity?: number
  @IsDateString() starts_at: string
  @IsDateString() ends_at: string
  @IsOptional() @IsInt() day_number?: number
  @IsOptional() @IsBoolean() is_virtual?: boolean
  @IsOptional() @IsString() stream_url?: string
  @IsOptional() @IsBoolean() is_ticketed?: boolean
  @IsOptional() @IsInt() max_attendees?: number
  @IsOptional() @IsNumber() ceu_credits?: number
  @IsOptional() @IsString() ceu_type?: string
  @IsOptional() @IsString() language?: string
  @IsOptional() @IsString() difficulty_level?: string
  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[]
  @IsOptional() @IsBoolean() is_featured?: boolean
  @IsOptional() @IsBoolean() requires_signup?: boolean
  @IsOptional() @IsArray() @IsUUID(undefined, { each: true }) speaker_ids?: string[]
}

export class UpdateSessionDto extends CreateSessionDto {}

export class AddSessionSpeakerDto {
  @IsUUID() speaker_id: string
  @IsOptional() @IsString() role?: string
}

// ─── Sponsors ──────────────────────────────────────────────────────────────

export class CreateSponsorDto {
  @IsString() company_name: string
  @IsOptional() @IsEnum(SponsorTier) tier?: SponsorTier
  @IsOptional() @IsString() logo_url?: string
  @IsOptional() @IsString() website_url?: string
  @IsOptional() @IsString() tagline?: string
  @IsOptional() @IsString() description?: string
  @IsOptional() @IsString() contact_name?: string
  @IsOptional() @IsEmail() contact_email?: string
  @IsOptional() @IsString() contact_phone?: string
  @IsOptional() @IsString() booth_number?: string
  @IsOptional() @IsNumber() sponsorship_amount?: number
  @IsOptional() @IsBoolean() is_featured?: boolean
  @IsOptional() @IsArray() benefits?: any[]
  @IsOptional() @IsObject() social_links?: Record<string, string>
  @IsOptional() @IsString() notes?: string
}

export class UpdateSponsorDto extends CreateSponsorDto {}

// ─── Exhibitors ────────────────────────────────────────────────────────────

export class CreateExhibitorDto {
  @IsString() company_name: string
  @IsOptional() @IsEnum(ExhibitorStatus) status?: ExhibitorStatus
  @IsOptional() @IsString() booth_number?: string
  @IsOptional() @IsString() booth_size?: string
  @IsOptional() @IsString() hall?: string
  @IsOptional() @IsString() logo_url?: string
  @IsOptional() @IsString() website_url?: string
  @IsOptional() @IsString() description?: string
  @IsOptional() @IsString() category?: string
  @IsOptional() @IsString() contact_name?: string
  @IsOptional() @IsEmail() contact_email?: string
  @IsOptional() @IsString() contact_phone?: string
  @IsOptional() @IsBoolean() power_required?: boolean
  @IsOptional() @IsBoolean() internet_required?: boolean
  @IsOptional() @IsObject() floor_plan_position?: any
  @IsOptional() @IsNumber() exhibitor_fee?: number
  @IsOptional() @IsInt() staff_count?: number
  @IsOptional() @IsString() notes?: string
}

export class UpdateExhibitorDto extends CreateExhibitorDto {}

// ─── Q&A ───────────────────────────────────────────────────────────────────

export class CreateQuestionDto {
  @IsUUID() session_id: string
  @IsString() question_text: string
  @IsOptional() @IsBoolean() is_anonymous?: boolean
  @IsOptional() @IsString() asked_by_name?: string
  @IsOptional() @IsUUID() registration_id?: string
}

export class UpdateQuestionDto {
  @IsOptional() @IsEnum(QuestionStatus) status?: QuestionStatus
  @IsOptional() @IsString() answer_text?: string
  @IsOptional() @IsInt() sort_order?: number
}

// ─── Polls ─────────────────────────────────────────────────────────────────

export class PollOptionDto {
  @IsString() id: string
  @IsString() text: string
}

export class CreatePollDto {
  @IsOptional() @IsUUID() session_id?: string
  @IsString() question: string
  @IsOptional() @IsBoolean() is_anonymous?: boolean
  @IsOptional() @IsBoolean() allow_multiple?: boolean
  @IsOptional() @IsBoolean() show_results?: boolean
  @IsArray() @ValidateNested({ each: true }) @Type(() => PollOptionDto) options: PollOptionDto[]
}

export class UpdatePollDto {
  @IsOptional() @IsEnum(PollStatus) status?: PollStatus
  @IsOptional() @IsString() question?: string
  @IsOptional() @IsArray() options?: PollOptionDto[]
  @IsOptional() @IsBoolean() show_results?: boolean
}

export class VotePollDto {
  @IsUUID() registration_id: string
  @IsArray() @IsString({ each: true }) selected_options: string[]
}

// ─── CEU Credits ───────────────────────────────────────────────────────────

export class IssueCEUDto {
  @IsUUID() registration_id: string
  @IsOptional() @IsUUID() session_id?: string
  @IsString() credit_type: string
  @IsNumber() @IsPositive() credits: number
  @IsOptional() @IsString() accreditation_body?: string
  @IsOptional() @IsDateString() expires_at?: string
  @IsOptional() @IsString() notes?: string
}

// ─── Networking ────────────────────────────────────────────────────────────

export class CreateConnectionDto {
  @IsUUID() recipient_id: string
  @IsOptional() @IsString() message?: string
}

export class UpdateConnectionDto {
  @IsString() status: 'accepted' | 'declined' | 'blocked'
  @IsOptional() @IsBoolean() meeting_scheduled?: boolean
  @IsOptional() @IsDateString() meeting_time?: string
  @IsOptional() @IsString() meeting_location?: string
}
