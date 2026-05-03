import * as React from "react";
import { Sun, SunDim, Moon, Sunrise, Repeat } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { i18n, type AppLanguage } from "@/lib/i18n";
import {
  protocolSlotDescription,
  protocolSlotLabel,
  type ProtocolSlot,
} from "@/lib/protocol-slots";
import type { ProtocolItem } from "@/lib/protocol";
import { ProtocolItemCard } from "@/components/protocol/ProtocolItemCard";
import { ProtocolSection } from "@/components/protocol/ProtocolSection";

/* ============================================================================
 * ProtocolDay — daily timeline (morning → midday → evening → night)
 * ========================================================================= */

const SLOT_ICON: Record<
  Extract<ProtocolSlot, "morning" | "midday" | "evening" | "night">,
  LucideIcon
> = {
  morning: Sunrise,
  midday: Sun,
  evening: SunDim,
  night: Moon,
};

interface DailyColumnProps {
  slot: Extract<ProtocolSlot, "morning" | "midday" | "evening" | "night">;
  items: ProtocolItem[];
  language: AppLanguage;
}

function DailyColumn({ slot, items, language }: DailyColumnProps) {
  const Icon = SLOT_ICON[slot];

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
      <header className="flex items-start justify-between gap-2 px-1 pb-3">
        <div className="flex min-w-0 items-start gap-2">
          <Icon className="mt-0.5 h-4 w-4 shrink-0 text-zinc-300" />
          <div className="min-w-0">
            <p className="font-display text-sm font-semibold leading-tight text-white">
              {protocolSlotLabel(slot, language)}
            </p>
            <p className="mt-0.5 text-[10px] text-zinc-500">
              {protocolSlotDescription(slot, language)}
            </p>
          </div>
        </div>
        <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold tabular-nums text-zinc-300">
          {items.length}
        </span>
      </header>

      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-3 py-6 text-center text-[11px] text-zinc-500">
          {i18n(language, {
            en: "Nothing scheduled here yet.",
            fr: "Rien de prévu ici pour l'instant.",
          })}
        </p>
      ) : (
        <div className="space-y-2.5">
          {items.map((item) => (
            <ProtocolItemCard
              key={`${item.action.id}:${slot}`}
              item={item}
              language={language}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export interface ProtocolDayProps {
  itemsBySlot: Map<ProtocolSlot, ProtocolItem[]>;
  language: AppLanguage;
}

export function ProtocolDay({ itemsBySlot, language }: ProtocolDayProps) {
  const morning = itemsBySlot.get("morning") ?? [];
  const midday = itemsBySlot.get("midday") ?? [];
  const evening = itemsBySlot.get("evening") ?? [];
  const night = itemsBySlot.get("night") ?? [];

  const total =
    morning.length + midday.length + evening.length + night.length;

  return (
    <ProtocolSection
      eyebrow={i18n(language, { en: "Today", fr: "Aujourd'hui" })}
      title={i18n(language, { en: "Daily routine", fr: "Routine quotidienne" })}
      description={i18n(language, {
        en: "Your saved recommendations placed throughout the day. Same routine every day until you change it.",
        fr: "Tes recommandations sauvegardées réparties dans la journée. Même routine chaque jour, jusqu'à ce que tu la modifies.",
      })}
      icon={Sun}
      count={total}
      trailing={
        <span className="hidden items-center gap-1 rounded-full bg-white/[0.04] px-2 py-0.5 text-[10px] text-zinc-400 sm:inline-flex">
          <Repeat className="h-3 w-3 opacity-70" />
          {i18n(language, { en: "Repeats daily", fr: "Quotidien" })}
        </span>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <DailyColumn slot="morning" items={morning} language={language} />
        <DailyColumn slot="midday" items={midday} language={language} />
        <DailyColumn slot="evening" items={evening} language={language} />
        <DailyColumn slot="night" items={night} language={language} />
      </div>
    </ProtocolSection>
  );
}
