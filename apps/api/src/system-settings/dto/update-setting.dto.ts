import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class UpdateSettingDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  value: string;
}

export class BulkUpdateSettingsDto {
  settings: { key: string; value: string }[];
}
