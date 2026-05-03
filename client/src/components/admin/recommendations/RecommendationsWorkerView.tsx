import * as React from "react";
import { Link, useParams } from "wouter";
import { ArrowLeft, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import {
  getWorkerDisplayLabel,
  listWorkerAggregateCatalog,
} from "@/lib/face-analysis-display";
import type { Recommendation } from "@/lib/recommendations";

import { useAdminWorkerRecommendations } from "./hooks";
import { MetricsCatalogTab } from "./MetricsCatalogTab";
import { RecommendationEditor } from "./RecommendationEditor";
import { RecommendationsTableTab } from "./RecommendationsTableTab";
import {
  AccessDenied,
  PageHeader,
  Stat,
  adminPanelClassName,
} from "./shared";

export function RecommendationsWorkerView() {
  const { isAdmin } = useAuth();
  const params = useParams<{ worker: string }>();
  const worker = params.worker ?? "";

  const { data: recs = [], isLoading } = useAdminWorkerRecommendations(worker);
  const catalog = React.useMemo(
    () => listWorkerAggregateCatalog(worker),
    [worker],
  );

  const [editing, setEditing] = React.useState<Recommendation | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [tab, setTab] = React.useState<"recommendations" | "metrics">("recommendations");
  const [metricFilter, setMetricFilter] = React.useState<string | null>(null);

  if (!isAdmin) return <AccessDenied />;

  const softCount = recs.filter((r) => r.type === "soft").length;
  const hardCount = recs.filter((r) => r.type === "hard").length;

  const handleFilterByMetric = (key: string): void => {
    setMetricFilter(key);
    setTab("recommendations");
  };

  return (
    <div className="space-y-6">
      <Button
        asChild
        variant="ghost"
        className="rounded-full border border-white/15 bg-white/5 text-white hover:bg-white/10"
      >
        <Link href="/admin/recommendations">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour à la vue d'ensemble
        </Link>
      </Button>

      <PageHeader
        title={`${getWorkerDisplayLabel(worker)}`}
        description={`Worker code: ${worker} · ${catalog.length} métriques documentées · ${recs.length} recommandation${recs.length > 1 ? "s" : ""} en base`}
        actions={
          <Button
            onClick={() => setCreating(true)}
            className="gap-2 bg-white text-zinc-900 hover:bg-zinc-200"
          >
            <Plus className="h-4 w-4" />
            Nouvelle recommandation
          </Button>
        }
      />

      <Card className={adminPanelClassName}>
        <CardContent className="grid grid-cols-2 gap-6 p-6 md:grid-cols-4">
          <Stat label="Métriques" value={catalog.length} />
          <Stat label="Recos totales" value={recs.length} />
          <Stat label="Soft" value={softCount} accent="emerald" />
          <Stat label="Hard" value={hardCount} accent="rose" />
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList className="bg-white/[0.03]">
          <TabsTrigger value="recommendations" className="data-[state=active]:bg-white data-[state=active]:text-zinc-900">
            Recommandations <span className="ml-1.5 text-xs opacity-70">({recs.length})</span>
          </TabsTrigger>
          <TabsTrigger value="metrics" className="data-[state=active]:bg-white data-[state=active]:text-zinc-900">
            Métriques <span className="ml-1.5 text-xs opacity-70">({catalog.length})</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="recommendations" className="mt-4">
          <RecommendationsTableTab
            worker={worker}
            recommendations={recs}
            isLoading={isLoading}
            onEdit={(rec) => setEditing(rec)}
            filterByMetric={metricFilter}
            onClearMetricFilter={() => setMetricFilter(null)}
          />
        </TabsContent>

        <TabsContent value="metrics" className="mt-4">
          <MetricsCatalogTab
            worker={worker}
            entries={catalog}
            recommendations={recs}
            onFilterByKey={handleFilterByMetric}
          />
        </TabsContent>
      </Tabs>

      <RecommendationEditor
        worker={worker}
        catalog={catalog}
        rec={editing}
        open={!!editing || creating}
        onClose={() => {
          setEditing(null);
          setCreating(false);
        }}
      />
    </div>
  );
}
