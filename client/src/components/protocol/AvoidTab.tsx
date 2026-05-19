import { cn } from "@/lib/utils";
import { i18n, type AppLanguage } from "@/lib/i18n";
import type { LocalisedAvoidItem } from "@shared/protocol-presets";
import type { ProtocolItem } from "@/lib/protocol";
import { ProtocolItemCard } from "@/components/protocol/ProtocolItemCard";

export interface AvoidTabProps {
  language: AppLanguage;
  items: LocalisedAvoidItem[];
  recommendations?: ProtocolItem[];
}

export function AvoidTab({
  language,
  items,
  recommendations = [],
}: AvoidTabProps) {
  if (items.length === 0 && recommendations.length === 0) {
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
    <div className="space-y-4">
      {recommendations.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {recommendations.map((item) => (
            <ProtocolItemCard
              key={item.action.id}
              item={item}
              language={language}
              surface="glass"
            />
          ))}
        </div>
      ) : null}

      {items.length > 0 ? (
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
      ) : null}
    </div>
  );
}
