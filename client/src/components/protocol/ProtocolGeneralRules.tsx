import * as React from "react";
import { ShieldCheck } from "lucide-react";

import { i18n, type AppLanguage } from "@/lib/i18n";
import type { ProtocolItem } from "@/lib/protocol";
import { ProtocolItemCard } from "@/components/protocol/ProtocolItemCard";
import { ProtocolSection } from "@/components/protocol/ProtocolSection";

export interface ProtocolGeneralRulesProps {
  items: ProtocolItem[];
  language: AppLanguage;
}

export function ProtocolGeneralRules({
  items,
  language,
}: ProtocolGeneralRulesProps) {
  if (items.length === 0) return null;

  return (
    <ProtocolSection
      eyebrow={i18n(language, {
        en: "Always-on rules",
        fr: "Règles permanentes",
      })}
      title={i18n(language, {
        en: "Principles to live by",
        fr: "Principes à respecter",
      })}
      description={i18n(language, {
        en: "Foundational habits that apply every day, all day. The base on which the rest of your protocol stands.",
        fr: "Habitudes fondamentales qui s'appliquent en continu. La base sur laquelle repose le reste de ton protocole.",
      })}
      icon={ShieldCheck}
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
