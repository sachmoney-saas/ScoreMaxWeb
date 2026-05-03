import * as React from "react";
import { Link } from "wouter";
import { ArrowRight, Search, Sparkles } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import {
  getWorkerDisplayLabel,
  listKnownWorkers,
} from "@/lib/face-analysis-display";
import type { Recommendation } from "@/lib/recommendations";

import { useAllAdminRecommendations } from "./hooks";
import {
  AccessDenied,
  PageHeader,
  Stat,
  adminPanelClassName,
} from "./shared";

type WorkerStats = {
  worker: string;
  label: string;
  soft: number;
  hard: number;
  enabled: number;
  disabled: number;
  total: number;
};

function aggregateByWorker(recs: Recommendation[]): Map<string, WorkerStats> {
  const map = new Map<string, WorkerStats>();
  for (const rec of recs) {
    const cur = map.get(rec.worker) ?? {
      worker: rec.worker,
      label: getWorkerDisplayLabel(rec.worker),
      soft: 0,
      hard: 0,
      enabled: 0,
      disabled: 0,
      total: 0,
    };
    cur.total += 1;
    if (rec.type === "soft") cur.soft += 1;
    if (rec.type === "hard") cur.hard += 1;
    if ((rec as Recommendation & { enabled: boolean }).enabled) cur.enabled += 1;
    else cur.disabled += 1;
    map.set(rec.worker, cur);
  }
  return map;
}

export function RecommendationsOverview() {
  const { isAdmin } = useAuth();
  const { data: all = [], isLoading } = useAllAdminRecommendations();
  const [search, setSearch] = React.useState("");

  if (!isAdmin) return <AccessDenied />;

  const workers = listKnownWorkers();
  const statsByWorker = aggregateByWorker(all);

  const cards: WorkerStats[] = workers.map((worker) => {
    return (
      statsByWorker.get(worker) ?? {
        worker,
        label: getWorkerDisplayLabel(worker),
        soft: 0,
        hard: 0,
        enabled: 0,
        disabled: 0,
        total: 0,
      }
    );
  });

  const filtered = cards.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return c.worker.toLowerCase().includes(q) || c.label.toLowerCase().includes(q);
  });

  const totalsCovered = cards.filter((c) => c.total > 0).length;
  const totalRecs = all.length;
  const totalEnabled = all.filter(
    (r) => (r as Recommendation & { enabled: boolean }).enabled,
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Recommandations"
        description="Édite le contenu éditorial servi à tes utilisateurs. Chaque recommandation cible un worker, un set de métriques, et n'apparaît que si ses conditions de matching sont vraies pour le rapport de l'utilisateur."
      />

      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-2xl" />
          ))}
        </div>
      ) : (
        <>
          <Card className={adminPanelClassName}>
            <CardContent className="grid grid-cols-2 gap-6 p-6 md:grid-cols-4">
              <Stat label="Workers couverts" value={totalsCovered} hint={`/ ${workers.length}`} />
              <Stat label="Recos totales" value={totalRecs} />
              <Stat label="Activées" value={totalEnabled} accent="emerald" />
              <Stat label="Masquées" value={totalRecs - totalEnabled} accent="amber" />
            </CardContent>
          </Card>

          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filtrer les workers…"
              className="pl-8"
            />
          </div>

          {filtered.length === 0 ? (
            <Card className={adminPanelClassName}>
              <CardContent className="p-6 text-sm text-zinc-300">
                Aucun worker ne correspond.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((c) => (
                <WorkerCard key={c.worker} stats={c} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function WorkerCard({ stats }: { stats: WorkerStats }) {
  const isEmpty = stats.total === 0;
  return (
    <Link href={`/admin/recommendations/${stats.worker}`}>
      <Card
        className={`${adminPanelClassName} group cursor-pointer transition-transform hover:-translate-y-0.5`}
      >
        <CardContent className="space-y-3 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
                {stats.worker}
              </p>
              <h3 className="mt-1 font-display text-lg font-bold leading-tight tracking-tight text-white">
                {stats.label}
              </h3>
            </div>
            <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-zinc-500 transition-transform group-hover:translate-x-0.5 group-hover:text-white" />
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="rounded-full bg-emerald-400/12 px-2 py-0.5 text-emerald-200 ring-1 ring-inset ring-emerald-300/20">
              {stats.soft} soft
            </span>
            <span className="rounded-full bg-rose-400/12 px-2 py-0.5 text-rose-200 ring-1 ring-inset ring-rose-300/20">
              {stats.hard} hard
            </span>
            {stats.disabled > 0 ? (
              <span className="rounded-full bg-amber-400/12 px-2 py-0.5 text-amber-200 ring-1 ring-inset ring-amber-300/20">
                {stats.disabled} masquée{stats.disabled > 1 ? "s" : ""}
              </span>
            ) : null}
          </div>

          {isEmpty ? (
            <p className="inline-flex items-center gap-1 rounded-md bg-white/[0.05] px-2 py-1 text-[11px] text-zinc-400">
              <Sparkles className="h-3 w-3" />
              Aucune reco — à créer
            </p>
          ) : (
            <p className="text-xs text-zinc-500">
              {stats.total} reco{stats.total > 1 ? "s" : ""} totale{stats.total > 1 ? "s" : ""}
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
