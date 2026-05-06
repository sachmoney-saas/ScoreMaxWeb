import * as React from "react";
import { Sun, SunDim, Moon, Sunrise } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { i18n, type AppLanguage } from "@/lib/i18n";
import {
  protocolSlotLabel,
  type ProtocolSlot,
} from "@/lib/protocol-slots";
import type { ProtocolItem } from "@/lib/protocol";
import { ProtocolItemCard } from "@/components/protocol/ProtocolItemCard";

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
    <div className="rounded-xl border border-zinc-200 bg-zinc-50/90 p-3">
      <header className="flex items-start justify-between gap-2 px-1 pb-3">
        <div className="flex min-w-0 items-start gap-2">
          <Icon className="mt-0.5 h-4 w-4 shrink-0 text-zinc-600" />
          <div className="min-w-0">
            <p className="font-display text-sm font-semibold leading-tight text-zinc-900">
              {protocolSlotLabel(slot, language)}
            </p>
          </div>
        </div>
        <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold tabular-nums text-zinc-700 ring-1 ring-zinc-200/80">
          {items.length}
        </span>
      </header>

      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-200 bg-white px-3 py-6 text-center text-[11px] text-zinc-500">
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

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <DailyColumn slot="morning" items={morning} language={language} />
        <DailyColumn slot="midday" items={midday} language={language} />
        <DailyColumn slot="evening" items={evening} language={language} />
        <DailyColumn slot="night" items={night} language={language} />
      </div>
    </div>
  );
}
