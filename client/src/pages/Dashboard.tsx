import * as React from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLatestFaceAnalysis } from "@/hooks/use-supabase";
import { AnalysisResultsSection } from "@/components/analysis/AnalysisResultsSection";

export default function Dashboard() {
  const { user } = useAuth();
  const { data: latestAnalysis, isLoading: isAnalysisLoading } =
    useLatestFaceAnalysis({
      enabled: !!user?.id,
    });

  return (
    <div className="space-y-8">
      <AnalysisResultsSection
        analysis={latestAnalysis}
        isLoading={isAnalysisLoading}
      />
    </div>
  );
}
