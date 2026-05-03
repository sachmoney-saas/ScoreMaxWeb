import * as React from "react";
import { Copy, Hash, Link2, ListChecks, Type } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import type { WorkerAggregateCatalogEntry } from "@/lib/face-analysis-display";
import { getAllowedEnumValues } from "@/lib/aggregate-allowed-values";
import { extractReferencedKeys } from "@/lib/recommendation-condition";
import type { Recommendation } from "@/lib/recommendations";

import { adminPanelClassName } from "./shared";

/**
 * Map every aggregate to the recos that target or condition on it.
 * Pre-computed once per render so each card knows its "linked recos" count.
 */
function indexRecsByKey(
  recs: Recommendation[],
): Map<string, { targeting: number; conditioning: number }> {
  const out = new Map<string, { targeting: number; conditioning: number }>();
  const bump = (key: string, kind: "targeting" | "conditioning") => {
    const cur = out.get(key) ?? { targeting: 0, conditioning: 0 };
    cur[kind] += 1;
    out.set(key, cur);
  };
  for (const r of recs) {
    for (const t of r.targets) bump(t, "targeting");
    for (const c of extractReferencedKeys(r.conditions)) bump(c, "conditioning");
  }
  return out;
}

export interface MetricsCatalogTabProps {
  worker: string;
  entries: WorkerAggregateCatalogEntry[];
  recommendations: Recommendation[];
  onFilterByKey?: (key: string) => void;
}

export function MetricsCatalogTab({
  worker,
  entries,
  recommendations,
  onFilterByKey,
}: MetricsCatalogTabProps) {
  const { toast } = useToast();
  const usage = React.useMemo(() => indexRecsByKey(recommendations), [recommendations]);

  if (entries.length === 0) {
    return (
      <Card className={adminPanelClassName}>
        <CardContent className="p-6 text-sm text-zinc-300">
          Aucune métrique documentée pour ce worker.
        </CardContent>
      </Card>
    );
  }

  const grouped = React.useMemo(() => {
    const groups = new Map<string, WorkerAggregateCatalogEntry[]>();
    for (const e of entries) {
      const ns = e.key.includes(".") ? e.key.split(".")[0] : "—";
      const arr = groups.get(ns) ?? [];
      arr.push(e);
      groups.set(ns, arr);
    }
    return Array.from(groups.entries());
  }, [entries]);

  const copy = (key: string): void => {
    void navigator.clipboard.writeText(key).then(() => {
      toast({ title: "Clé copiée", description: key });
    });
  };

  return (
    <div className="space-y-5">
      <CatalogLegend />
      {grouped.map(([namespace, group]) => (
        <section key={namespace} className="space-y-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
            {namespace.replace(/_/g, " ")}
          </h3>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {group.map((entry) => (
              <MetricCard
                key={entry.key}
                worker={worker}
                entry={entry}
                usage={usage.get(entry.key)}
                onCopy={() => copy(entry.key)}
                onFilter={onFilterByKey ? () => onFilterByKey(entry.key) : undefined}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function CatalogLegend() {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-[11px] text-zinc-400">
      <span className="font-semibold uppercase tracking-[0.12em] text-zinc-300">
        Légende
      </span>
      <span className="inline-flex items-center gap-1">
        <Hash className="h-3 w-3" /> score (0→10)
      </span>
      <span className="inline-flex items-center gap-1">
        <ListChecks className="h-3 w-3" /> enum (valeurs fixes)
      </span>
      <span className="inline-flex items-center gap-1">
        <Type className="h-3 w-3" /> texte
      </span>
      <span className="inline-flex items-center gap-1 text-emerald-200">
        ⌖ ciblée par X recos
      </span>
      <span className="inline-flex items-center gap-1 text-sky-200">
        ⚙ utilisée dans X conditions
      </span>
    </div>
  );
}

function MetricCard({
  worker,
  entry,
  usage,
  onCopy,
  onFilter,
}: {
  worker: string;
  entry: WorkerAggregateCatalogEntry;
  usage: { targeting: number; conditioning: number } | undefined;
  onCopy: () => void;
  onFilter?: () => void;
}) {
  const allowedValues = React.useMemo(() => {
    const registry = getAllowedEnumValues(worker, entry.key);
    if (registry && registry.length > 0) return Array.from(registry);
    return entry.enumValues?.map((v) => v.value) ?? [];
  }, [worker, entry.key, entry.enumValues]);

  const isUndocumented =
    entry.kind === "enum" && getAllowedEnumValues(worker, entry.key) === null;

  return (
    <Card className="relative overflow-hidden border-white/10 bg-white/[0.03]">
      <CardContent className="space-y-3 p-4">
        <header className="space-y-1">
          <div className="flex items-start justify-between gap-2">
            <h4 className="font-display text-sm font-semibold leading-tight text-white">
              {entry.label}
            </h4>
            <KindBadge kind={entry.kind} />
          </div>
          <code className="block break-all font-mono text-[10px] text-zinc-500">
            {entry.key}
          </code>
        </header>

        <div className="text-xs">
          {entry.kind === "score" || entry.kind === "number" ? (
            <p className="text-zinc-400">Plage attendue : <span className="text-zinc-200">0 → 10</span></p>
          ) : entry.kind === "enum" ? (
            allowedValues.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {allowedValues.map((v) => (
                  <span
                    key={v}
                    className="rounded-full bg-white/[0.05] px-2 py-0.5 font-mono text-[10px] text-zinc-300"
                  >
                    {v}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-amber-300">
                Valeurs non documentées — ajoute-les dans
                <code className="mx-1 font-mono">aggregate-allowed-values.ts</code>
              </p>
            )
          ) : (
            <p className="text-zinc-500">Type : {entry.kind ?? "inconnu"}</p>
          )}
          {isUndocumented ? null : null}
        </div>

        {usage && (usage.targeting > 0 || usage.conditioning > 0) ? (
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            {usage.targeting > 0 ? (
              <Badge
                variant="outline"
                className="border-emerald-300/30 bg-emerald-400/10 text-emerald-100"
              >
                ⌖ {usage.targeting} ciblage{usage.targeting > 1 ? "s" : ""}
              </Badge>
            ) : null}
            {usage.conditioning > 0 ? (
              <Badge
                variant="outline"
                className="border-sky-300/30 bg-sky-400/10 text-sky-100"
              >
                ⚙ {usage.conditioning} condition{usage.conditioning > 1 ? "s" : ""}
              </Badge>
            ) : null}
          </div>
        ) : (
          <p className="text-[11px] text-zinc-500">
            Pas encore utilisée par une reco.
          </p>
        )}

        <div className="flex items-center justify-end gap-1 pt-1">
          {onFilter && usage && (usage.targeting + usage.conditioning) > 0 ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={onFilter}
              className="h-7 gap-1 text-[11px] text-zinc-400 hover:text-white"
            >
              <Link2 className="h-3 w-3" />
              Voir recos
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onCopy}
            className="h-7 gap-1 text-[11px] text-zinc-400 hover:text-white"
          >
            <Copy className="h-3 w-3" />
            Copier la clé
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function KindBadge({ kind }: { kind: WorkerAggregateCatalogEntry["kind"] }) {
  const map = {
    score:   { Icon: Hash,       cls: "bg-sky-400/15 text-sky-200 ring-sky-300/20" },
    number:  { Icon: Hash,       cls: "bg-sky-400/15 text-sky-200 ring-sky-300/20" },
    enum:    { Icon: ListChecks, cls: "bg-violet-400/15 text-violet-200 ring-violet-300/20" },
    text:    { Icon: Type,       cls: "bg-zinc-400/15 text-zinc-200 ring-zinc-300/20" },
    list:    { Icon: ListChecks, cls: "bg-zinc-400/15 text-zinc-200 ring-zinc-300/20" },
    boolean: { Icon: ListChecks, cls: "bg-zinc-400/15 text-zinc-200 ring-zinc-300/20" },
  } as const;
  const info = kind ? map[kind] : null;
  if (!info) {
    return (
      <span className="rounded-full bg-zinc-400/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] text-zinc-400">
        ?
      </span>
    );
  }
  const { Icon, cls } = info;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] ring-1 ring-inset ${cls}`}
    >
      <Icon className="h-2.5 w-2.5" />
      {kind}
    </span>
  );
}
