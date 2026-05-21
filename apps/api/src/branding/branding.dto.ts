import { IsOptional, IsString, IsBoolean, IsIn } from 'class-validator'

export class UpsertBrandingDto {
  @IsOptional() @IsString() primary_hsl?: string
  @IsOptional() @IsString() secondary_hsl?: string
  @IsOptional() @IsString() accent_hsl?: string
  @IsOptional() @IsString() danger_hsl?: string
  @IsOptional() @IsString() success_hsl?: string
  @IsOptional() @IsString() info_hsl?: string

  @IsOptional() @IsString() background_light_hsl?: string
  @IsOptional() @IsString() card_light_hsl?: string
  @IsOptional() @IsString() border_light_hsl?: string

  @IsOptional() @IsString() background_dark_hsl?: string
  @IsOptional() @IsString() card_dark_hsl?: string
  @IsOptional() @IsString() border_dark_hsl?: string

  @IsOptional() @IsString() logo_url?: string
  @IsOptional() @IsString() favicon_url?: string

  @IsOptional() @IsString() font_family?: string
  @IsOptional() @IsString() font_url?: string

  @IsOptional()
  @IsIn(['sharp', 'default', 'rounded', 'pill'])
  border_radius?: string

  @IsOptional() @IsBoolean() dark_mode_default?: boolean
}
