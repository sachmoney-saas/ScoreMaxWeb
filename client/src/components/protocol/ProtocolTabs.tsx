import { cn } from "@/lib/utils";
import { i18n, type AppLanguage } from "@/lib/i18n";

export type ProtocolMainTab = "routine" | "avoid";

export interface ProtocolTabsProps {
  language: AppLanguage;
  active: ProtocolMainTab;
  onChange: (tab: ProtocolMainTab) => void;
}

export function ProtocolTabs({ language, active, onChange }: ProtocolTabsProps) {
  const tabs: { id: ProtocolMainTab; label: { en: string; fr: string } }[] = [
    { id: "routine", label: { en: "Routine", fr: "Routine" } },
    { id: "avoid", label: { en: "Avoid", fr: "À bannir" } },
  ];

  return (
    <div
      role="tablist"
      aria-label={i18n(language, {
        en: "Protocol sections",
        fr: "Sections du protocole",
      })}
      className="flex gap-6 border-b border-white/10"
    >
      {tabs.map((tab) => {
        const selected = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(tab.id)}
            className={cn(
              "-mb-px border-b-2 pb-2.5 text-sm font-semibold tracking-tight transition-colors",
              selected
                ? "border-zinc-100 text-zinc-50"
                : "border-transparent text-zinc-500 hover:text-zinc-300",
            )}
          >
            {i18n(language, tab.label)}
          </button>
        );
      })}
    </div>
  );
}
