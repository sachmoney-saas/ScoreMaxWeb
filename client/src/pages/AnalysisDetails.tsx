import * as React from "react";
import { useParams } from "wouter";
import { AnalysisResultsSection } from "@/components/analysis/AnalysisResultsSection";
import { analysisSurfaceCardClassName } from "@/components/analysis/workers/_shared";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAnalysisDetail } from "@/hooks/use-supabase";

function AnalysisDetailsSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-40 rounded-2xl" />
      <div className="flex flex-col gap-4">
        {[1, 2, 3, 4, 5, 6].map((item) => (
          <Skeleton key={item} className="h-48 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

export default function AnalysisDetails() {
  const params = useParams<{ jobId: string }>();
  const { data: analysis, isLoading, isError } = useAnalysisDetail(params.jobId);

  if (isLoading) {
    return <AnalysisDetailsSkeleton />;
  }

  if (isError || !analysis) {
    return (
      <Card className={analysisSurfaceCardClassName}>
        <CardContent className="relative p-5 text-zinc-50 sm:p-6">
          <h1 className="font-display text-2xl font-bold tracking-tight text-white">
            Analyse introuvable
          </h1>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-zinc-400">
            Cette analyse n'existe plus ou n'est pas accessible avec ton compte.
          </p>
        </CardContent>
      </Card>
    );
  }

  return <AnalysisResultsSection analysis={analysis} isLoading={false} />;
}
