import {
  IsString, IsOptional, IsNumber, IsBoolean, IsArray,
  IsIn, Min, Max, IsUUID, ValidateNested, IsObject,
} from 'class-validator'
import { Type } from 'class-transformer'

// ── Canvas props ─────────────────────────────────────────────────────────────

export class CanvasPropsDto {
  @IsNumber() @IsOptional() canvasWidth?:  number
  @IsNumber() @IsOptional() canvasHeight?: number
  @IsNumber() @IsOptional() gridSize?:     number
  @IsString() @IsOptional() scaleLabel?:   string
  @IsString() @IsOptional() backgroundColor?: string
}

// ── Save floor plan (shapes + canvasProps) ───────────────────────────────────

export class SaveFloorPlanDto {
  @IsArray()           shapes:      Record<string, unknown>[]
  @IsObject() @IsOptional() canvasProps?: CanvasPropsDto
}

// ── Create table ─────────────────────────────────────────────────────────────

export class CreateTableDto {
  @IsString()   name:  string
  @IsNumber() @Min(1) @Max(500)  seats: number
  @IsIn(['table-round', 'table-rect', 'table-cocktail'])
  tableType: string

  @IsNumber() @IsOptional() xPos?: number
  @IsNumber() @IsOptional() yPos?: number
}

// ── Update table ─────────────────────────────────────────────────────────────

export class UpdateTableDto {
  @IsString()  @IsOptional() name?:    string
  @IsNumber()  @IsOptional() seats?:   number
  @IsString()  @IsOptional() shapeId?: string
  @IsNumber()  @IsOptional() xPos?:    number
  @IsNumber()  @IsOptional() yPos?:    number
}

// ── Assign guest ─────────────────────────────────────────────────────────────

export class AssignGuestDto {
  @IsUUID() guestId: string
}
