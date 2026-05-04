import { Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

type AnalysisProcessingStateProps = {
  message?: string | null;
  /** Sans ligne « Analyse IA » ni icône étoiles (ex. page Nouvelle analyse). */
  minimalChrome?: boolean;
  /**
   * Job finished côté serveur ; on attend la redirection client.
   * Évite une barre à ~66 % qui paraît « bloquée ».
   */
  awaitingRedirect?: boolean;
  /** Fond clair (carte) ou glass sombre (ex. onboarding). */
  theme?: "light" | "dark";
};

export function AnalysisProcessingState({
  message,
  minimalChrome = false,
  awaitingRedirect = false,
  theme = "light",
}: AnalysisProcessingStateProps) {
  const isDark = theme === "dark";

  return (
    <div
      className={cn(
        "rounded-[1.5rem] p-5 text-center sm:p-8",
        isDark
          ? "border border-white/12 bg-white/[0.06] shadow-[0_0_0_1px_rgba(255,255,255,0.04)_inset] backdrop-blur-md"
          : "border border-slate-200 bg-[radial-gradient(circle_at_top,rgba(15,23,42,0.08),transparent_42%),linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)]",
      )}
    >
      <div
        className={cn(
          "mx-auto flex h-24 w-24 items-center justify-center rounded-full border shadow-[0_20px_55px_-35px_rgba(15,23,42,0.8)]",
          isDark
            ? "border-white/15 bg-white/10"
            : "border border-slate-200 bg-white",
        )}
      >
        <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-slate-950 text-white">
          <div
            className={cn(
              "absolute inset-[-10px] animate-spin rounded-full border border-t-slate-950",
              isDark ? "border-white/20 border-t-white" : "border-slate-300 border-t-slate-950",
            )}
          />
          {!minimalChrome ? <Sparkles className="h-7 w-7" /> : null}
        </div>
      </div>

      <div className="mx-auto mt-6 max-w-md space-y-3">
        {!minimalChrome ? (
          <p
            className={cn(
              "text-[11px] font-semibold uppercase tracking-[0.16em]",
              isDark ? "text-zinc-400" : "text-slate-500",
            )}
          >
            Analyse IA en cours
          </p>
        ) : null}
        <h1
          className={cn(
            "font-display text-2xl font-bold leading-tight tracking-tight sm:text-[2rem]",
            isDark ? "text-white" : "text-slate-950",
          )}
        >
          ScoreMax analyse tes photos
        </h1>
        <p
          className={cn(
            "text-sm leading-relaxed sm:text-base",
            isDark ? "text-zinc-300" : "text-slate-600",
          )}
        >
          On prépare ton diagnostic visage et on sécurise les résultats avant de
          t&apos;envoyer vers ton dashboard.
        </p>
      </div>

      <div
        className={cn(
          "mx-auto mt-7 max-w-md rounded-2xl p-4 text-left shadow-sm",
          isDark
            ? "border border-white/10 bg-black/25"
            : "border border-slate-200 bg-white/80",
        )}
      >
        <div className="flex items-center gap-3">
          <Loader2
            className={cn("h-5 w-5 animate-spin", isDark ? "text-zinc-200" : "text-slate-900")}
          />
          <div>
            <p className={cn("text-sm font-semibold", isDark ? "text-white" : "text-slate-900")}>
              {message ?? "Analyse ScoreMax en cours..."}
            </p>
            <p className={cn("text-xs", isDark ? "text-zinc-400" : "text-slate-500")}>
              Cette étape peut prendre quelques instants.
            </p>
          </div>
        </div>
        <div
          className={cn("mt-4 h-2 overflow-hidden rounded-full", isDark ? "bg-white/10" : "bg-slate-100")}
        >
          <div
            className={
              awaitingRedirect
                ? cn(
                    "h-full w-full animate-pulse rounded-full",
                    isDark ? "bg-white" : "bg-slate-950",
                  )
                : cn(
                    "h-full w-2/3 animate-pulse rounded-full",
                    isDark ? "bg-white" : "bg-slate-950",
                  )
            }
          />
        </div>
      </div>
    </div>
  );
}
