import * as React from "react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useLatestFaceAnalysis } from "@/hooks/use-supabase";
import { AnalysisResultsSection } from "@/components/analysis/AnalysisResultsSection";
import { Button } from "@/components/ui/button";
import { i18n, useAppLanguage } from "@/lib/i18n";

export default function Dashboard() {
  const language = useAppLanguage();
  const { user } = useAuth();
  const { data: latestAnalysis, isLoading: isAnalysisLoading } =
    useLatestFaceAnalysis({
      enabled: !!user?.id,
    });

  if (!isAnalysisLoading && !latestAnalysis) {
    return (
      <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center px-4 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] pt-4 sm:px-6">
        <Button
          asChild
          type="button"
          className="flex h-auto w-full max-w-sm items-center justify-center gap-3 rounded-2xl bg-black px-4 py-3.5 text-white shadow-[0_16px_30px_-18px_rgba(0,0,0,0.95)] transition hover:bg-[#050505] sm:max-w-md"
        >
          <Link href="/app/new-analysis">
            <img
              src="/favicon.png"
              alt=""
              className="h-10 w-10 shrink-0 rounded-lg bg-black object-contain"
            />
            <span className="text-sm font-semibold tracking-tight sm:text-base">
              {i18n(language, {
                en: "New analysis",
                fr: "Nouvelle analyse",
              })}
            </span>
          </Link>
        </Button>
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
