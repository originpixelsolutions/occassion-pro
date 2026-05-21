export interface SystemSetting {
  id: string;
  key: string;
  value: string | null;
  description: string | null;
  category: string;
  is_sensitive: boolean;
  created_at: Date;
  updated_at: Date;
}

/** Safe view — value masked for sensitive keys unless explicitly requested */
export interface SystemSettingView extends Omit<SystemSetting, 'value'> {
  value: string | null;   // null when sensitive and caller lacks clearance
  has_value: boolean;     // true when a value is set (even if masked)
}
