import type { AppLanguage } from "@/lib/i18n";
import { i18n } from "@/lib/i18n";

/* ============================================================================
 * Single source of truth for protocol slots.
 *
 * A recommendation can be assigned to 0..N of these slots. The list and the
 * order here drive both the admin picker and the user "Mon protocole" page.
 * ========================================================================= */

export const PROTOCOL_SLOTS = [
  "morning",
  "midday",
  "evening",
  "night",
  "weekly",
  "general",
] as const;

export type ProtocolSlot = (typeof PROTOCOL_SLOTS)[number];

export const DAILY_SLOTS = ["morning", "midday", "evening", "night"] as const;

export function isProtocolSlot(value: unknown): value is ProtocolSlot {
  return (
    typeof value === "string" && (PROTOCOL_SLOTS as readonly string[]).includes(value)
  );
}

export function sanitizeProtocolSlots(input: unknown): ProtocolSlot[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<ProtocolSlot>();
  for (const v of input) {
    if (isProtocolSlot(v)) seen.add(v);
  }
  return Array.from(seen);
}

/* ============================================================================
 * Display
 * ========================================================================= */

const SLOT_LABELS: Record<ProtocolSlot, { en: string; fr: string }> = {
  morning: { en: "Morning", fr: "Matin" },
  midday:  { en: "Midday",  fr: "Midi" },
  evening: { en: "Evening", fr: "Soir" },
  night:   { en: "Night",   fr: "Nuit" },
  weekly:  { en: "Weekly",  fr: "Hebdo" },
  general: { en: "Always-on rule", fr: "Règle permanente" },
};

const SLOT_DESCRIPTIONS: Record<ProtocolSlot, { en: string; fr: string }> = {
  morning: {
    en: "Right after waking — before going outside.",
    fr: "Au réveil — avant de sortir.",
  },
  midday: {
    en: "Around lunchtime — top-ups and refreshers.",
    fr: "Autour du déjeuner — retouches et rafraîchissements.",
  },
  evening: {
    en: "End-of-day routine after coming home.",
    fr: "Routine du soir, en rentrant chez toi.",
  },
  night: {
    en: "Just before sleep — sleep position, last care.",
    fr: "Juste avant de dormir — position, dernier soin.",
  },
  weekly: {
    en: "A few times a week — exercises, massages, scheduled care.",
    fr: "Quelques fois par semaine — exercices, massages, soins planifiés.",
  },
  general: {
    en: "Permanent rule — applies every day, no specific moment.",
    fr: "Règle permanente — s'applique chaque jour, sans moment précis.",
  },
};

/** Time-of-day used to sort slots inside the daily timeline (24h, decorative only). */
const SLOT_REPRESENTATIVE_HOUR: Record<ProtocolSlot, number> = {
  morning: 7,
  midday: 13,
  evening: 19,
  night: 23,
  weekly: 0,
  general: 0,
};

export function protocolSlotLabel(
  slot: ProtocolSlot,
  language: AppLanguage,
): string {
  return i18n(language, SLOT_LABELS[slot]);
}

export function protocolSlotDescription(
  slot: ProtocolSlot,
  language: AppLanguage,
): string {
  return i18n(language, SLOT_DESCRIPTIONS[slot]);
}

export function protocolSlotRepresentativeHour(slot: ProtocolSlot): number {
  return SLOT_REPRESENTATIVE_HOUR[slot];
}

export function sortDailySlots<T extends ProtocolSlot>(slots: T[]): T[] {
  return [...slots].sort(
    (a, b) =>
      SLOT_REPRESENTATIVE_HOUR[a] - SLOT_REPRESENTATIVE_HOUR[b],
  );
}
