import { IsString, IsOptional, IsNumber, IsBoolean, IsEnum, IsArray, IsUUID, Min } from 'class-validator'

export enum RunsheetItemStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  SKIPPED = 'skipped',
  DELAYED = 'delayed',
}

export enum RunsheetItemCategory {
  SETUP = 'Setup',
  CEREMONY = 'Ceremony',
  RECEPTION = 'Reception',
  PERFORMANCE = 'Performance',
  SPEECH = 'Speech',
  CATERING = 'Catering',
  TECHNICAL = 'Technical',
  TRANSPORT = 'Transport',
  VIP = 'VIP',
  MEDIA = 'Media',
  REHEARSAL = 'Rehearsal',
  BREAKDOWN = 'Breakdown',
  OTHER = 'Other',
}

export class CreateRunsheetItemDto {
  @IsString()
  title: string

  @IsOptional()
  @IsUUID()
  parent_id?: string

  @IsOptional()
  @IsNumber()
  position?: number

  @IsOptional()
  @IsString()
  start_time?: string

  @IsOptional()
  @IsString()
  end_time?: string

  @IsOptional()
  @IsNumber()
  @Min(0)
  duration_minutes?: number

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsEnum(RunsheetItemCategory)
  category?: RunsheetItemCategory

  @IsOptional()
  @IsArray()
  assigned_to?: string[]

  @IsOptional()
  @IsArray()
  assigned_vendors?: string[]

  @IsOptional()
  @IsBoolean()
  is_guest_visible?: boolean

  @IsOptional()
  @IsString()
  notes?: string

  @IsOptional()
  @IsString()
  color?: string
}

export class UpdateRunsheetItemDto {
  @IsOptional()
  @IsString()
  title?: string

  @IsOptional()
  @IsString()
  start_time?: string

  @IsOptional()
  @IsString()
  end_time?: string

  @IsOptional()
  @IsNumber()
  @Min(0)
  duration_minutes?: number

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsEnum(RunsheetItemCategory)
  category?: RunsheetItemCategory

  @IsOptional()
  @IsArray()
  assigned_to?: string[]

  @IsOptional()
  @IsArray()
  assigned_vendors?: string[]

  @IsOptional()
  @IsBoolean()
  is_guest_visible?: boolean

  @IsOptional()
  @IsString()
  notes?: string

  @IsOptional()
  @IsString()
  color?: string
}

export class ReorderItemsDto {
  items: { id: string; position: number }[]
}

export class UpdateItemStatusDto {
  @IsEnum(RunsheetItemStatus)
  status: RunsheetItemStatus

  @IsOptional()
  @IsNumber()
  @Min(0)
  delay_minutes?: number
}

export class AddCommentDto {
  @IsString()
  comment: string
}

export class SaveVersionDto {
  @IsOptional()
  @IsString()
  label?: string
}

export class ExportRunsheetDto {
  @IsEnum(['pdf', 'excel'])
  format: 'pdf' | 'excel'
}
