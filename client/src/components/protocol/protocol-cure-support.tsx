import { i18n, type AppLanguage } from "@/lib/i18n";
import type { ProtocolCure } from "@/lib/protocol";

export function CureProgressBar({ progress }: { progress: number }) {
  const pct = Math.round(progress * 100);
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200">
      <div
        className="h-full rounded-full bg-gradient-to-r from-emerald-600/85 to-emerald-500/90"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function CureTrailing({
  cure,
  language,
}: {
  cure: ProtocolCure;
  language: AppLanguage;
}) {
  if (cure.totalDays === null) {
    return (
      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-700 ring-1 ring-zinc-200/80">
        {i18n(language, { en: "Ongoing", fr: "En cours" })}
      </span>
    );
  }

  const remaining = Math.max(0, cure.totalDays - cure.elapsedDays);
  const isDone = cure.progress !== null && cure.progress >= 1;

  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums ring-1 ring-inset ${
        isDone
          ? "bg-emerald-100 text-emerald-900 ring-emerald-200"
          : "bg-zinc-100 text-zinc-700 ring-zinc-200/80"
      }`}
    >
      {isDone
        ? i18n(language, { en: "Completed", fr: "Terminée" })
        : i18n(language, {
            en: `${remaining}d left`,
            fr: `${remaining} j restant${remaining > 1 ? "s" : ""}`,
          })}
    </span>
  );
}
