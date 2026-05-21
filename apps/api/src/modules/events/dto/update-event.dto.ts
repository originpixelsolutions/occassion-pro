import { PartialType } from '@nestjs/swagger'
import { IsEnum, IsOptional } from 'class-validator'
import { CreateEventDto } from './create-event.dto'
import type { EventStatus } from '@occasionpro/database'

export class UpdateEventDto extends PartialType(CreateEventDto) {
  @IsOptional()
  @IsEnum(['draft', 'planning', 'confirmed', 'in_progress', 'completed', 'cancelled', 'postponed'])
  status?: EventStatus
}
