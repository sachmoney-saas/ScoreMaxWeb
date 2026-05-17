/**
 * Protocol preset catalogue — mirrors supabase/migrations/20260517300000_protocol_presets.sql
 */

export const WEEKDAY_CODES = [
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
] as const;

export type WeekdayCode = (typeof WEEKDAY_CODES)[number];

export const ROUTINE_SLOTS = ["morning", "midday", "evening"] as const;

export type RoutineSlot = (typeof ROUTINE_SLOTS)[number];

export const AVOID_SEVERITIES = ["warn", "danger"] as const;

export type AvoidSeverity = (typeof AVOID_SEVERITIES)[number];

export const DEFAULT_SKIN_PRESET_ID = "skin_v1" as const;

/** Presets assigned automatically after the first completed analysis. */
export const DAILY_HABITS_PRESET_ID = "daily_habits_v1" as const;

export const STARTER_PRESET_IDS = [
  DAILY_HABITS_PRESET_ID,
  "skin_v1",
  "lips_v1",
  "cheeks_v1",
  "eyes_v1",
] as const;

export type StarterPresetId = (typeof STARTER_PRESET_IDS)[number];

export interface ProtocolPreset {
  id: string;
  slug: string;
  target_worker: string;
  title_en: string;
  title_fr: string;
  summary_en: string;
  summary_fr: string;
  priority: number;
  enabled: boolean;
}

export interface PresetStep {
  id: string;
  preset_id: string;
  slot: RoutineSlot;
  weekday_pattern: string[];
  position: number;
  title_en: string;
  title_fr: string;
  detail_en: string | null;
  detail_fr: string | null;
}

export interface AlwaysOnItem {
  id: string;
  preset_id: string;
  position: number;
  title_en: string;
  title_fr: string;
  detail_en: string | null;
  detail_fr: string | null;
}

export interface AvoidItem {
  id: string;
  preset_id: string;
  position: number;
  title_en: string;
  title_fr: string;
  detail_en: string | null;
  detail_fr: string | null;
  severity: AvoidSeverity;
}

export interface UserRoutineRow {
  id: string;
  user_id: string;
  preset_id: string;
  started_at: string;
  removed_at: string | null;
}

export interface ActivePreset {
  routine: UserRoutineRow;
  preset: ProtocolPreset;
  steps: PresetStep[];
  alwaysOn: AlwaysOnItem[];
  avoid: AvoidItem[];
}

export interface LocalisedPresetStep {
  id: string;
  slot: RoutineSlot;
  position: number;
  title: string;
  detail: string | null;
}

export interface LocalisedAlwaysOnItem {
  id: string;
  position: number;
  title: string;
  detail: string | null;
  /** Set when merging multiple presets — used for sort order only. */
  presetPriority?: number;
}

export interface LocalisedAvoidItem {
  id: string;
  position: number;
  title: string;
  detail: string | null;
  severity: AvoidSeverity;
}

export interface DayPlan {
  weekdayCode: WeekdayCode;
  dayOffset: number;
  morning: LocalisedPresetStep[];
  midday: LocalisedPresetStep[];
  evening: LocalisedPresetStep[];
  alwaysOn: LocalisedAlwaysOnItem[];
}
