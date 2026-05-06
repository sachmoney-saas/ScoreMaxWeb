import * as React from "react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useLatestFaceAnalysis } from "@/hooks/use-supabase";
import { AnalysisResultsSection } from "@/components/analysis/AnalysisResultsSection";
import { Button } from "@/components/ui/button";
import { i18n, useAppLanguage } from "@/lib/i18n";
import { primaryCtaSurfaceClassName } from "@/lib/cta-button-styles";
import { cn } from "@/lib/utils";

export default function Dashboard() {
  const language = useAppLanguage();
  const { user } = useAuth();
  const { data: latestAnalysis, isLoading: isAnalysisLoading } =
    useLatestFaceAnalysis({
      enabled: !!user?.id,
    });

  if (!isAnalysisLoading && !latestAnalysis) {
    return (
      <div className="flex w-full flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <div className="w-full max-w-md space-y-4">
          <h1 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
            {i18n(language, { en: "My Account", fr: "Mon compte" })}
          </h1>
          <p className="text-sm leading-relaxed text-zinc-400">
            {i18n(language, {
              en: "Start a first analysis to unlock your dashboard, scores and personalised recommendations.",
              fr: "Lance une première analyse pour afficher ton tableau de bord, tes scores et tes recommandations personnalisées.",
            })}
          </p>
          <Button
            asChild
            type="button"
            className={cn(
              "mt-2 h-11 w-full max-w-xs rounded-xl text-sm font-semibold shadow-md sm:w-auto sm:px-10",
              primaryCtaSurfaceClassName,
            )}
          >
            <Link href="/app/new-analysis">
              {i18n(language, {
                en: "New analysis",
                fr: "Nouvelle analyse",
              })}
            </Link>
          </Button>
        </div>
      </div>
    );
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
