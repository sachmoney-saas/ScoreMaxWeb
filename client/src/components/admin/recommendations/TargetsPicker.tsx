import * as React from "react";
import { CheckCircle2, Search, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { WorkerAggregateCatalogEntry } from "@/lib/face-analysis-display";

export function TargetsPicker({
  catalog,
  values,
  onChange,
  /** Keys referenced by the condition — used to suggest auto-add. */
  conditionKeys,
}: {
  catalog: WorkerAggregateCatalogEntry[];
  values: string[];
  onChange: (values: string[]) => void;
  conditionKeys: string[];
}) {
  const [query, setQuery] = React.useState("");

  const filtered = React.useMemo(() => {
    if (!query.trim()) return catalog;
    const q = query.toLowerCase();
    return catalog.filter(
      (e) => e.key.toLowerCase().includes(q) || e.label.toLowerCase().includes(q),
    );
  }, [catalog, query]);

  const toggle = (key: string): void => {
    if (values.includes(key)) onChange(values.filter((v) => v !== key));
    else onChange([...values, key]);
  };

  const missingTargets = conditionKeys.filter((k) => !values.includes(k));

  return (
    <div className="space-y-2">
      {missingTargets.length > 0 ? (
        <div className="flex items-start gap-2 rounded-md border border-sky-300/20 bg-sky-400/[0.06] px-3 py-2 text-xs text-sky-100">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <div className="flex-1">
            <p className="font-semibold">Suggestion</p>
            <p className="mt-0.5 text-sky-200/90">
              Ces métriques sont utilisées dans tes conditions mais pas dans tes
              targets&nbsp;: <code className="font-mono text-[11px]">{missingTargets.join(", ")}</code>.
              Ajoute-les pour qu'elles influencent la pertinence et la copy "Pour toi".
            </p>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => onChange(Array.from(new Set([...values, ...missingTargets])))}
              className="mt-1.5 h-7 gap-1 text-xs text-sky-100 hover:bg-sky-400/10"
            >
              <CheckCircle2 className="h-3 w-3" />
              Ajouter les {missingTargets.length} métrique{missingTargets.length > 1 ? "s" : ""}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filtrer les métriques…"
          className="pl-8"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-md border border-dashed border-white/10 bg-white/[0.02] px-3 py-2 text-xs text-zinc-500">
          Aucune métrique ne correspond.
        </p>
      ) : (
        <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-white/10 bg-white/[0.02] p-2">
          {filtered.map((entry) => {
            const checked = values.includes(entry.key);
            return (
              <button
                key={entry.key}
                type="button"
                onClick={() => toggle(entry.key)}
                className={`flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left transition-colors ${
                  checked
                    ? "bg-emerald-400/10 text-emerald-100"
                    : "text-zinc-300 hover:bg-white/[0.04]"
                }`}
              >
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm">{entry.label}</span>
                  <span className="truncate font-mono text-[10px] text-zinc-500">
                    {entry.key}
                  </span>
                </div>
                {checked ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : null}
              </button>
            );
          })}
        </div>
      )}

      {values.length > 0 ? (
        <p className="text-[11px] text-zinc-500">
          {values.length} métrique{values.length > 1 ? "s" : ""} ciblée{values.length > 1 ? "s" : ""}
        </p>
      ) : null}
    </div>
  );
}
