import { i18n, type AppLanguage } from "@/lib/i18n";
import { dailyTimelineSlots, type ProtocolCure, type ProtocolItem } from "@/lib/protocol";
import { protocolSlotLabel, type ProtocolSlot } from "@/lib/protocol-slots";
import { ProtocolItemCard } from "@/components/protocol/ProtocolItemCard";
import { CureProgressBar, CureTrailing } from "@/components/protocol/protocol-cure-support";

export interface ProtocolRoutineProps {
  itemsBySlot: Map<ProtocolSlot, ProtocolItem[]>;
  cures: ProtocolCure[];
  language: AppLanguage;
}

/**
 * Bloc unique « Routine » : zone claire pour les étapes du jour (créneaux + cures intégrées).
 * Les sous-sections matin / midi / soir / nuit ne s’affichent que lorsqu’elles ont du contenu.
 */
export function ProtocolRoutine({ itemsBySlot, cures, language }: ProtocolRoutineProps) {
  const slots = dailyTimelineSlots();
  const hasDaily = slots.some((s) => (itemsBySlot.get(s) ?? []).length > 0);
  const hasCures = cures.length > 0;
  const isEmpty = !hasDaily && !hasCures;

  return (
    <div className="space-y-2">
      <h2 className="font-display text-lg font-semibold tracking-tight text-zinc-100">
        {i18n(language, { en: "Routine", fr: "Routine" })}
      </h2>
      <div className="min-h-[8rem] rounded-xl border border-zinc-200 bg-white p-4 shadow-sm md:p-5">
        {isEmpty ? (
          <p className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50/80 px-4 py-10 text-center text-[12px] leading-relaxed text-zinc-500">
            {i18n(language, {
              en: "Your daily steps will show up here — morning, midday, evening, and night.",
              fr: "Les étapes du jour apparaîtront ici — matin, midi, soir et nuit.",
            })}
          </p>
        ) : (
          <div className="space-y-6">
            {slots.map((slot) => {
              const items = itemsBySlot.get(slot) ?? [];
              if (items.length === 0) return null;
              return (
                <section key={slot} className="space-y-2.5">
                  <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                    {protocolSlotLabel(slot, language)}
                  </h3>
                  <div className="space-y-2.5">
                    {items.map((item) => (
                      <ProtocolItemCard
                        key={`${item.action.id}:${slot}`}
                        item={item}
                        language={language}
                      />
                    ))}
                  </div>
                </section>
              );
            })}

            {hasCures ? (
              <div className={hasDaily ? "space-y-3 border-t border-zinc-100 pt-5" : "space-y-3"}>
                {cures.map((cure) => (
                  <div key={cure.action.id} className="space-y-2">
                    <ProtocolItemCard
                      item={cure}
                      language={language}
                      trailing={<CureTrailing cure={cure} language={language} />}
                    />
                    {cure.progress !== null && cure.totalDays !== null ? (
                      <div className="px-1">
                        <CureProgressBar progress={cure.progress} />
                        <p className="mt-1 text-[10px] text-zinc-600 tabular-nums">
                          {i18n(language, {
                            en: `${cure.elapsedDays} / ${cure.totalDays} days`,
                            fr: `${cure.elapsedDays} / ${cure.totalDays} jours`,
                          })}
                        </p>
                      </div>
                    ) : cure.progress !== null ? (
                      <div className="px-1">
                        <CureProgressBar progress={cure.progress} />
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
