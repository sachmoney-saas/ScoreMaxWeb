import * as React from "react";
import { Redirect } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useLatestFaceAnalysis } from "@/hooks/use-supabase";
import { AnalysisResultsSection } from "@/components/analysis/AnalysisResultsSection";

export default function Dashboard() {
  const { user } = useAuth();
  const latestAnalysisQuery = useLatestFaceAnalysis({
    enabled: !!user?.id,
  });
  const latestAnalysis = latestAnalysisQuery.data ?? null;
  const isAnalysisLoading = latestAnalysisQuery.isLoading;

  if (latestAnalysisQuery.isSuccess && !latestAnalysis) {
    return <Redirect to="/app/new-analysis" />;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <AnalysisResultsSection
        analysis={latestAnalysis}
        isLoading={isAnalysisLoading}
      />
    </div>
  );
}
