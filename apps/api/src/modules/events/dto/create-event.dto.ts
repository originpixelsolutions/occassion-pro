import { IsString, IsEnum, IsOptional, IsDateString, IsNumber, IsBoolean, IsArray, Min, MaxLength } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import type { EventCategory } from '@occasionpro/database'

export class CreateEventDto {
  @ApiProperty({ example: 'TechSummit Bengaluru 2026' })
  @IsString()
  @MaxLength(200)
  name: string

  @ApiProperty({ enum: ['wedding', 'corporate', 'conference', 'concert', 'exhibition', 'government', 'sports', 'religious', 'educational', 'virtual', 'other'] })
  @IsEnum(['wedding', 'corporate', 'conference', 'concert', 'exhibition', 'government', 'sports', 'religious', 'educational', 'virtual', 'other'])
  category: EventCategory

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  start_date?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  end_date?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  venue_id?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  state?: string

  @ApiPropertyOptional({ default: 'IN' })
  @IsOptional()
  @IsString()
  country?: string

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  expected_guests?: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  budget_amount?: number

  @ApiPropertyOptional({ default: 'INR' })
  @IsOptional()
  @IsString()
  currency?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  internal_notes?: string

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[]

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  microsite_enabled?: boolean
}
