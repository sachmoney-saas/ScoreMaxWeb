import * as React from "react";
import { useParams } from "wouter";
import { AnalysisResultsSection } from "@/components/analysis/AnalysisResultsSection";
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
      <Card className="border-white/15 bg-white/10 text-white backdrop-blur-xl">
        <CardContent className="p-6">
          <h1 className="font-display text-2xl font-bold">Analyse introuvable</h1>
          <p className="mt-2 text-sm text-zinc-300">
            Cette analyse n'existe plus ou n'est pas accessible avec ton compte.
          </p>
        </CardContent>
      </Card>
    );
  }

  return <AnalysisResultsSection analysis={analysis} isLoading={false} />;
}
