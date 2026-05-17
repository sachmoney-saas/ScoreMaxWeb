import { cn } from "@/lib/utils";
import { i18n, type AppLanguage } from "@/lib/i18n";
import type { LocalisedAvoidItem } from "@shared/protocol-presets";

export interface AvoidTabProps {
  language: AppLanguage;
  items: LocalisedAvoidItem[];
}

export function AvoidTab({ language, items }: AvoidTabProps) {
  if (items.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-zinc-500">
        {i18n(language, {
          en: "Nothing to avoid yet.",
          fr: "Rien à bannir pour l'instant.",
        })}
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li
          key={item.id}
          className={cn(
            "border-l-2 py-2 pl-3 text-sm leading-snug",
            item.severity === "danger"
              ? "border-rose-500/80"
              : "border-zinc-600",
          )}
        >
          <p className="font-medium text-zinc-100">{item.title}</p>
          {item.detail ? (
            <p className="mt-0.5 text-[13px] text-zinc-400">{item.detail}</p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
