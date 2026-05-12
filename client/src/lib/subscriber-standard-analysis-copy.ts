import { i18n, type AppLanguage } from "@/lib/i18n";
import type { SubscriberStandardQuotaWire } from "@/lib/face-analysis";

/** Parties entières j/h/min jusqu’à `next_available_at` (aligné backend : +7 j après `completed_at`). */
export function subscriberStandardCooldownParts(
  nextAvailableAtIso: string,
  nowMs: number,
): { days: number; hours: number; minutes: number } {
  const deadline = Date.parse(nextAvailableAtIso);
  const ms = Math.max(0, deadline - nowMs);
  const totalMinutes = Math.floor(ms / 60_000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  return { days, hours, minutes };
}

export function formatSubscriberCooldownCountdownLine(
  lang: AppLanguage,
  parts: { days: number; hours: number; minutes: number },
): string {
  const { days, hours, minutes } = parts;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (lang === "fr") {
    return `${days} j · ${pad(hours)} h · ${pad(minutes)} min`;
  }
  return `${days} d · ${pad(hours)} h · ${pad(minutes)} min`;
}

/** Texte sous « Nouvelle analyse » dans la sidebar (abonnés seulement). */
export function formatSubscriberStandardQuotaSidebarLine(
  lang: AppLanguage,
  quota: SubscriberStandardQuotaWire,
): string | null {
  if (!quota.weekly_limit_applies || quota.can_launch_standard_now) {
    return null;
  }

  if (quota.has_standard_in_flight) {
    return i18n(lang, {
      en: "Analysis in progress — 1 per week max",
      fr: "Analyse en cours — 1 par semaine max",
    });
  }

  if (!quota.next_available_at) {
    return i18n(lang, {
      en: "Next analysis soon",
      fr: "Prochaine analyse bientôt",
    });
  }

  const ms = Math.max(0, Date.parse(quota.next_available_at) - Date.now());
  const hoursTotal = Math.ceil(ms / (60 * 60 * 1000));
  const days = Math.ceil(ms / (24 * 60 * 60 * 1000));

  if (hoursTotal < 24) {
    return i18n(lang, {
      en:
        hoursTotal <= 1
          ? "Next analysis in about 1 hour"
          : `Next analysis in about ${hoursTotal} hours`,
      fr:
        hoursTotal <= 1
          ? "Prochaine analyse dans environ 1 h"
          : `Prochaine analyse dans environ ${hoursTotal} h`,
    });
  }

  return i18n(lang, {
    en: days === 1 ? "Next analysis in 1 day" : `Next analysis in ${days} days`,
    fr:
      days === 1
        ? "Prochaine analyse dans 1 jour"
        : `Prochaine analyse dans ${days} jours`,
  });
}
