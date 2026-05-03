import * as React from "react";
import { CalendarDays } from "lucide-react";

import { i18n, type AppLanguage } from "@/lib/i18n";
import type { ProtocolItem } from "@/lib/protocol";
import { ProtocolItemCard } from "@/components/protocol/ProtocolItemCard";
import { ProtocolSection } from "@/components/protocol/ProtocolSection";

export interface ProtocolWeeklyProps {
  items: ProtocolItem[];
  language: AppLanguage;
}

export function ProtocolWeekly({ items, language }: ProtocolWeeklyProps) {
  if (items.length === 0) return null;

  return (
    <ProtocolSection
      eyebrow={i18n(language, { en: "This week", fr: "Cette semaine" })}
      title={i18n(language, {
        en: "Weekly cadence",
        fr: "Cadence hebdomadaire",
      })}
      description={i18n(language, {
        en: "Exercises, massages and care to repeat a few times a week — pick your own days.",
        fr: "Exercices, massages et soins à répéter quelques fois par semaine — choisis tes jours.",
      })}
      icon={CalendarDays}
      count={items.length}
    >
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <ProtocolItemCard
            key={item.action.id}
            item={item}
            language={language}
          />
        ))}
      </div>
    </ProtocolSection>
  );
}
