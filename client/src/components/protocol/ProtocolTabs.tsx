import { cn } from "@/lib/utils";
import { i18n, type AppLanguage } from "@/lib/i18n";

export type ProtocolMainTab = "routine" | "todo" | "avoid";

export interface ProtocolTabsProps {
  language: AppLanguage;
  active: ProtocolMainTab;
  onChange: (tab: ProtocolMainTab) => void;
}

export function ProtocolTabs({ language, active, onChange }: ProtocolTabsProps) {
  const tabs: { id: ProtocolMainTab; label: { en: string; fr: string } }[] = [
    { id: "routine", label: { en: "Routine", fr: "Routine" } },
    { id: "todo", label: { en: "To do", fr: "À réaliser" } },
    { id: "avoid", label: { en: "Avoid", fr: "À Bannir" } },
  ];

  return (
    <div
      role="tablist"
      aria-label={i18n(language, {
        en: "Protocol sections",
        fr: "Sections du protocole",
      })}
      className="flex gap-4 overflow-x-auto border-b border-white/10 sm:gap-6"
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
              "-mb-px shrink-0 border-b-2 pb-2.5 text-sm font-semibold tracking-tight text-white transition-colors",
              selected
                ? "border-zinc-100"
                : "border-transparent opacity-75 hover:opacity-100",
            )}
          >
            {i18n(language, tab.label)}
          </button>
        );
      })}
    </div>
  );
}
