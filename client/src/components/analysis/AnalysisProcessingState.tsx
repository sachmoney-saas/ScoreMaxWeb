import { Loader2, Sparkles } from "lucide-react";

type AnalysisProcessingStateProps = {
  message?: string | null;
  /** Sans ligne « Analyse IA » ni icône étoiles (ex. page Nouvelle analyse). */
  minimalChrome?: boolean;
  /**
   * Job finished côté serveur ; on attend la redirection client.
   * Évite une barre à ~66 % qui paraît « bloquée ».
   */
  awaitingRedirect?: boolean;
};

export function AnalysisProcessingState({
  message,
  minimalChrome = false,
  awaitingRedirect = false,
}: AnalysisProcessingStateProps) {
  return (
    <div className="rounded-[1.5rem] border border-slate-200 bg-[radial-gradient(circle_at_top,rgba(15,23,42,0.08),transparent_42%),linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5 text-center sm:p-8">
      <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full border border-slate-200 bg-white shadow-[0_20px_55px_-35px_rgba(15,23,42,0.8)]">
        <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-slate-950 text-white">
          <div className="absolute inset-[-10px] animate-spin rounded-full border border-slate-300 border-t-slate-950" />
          {!minimalChrome ? <Sparkles className="h-7 w-7" /> : null}
        </div>
      </div>

      <div className="mx-auto mt-6 max-w-md space-y-3">
        {!minimalChrome ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            Analyse IA en cours
          </p>
        ) : null}
        <h1 className="font-display text-2xl font-bold leading-tight tracking-tight text-slate-950 sm:text-[2rem]">
          ScoreMax analyse tes photos
        </h1>
        <p className="text-sm leading-relaxed text-slate-600 sm:text-base">
          On prépare ton diagnostic visage et on sécurise les résultats avant de
          t&apos;envoyer vers ton dashboard.
        </p>
      </div>

      <div className="mx-auto mt-7 max-w-md rounded-2xl border border-slate-200 bg-white/80 p-4 text-left shadow-sm">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-slate-900" />
          <div>
            <p className="text-sm font-semibold text-slate-900">
              {message ?? "Analyse ScoreMax en cours..."}
            </p>
            <p className="text-xs text-slate-500">
              Cette étape peut prendre quelques instants.
            </p>
          </div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className={
              awaitingRedirect
                ? "h-full w-full animate-pulse rounded-full bg-slate-950"
                : "h-full w-2/3 animate-pulse rounded-full bg-slate-950"
            }
          />
        </div>
      </div>
    </div>
  );
}
