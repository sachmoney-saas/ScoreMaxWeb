import type { AppLanguage } from "@/lib/i18n";
import {
  DAILY_HABITS_PRESET_ID,
  ROUTINE_SLOTS,
  WEEKDAY_CODES,
  type ActivePreset,
  type AvoidItem,
  type AlwaysOnItem,
  type DayPlan,
  type LocalisedAlwaysOnItem,
  type LocalisedAvoidItem,
  type LocalisedPresetStep,
  type PresetStep,
  type RoutineSlot,
  type WeekdayCode,
} from "@shared/protocol-presets";

export { WEEKDAY_CODES, type WeekdayCode, type DayPlan, type RoutineSlot };

const MS_PER_DAY = 86_400_000;

/** Monday = 0 … Sunday = 6 (ISO weekday minus 1). */
function isoWeekdayIndex(date: Date): number {
  const d = date.getDay();
  return d === 0 ? 6 : d - 1;
}

export function dayOffsetToCode(
  dayOffset: number,
  today: Date = new Date(),
): WeekdayCode {
  const base = isoWeekdayIndex(today);
  const idx = (((base + dayOffset) % 7) + 7) % 7;
  return WEEKDAY_CODES[idx];
}

export function dayOffsetToDate(dayOffset: number, today: Date = new Date()): Date {
  const d = new Date(today);
  d.setHours(0, 0, 0, 0);
  d.setTime(d.getTime() + dayOffset * MS_PER_DAY);
  return d;
}

export function stepMatchesWeekday(
  weekdayPattern: string[],
  weekdayCode: WeekdayCode,
): boolean {
  if (weekdayPattern.includes("all")) return true;
  return weekdayPattern.includes(weekdayCode);
}

export function filterStepsForDay(
  steps: PresetStep[],
  weekdayCode: WeekdayCode,
  slot: RoutineSlot,
): PresetStep[] {
  return steps
    .filter(
      (s) =>
        s.slot === slot && stepMatchesWeekday(s.weekday_pattern, weekdayCode),
    )
    .sort((a, b) => a.position - b.position);
}

function localiseStep(
  step: PresetStep,
  language: AppLanguage,
): LocalisedPresetStep {
  return {
    id: step.id,
    slot: step.slot,
    position: step.position,
    title: language === "fr" ? step.title_fr : step.title_en,
    detail:
      language === "fr"
        ? step.detail_fr
        : step.detail_en,
  };
}

function localiseAlwaysOn(
  item: AlwaysOnItem,
  language: AppLanguage,
): LocalisedAlwaysOnItem {
  return {
    id: item.id,
    position: item.position,
    title: language === "fr" ? item.title_fr : item.title_en,
    detail:
      language === "fr"
        ? item.detail_fr
        : item.detail_en,
  };
}

export function localiseAvoid(
  item: AvoidItem,
  language: AppLanguage,
): LocalisedAvoidItem {
  return {
    id: item.id,
    position: item.position,
    title: language === "fr" ? item.title_fr : item.title_en,
    detail:
      language === "fr"
        ? item.detail_fr
        : item.detail_en,
    severity: item.severity,
  };
}

export function buildDayPlan(
  presets: ActivePreset[],
  dayOffset: number,
  language: AppLanguage,
  today: Date = new Date(),
): DayPlan {
  const weekdayCode = dayOffsetToCode(dayOffset, today);

  const morning: LocalisedPresetStep[] = [];
  const midday: LocalisedPresetStep[] = [];
  const evening: LocalisedPresetStep[] = [];

  const sortedPresets = [...presets]
    .filter((p) => p.preset.id !== DAILY_HABITS_PRESET_ID)
    .sort((a, b) => a.preset.priority - b.preset.priority);

  for (const active of sortedPresets) {
    for (const slot of ROUTINE_SLOTS) {
      const filtered = filterStepsForDay(active.steps, weekdayCode, slot).map(
        (s) => localiseStep(s, language),
      );
      if (slot === "morning") morning.push(...filtered);
      else if (slot === "midday") midday.push(...filtered);
      else evening.push(...filtered);
    }
  }

  return {
    weekdayCode,
    dayOffset,
    morning,
    midday,
    evening,
    alwaysOn: collectEverydayHabits(presets, language),
  };
}

/** Habits shown under « Tous les jours » — not merged into slot routines. */
export function collectEverydayHabits(
  presets: ActivePreset[],
  language: AppLanguage,
): LocalisedAlwaysOnItem[] {
  const habitPreset = presets.find(
    (p) => p.preset.id === DAILY_HABITS_PRESET_ID,
  );
  if (!habitPreset) return [];

  return habitPreset.alwaysOn
    .map((item) => localiseAlwaysOn(item, language))
    .sort((a, b) => a.position - b.position);
}

export function collectAvoidItems(
  presets: ActivePreset[],
  language: AppLanguage,
): LocalisedAvoidItem[] {
  const severityOrder: Record<LocalisedAvoidItem["severity"], number> = {
    danger: 0,
    warn: 1,
  };

  const sortedPresets = [...presets].sort(
    (a, b) => a.preset.priority - b.preset.priority,
  );

  const items: Array<LocalisedAvoidItem & { presetPriority: number }> = [];
  for (const active of sortedPresets) {
    for (const item of active.avoid) {
      items.push({
        ...localiseAvoid(item, language),
        presetPriority: active.preset.priority,
      });
    }
  }

  return items.sort((a, b) => {
    const prio = a.presetPriority - b.presetPriority;
    if (prio !== 0) return prio;
    const sev = severityOrder[a.severity] - severityOrder[b.severity];
    if (sev !== 0) return sev;
    return a.position - b.position;
  });
}

export function sanitizeWeekdayPattern(input: unknown): string[] {
  if (!Array.isArray(input)) return ["all"];
  const out: string[] = [];
  for (const v of input) {
    if (typeof v === "string" && v.length > 0 && !out.includes(v)) {
      out.push(v);
    }
  }
  return out.length > 0 ? out : ["all"];
}
