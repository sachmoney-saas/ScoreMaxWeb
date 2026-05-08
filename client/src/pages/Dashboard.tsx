import * as React from "react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useLatestFaceAnalysis } from "@/hooks/use-supabase";
import { AnalysisResultsSection } from "@/components/analysis/AnalysisResultsSection";
import { analysisSurfaceCardClassName } from "@/components/analysis/analysis-styles";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
      <div className="flex w-full flex-1 flex-col items-center justify-start px-4 pt-[max(0.75rem,calc(env(safe-area-inset-top,0px)+0.5rem))] pb-12 sm:px-6 sm:py-16">
        <Card
          className={cn(
            analysisSurfaceCardClassName,
            "w-full max-w-lg rounded-2xl shadow-none sm:rounded-[2rem]",
          )}
        >
          <CardContent className="space-y-5 p-7 text-center sm:p-9">
            <h1 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
              {i18n(language, { en: "My Account", fr: "Mon compte" })}
            </h1>
            <p className="text-sm leading-relaxed text-zinc-300">
              {i18n(language, {
                en: "Start a first analysis to unlock your dashboard, scores and personalised recommendations.",
                fr: "Lance une première analyse pour afficher ton tableau de bord, tes scores et tes recommandations personnalisées.",
              })}
            </p>
            <Button
              asChild
              type="button"
              className={cn(
                "mt-1 h-11 w-full max-w-xs rounded-xl text-sm font-semibold shadow-md sm:mx-auto sm:w-auto sm:px-10",
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
          </CardContent>
        </Card>
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
