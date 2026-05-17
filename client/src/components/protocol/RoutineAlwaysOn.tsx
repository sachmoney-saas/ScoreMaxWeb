import { i18n, type AppLanguage } from "@/lib/i18n";
import type { LocalisedAlwaysOnItem } from "@shared/protocol-presets";

export interface RoutineAlwaysOnProps {
  language: AppLanguage;
  items: LocalisedAlwaysOnItem[];
}

export function RoutineAlwaysOn({ language, items }: RoutineAlwaysOnProps) {
  if (items.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
      <header className="border-b border-zinc-100 bg-zinc-50/80 px-4 py-3">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
          {i18n(language, {
            en: "Every day",
            fr: "Tous les jours",
          })}
        </h3>
      </header>
      <ul className="divide-y divide-zinc-100 px-4 py-1">
        {items.map((item) => (
          <li key={item.id} className="py-3 text-sm leading-snug">
            <p className="font-medium text-zinc-900">{item.title}</p>
            {item.detail ? (
              <p className="mt-0.5 text-[13px] text-zinc-600">{item.detail}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
