import * as React from "react";
import { ArrowUpDown, Edit3, Search, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { extractReferencedKeys } from "@/lib/recommendation-condition";
import type {
  Recommendation,
  RecommendationType,
} from "@/lib/recommendations";

import {
  CategoryBadge,
  RiskBadge,
  TypeBadge,
  adminPanelClassName,
  describeConditionFor,
} from "./shared";
import {
  useDeleteRecommendation,
  useToggleRecommendationEnabled,
} from "./hooks";

type TypeFilter = "all" | RecommendationType;
type EnabledFilter = "all" | "enabled" | "disabled";
type SortKey = "priority" | "title" | "type" | "category";

export interface RecommendationsTableTabProps {
  worker: string;
  recommendations: Recommendation[];
  isLoading: boolean;
  onEdit: (rec: Recommendation) => void;
  filterByMetric: string | null;
  onClearMetricFilter: () => void;
}

export function RecommendationsTableTab({
  worker,
  recommendations,
  isLoading,
  onEdit,
  filterByMetric,
  onClearMetricFilter,
}: RecommendationsTableTabProps) {
  const [search, setSearch] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState<TypeFilter>("all");
  const [enabledFilter, setEnabledFilter] = React.useState<EnabledFilter>("all");
  const [sortKey, setSortKey] = React.useState<SortKey>("priority");
  const [sortAsc, setSortAsc] = React.useState(false);

  const filtered = React.useMemo(() => {
    let out = recommendations.filter((rec) => {
      if (typeFilter !== "all" && rec.type !== typeFilter) return false;
      if (enabledFilter === "enabled" && !(rec as Recommendation & { enabled: boolean }).enabled) return false;
      if (enabledFilter === "disabled" && (rec as Recommendation & { enabled: boolean }).enabled) return false;
      if (filterByMetric) {
        const usesIt =
          rec.targets.includes(filterByMetric) ||
          extractReferencedKeys(rec.conditions).includes(filterByMetric);
        if (!usesIt) return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        const haystack = `${rec.id} ${rec.title_fr} ${rec.title_en} ${rec.summary_fr}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    out = [...out].sort((a, b) => {
      const factor = sortAsc ? 1 : -1;
      switch (sortKey) {
        case "priority": return (a.priority - b.priority) * factor;
        case "title":    return a.title_fr.localeCompare(b.title_fr, "fr") * factor;
        case "type":     return a.type.localeCompare(b.type) * factor;
        case "category": return a.category.localeCompare(b.category) * factor;
      }
    });

    return out;
  }, [recommendations, typeFilter, enabledFilter, filterByMetric, search, sortKey, sortAsc]);

  const toggleSort = (key: SortKey): void => {
    if (key === sortKey) setSortAsc((v) => !v);
    else {
      setSortKey(key);
      setSortAsc(key === "title");
    }
  };

  const totalCount = recommendations.length;
  const filteredCount = filtered.length;

  return (
    <Card className={adminPanelClassName}>
      <CardContent className="space-y-4 p-4">
        <Filters
          search={search}
          onSearchChange={setSearch}
          typeFilter={typeFilter}
          onTypeChange={setTypeFilter}
          enabledFilter={enabledFilter}
          onEnabledChange={setEnabledFilter}
          filterByMetric={filterByMetric}
          onClearMetricFilter={onClearMetricFilter}
          totalCount={totalCount}
          filteredCount={filteredCount}
        />

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="rounded-md border border-dashed border-white/10 bg-white/[0.02] p-6 text-center text-sm text-zinc-400">
            Aucune recommandation ne correspond aux filtres.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-white/10 hover:bg-transparent">
                  <Th label="Recommandation" sortKey="title" current={sortKey} asc={sortAsc} onSort={toggleSort} />
                  <Th label="Type" sortKey="type" current={sortKey} asc={sortAsc} onSort={toggleSort} />
                  <Th label="Catégorie" sortKey="category" current={sortKey} asc={sortAsc} onSort={toggleSort} />
                  <Th label="Priorité" sortKey="priority" current={sortKey} asc={sortAsc} onSort={toggleSort} className="w-20" />
                  <TableHead className="text-zinc-400">Risque</TableHead>
                  <TableHead className="text-zinc-400">Matching</TableHead>
                  <TableHead className="text-zinc-400">Activée</TableHead>
                  <TableHead className="text-right text-zinc-400">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((rec) => (
                  <Row key={rec.id} worker={worker} rec={rec} onEdit={() => onEdit(rec)} />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* --------------------------------------------------------------- Sub-parts */

function Filters({
  search,
  onSearchChange,
  typeFilter,
  onTypeChange,
  enabledFilter,
  onEnabledChange,
  filterByMetric,
  onClearMetricFilter,
  totalCount,
  filteredCount,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  typeFilter: TypeFilter;
  onTypeChange: (v: TypeFilter) => void;
  enabledFilter: EnabledFilter;
  onEnabledChange: (v: EnabledFilter) => void;
  filterByMetric: string | null;
  onClearMetricFilter: () => void;
  totalCount: number;
  filteredCount: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative flex-1 min-w-[220px]">
        <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Rechercher par titre, ID, résumé…"
          className="pl-8"
        />
      </div>
      <Select value={typeFilter} onValueChange={(v) => onTypeChange(v as TypeFilter)}>
        <SelectTrigger className="h-10 w-32"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tous types</SelectItem>
          <SelectItem value="soft">Soft</SelectItem>
          <SelectItem value="hard">Hard</SelectItem>
        </SelectContent>
      </Select>
      <Select value={enabledFilter} onValueChange={(v) => onEnabledChange(v as EnabledFilter)}>
        <SelectTrigger className="h-10 w-36"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Activées + masquées</SelectItem>
          <SelectItem value="enabled">Activées</SelectItem>
          <SelectItem value="disabled">Masquées</SelectItem>
        </SelectContent>
      </Select>

      {filterByMetric ? (
        <button
          type="button"
          onClick={onClearMetricFilter}
          className="inline-flex items-center gap-1.5 rounded-full bg-sky-400/10 px-2 py-1 text-xs text-sky-100 ring-1 ring-inset ring-sky-300/20 hover:bg-sky-400/20"
        >
          <span>Métrique :</span>
          <code className="font-mono text-[10px]">{filterByMetric}</code>
          <X className="h-3 w-3" />
        </button>
      ) : null}

      <span className="ml-auto text-xs text-zinc-500">
        {filteredCount} / {totalCount}
      </span>
    </div>
  );
}

function Th({
  label,
  sortKey,
  current,
  asc,
  onSort,
  className,
}: {
  label: string;
  sortKey: SortKey;
  current: SortKey;
  asc: boolean;
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  const active = current === sortKey;
  return (
    <TableHead className={`text-zinc-400 ${className ?? ""}`}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 transition-colors ${active ? "text-white" : "hover:text-white"}`}
      >
        {label}
        <ArrowUpDown className={`h-3 w-3 ${active ? "opacity-100" : "opacity-30"} ${active && !asc ? "rotate-180" : ""}`} />
      </button>
    </TableHead>
  );
}

function Row({
  worker,
  rec,
  onEdit,
}: {
  worker: string;
  rec: Recommendation;
  onEdit: () => void;
}) {
  const toggle = useToggleRecommendationEnabled();
  const remove = useDeleteRecommendation();
  const { toast } = useToast();
  const enabled = (rec as Recommendation & { enabled: boolean }).enabled ?? true;
  const description = React.useMemo(
    () => describeConditionFor(worker, rec.conditions),
    [worker, rec.conditions],
  );

  const handleDelete = (): void => {
    remove.mutate(
      { id: rec.id, worker: rec.worker },
      {
        onSuccess: () => toast({ title: "Recommandation supprimée", description: rec.id }),
        onError: (error) =>
          toast({
            variant: "destructive",
            title: "Suppression impossible",
            description: error instanceof Error ? error.message : String(error),
          }),
      },
    );
  };

  return (
    <TableRow className="border-white/10 hover:bg-white/[0.06]">
      <TableCell className="min-w-72">
        <div className="flex flex-col gap-1">
          <span className="font-medium text-white">{rec.title_fr}</span>
          <span className="font-mono text-[10px] text-zinc-500">{rec.id}</span>
          {rec.targets.length > 0 ? (
            <div className="mt-1 flex flex-wrap gap-1">
              {rec.targets.slice(0, 3).map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-white/[0.05] px-1.5 py-0.5 font-mono text-[9px] text-zinc-400"
                  title={t}
                >
                  {t.split(".").pop()}
                </span>
              ))}
              {rec.targets.length > 3 ? (
                <span className="text-[9px] text-zinc-500">+{rec.targets.length - 3}</span>
              ) : null}
            </div>
          ) : null}
        </div>
      </TableCell>
      <TableCell><TypeBadge type={rec.type} /></TableCell>
      <TableCell><CategoryBadge category={rec.category} /></TableCell>
      <TableCell className="text-sm tabular-nums text-zinc-200">{rec.priority}</TableCell>
      <TableCell><RiskBadge risk={rec.risk} /></TableCell>
      <TableCell className="max-w-sm">
        <p
          className="line-clamp-2 text-[11px] leading-relaxed text-zinc-300"
          title={description}
        >
          {description}
        </p>
      </TableCell>
      <TableCell>
        <Switch
          checked={enabled}
          disabled={toggle.isPending}
          onCheckedChange={(v) => toggle.mutate({ id: rec.id, worker: rec.worker, enabled: v })}
        />
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onEdit}
            className="h-8 gap-1 text-zinc-300 hover:text-white"
          >
            <Edit3 className="h-3 w-3" />
            Éditer
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-rose-300 hover:bg-rose-500/10 hover:text-rose-200"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Supprimer cette recommandation ?</AlertDialogTitle>
                <AlertDialogDescription>
                  <code className="font-mono text-xs">{rec.id}</code> · {rec.title_fr}
                  <br />
                  Action irréversible. Les actions utilisateurs liées seront supprimées en cascade.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-rose-500 text-white hover:bg-rose-600"
                >
                  Supprimer
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </TableCell>
    </TableRow>
  );
}
