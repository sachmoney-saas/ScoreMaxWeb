import * as React from "react";
import { Check, Info } from "lucide-react";

import {
  PROTOCOL_SLOTS,
  protocolSlotDescription,
  protocolSlotLabel,
  type ProtocolSlot,
} from "@/lib/protocol-slots";

/* ============================================================================
 * ProtocolSlotsPicker
 *
 * Multi-select chip group used inside the recommendation editor.
 * Empty selection means: "this rec is a one-shot/cure, surfaces only in the
 * Active cures section based on its duration_value/duration_unit."
 * ========================================================================= */

export interface ProtocolSlotsPickerProps {
  values: ProtocolSlot[];
  onChange: (slots: ProtocolSlot[]) => void;
}

export function ProtocolSlotsPicker({ values, onChange }: ProtocolSlotsPickerProps) {
  const selected = React.useMemo(() => new Set(values), [values]);

  const toggle = (slot: ProtocolSlot): void => {
    const next = new Set(selected);
    if (next.has(slot)) next.delete(slot);
    else next.add(slot);
    // Preserve canonical order so the DB always stores slots consistently.
    onChange(PROTOCOL_SLOTS.filter((s) => next.has(s)));
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {PROTOCOL_SLOTS.map((slot) => {
          const active = selected.has(slot);
          return (
            <button
              key={slot}
              type="button"
              onClick={() => toggle(slot)}
              className={`group inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-all ${
                active
                  ? "border-emerald-300/50 bg-emerald-400/15 text-emerald-100"
                  : "border-white/10 bg-white/[0.04] text-zinc-300 hover:border-white/20 hover:bg-white/[0.07]"
              }`}
              title={protocolSlotDescription(slot, "fr")}
            >
              {active ? <Check className="h-3 w-3" /> : null}
              <span className="font-semibold">
                {protocolSlotLabel(slot, "fr")}
              </span>
              <span className="text-[10px] uppercase tracking-[0.1em] opacity-60">
                {slot}
              </span>
            </button>
          );
        })}
      </div>

      <p className="flex items-start gap-1.5 text-[11px] text-zinc-500">
        <Info className="mt-px h-3 w-3 shrink-0" />
        <span>
          Sélectionne 0 ou plusieurs créneaux. Si tu n'en sélectionnes aucun, la
          reco est traitée comme une <em>cure</em> ponctuelle (chirurgie,
          séances, etc.) et apparaît dans <em>Cures actives</em> à partir de sa
          durée.
        </span>
      </p>
    </div>
  );
}
