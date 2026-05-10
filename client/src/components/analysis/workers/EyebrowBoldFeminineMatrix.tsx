import { i18n, type AppLanguage } from "@/lib/i18n";
import { scrollToWorkerAnchor } from "@/lib/worker-view-anchor";
import { cn } from "@/lib/utils";

/* ----------------------------------------------------------------------------
 * Bold × Feminine matrix — 10×10 grid (same convention as bodyfat preview:
 * cell indices map with floor() on 0–10 signals).
 *
 * X: feminine (left, col 0) ← → masculine (right) from blended arch + thickness
 * Y: bold (top, row 0) ← → subtle (bottom) from thickness + density mean
 * ------------------------------------------------------------------------- */

export function EyebrowBoldFeminineMatrix({
  thickness,
  density,
  archScore,
  language,
  cellTargetId,
  className,
  /** Réduit les margelles d’axe (preview dashboard, comme masse grasse faciale). */
  compact = false,
}: {
  thickness: number | null;
  density: number | null;
  archScore: number | null;
  language: AppLanguage;
  /** Scroll target for matrix cells (sans `#`). */
  cellTargetId?: string;
  className?: string;
  compact?: boolean;
}) {
  const cols = 10;
  const rows = 10;

  const boldSignals = [thickness, density].filter(
    (v): v is number => v !== null,
  );
  const boldness =
    boldSignals.length > 0
      ? boldSignals.reduce((a, b) => a + b, 0) / boldSignals.length
      : null;

  const yIdx =
    boldness !== null
      ? Math.min(rows - 1, Math.max(0, Math.floor(10 - boldness)))
      : null;

  let femScore: number | null = null;
  if (archScore !== null || thickness !== null) {
    const arch = archScore ?? 5;
    const th = thickness ?? 5;
    const raw = arch * 0.6 + (10 - th) * 0.4;
    femScore = Math.max(0, Math.min(10, raw));
  }

  /** Masculinity proxy col (0 = feminine); same pattern as horizontal bodyfat axis. */
  const xIdx =
    femScore !== null
      ? Math.min(cols - 1, Math.max(0, Math.floor(10 - femScore)))
      : null;

  const outerWrap = compact
    ? "mx-auto w-full max-w-[13rem] sm:max-w-[14rem]"
    : "w-full";
  const gridShell = compact
    ? "grid grid-cols-[16px_1fr_16px] grid-rows-[16px_1fr_16px] items-center gap-0.5"
    : "grid grid-cols-[60px_1fr_60px] grid-rows-[24px_1fr_24px] items-center gap-1";
  const labelClass = compact
    ? "text-[9px] font-semibold uppercase tracking-[0.14em] text-zinc-400"
    : "text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400";
  const pad = compact ? "p-1.5" : "p-2";
  const cellGap = compact ? "gap-[2px]" : "gap-0.5";
  const cellRound = compact ? "rounded-[2px]" : "rounded-md";
  const ringUser = compact ? "ring-1 ring-white/85" : "ring-2 ring-white/80";

  const matrixShell = cn(
    "relative aspect-square w-full border border-white/10 bg-white/[0.03]",
    compact ? "rounded-xl" : "rounded-2xl",
    pad,
  );

  const userShadow = compact
    ? "0 0 14px rgba(255,255,255,0.45)"
    : "0 0 18px rgba(255,255,255,0.55)";

  return (
    <div className={cn(compact ? "space-y-2" : "space-y-3", className)}>
      <div className={outerWrap}>
        <div className={gridShell}>
          <div />
          <div className={`text-center ${labelClass}`}>
            {i18n(language, { en: "Bold", fr: "Marqué" })}
          </div>
          <div />

          {compact ? (
            <div className="flex items-center justify-center">
              <span
                className={`inline-block origin-center rotate-[-90deg] whitespace-nowrap text-center ${labelClass}`}
              >
                {i18n(language, { en: "Feminine", fr: "Féminin" })}
              </span>
            </div>
          ) : (
            <div className={`text-right ${labelClass}`}>
              {i18n(language, { en: "Feminine", fr: "Féminin" })}
            </div>
          )}

          <div
            className={matrixShell}
            role="img"
            aria-label={i18n(language, {
              en: "Bold × Feminine matrix, 10 by 10",
              fr: "Matrice marqué × féminin, grille 10 par 10",
            })}
          >
            <div
              className={cn(
                "grid h-full w-full grid-cols-10 grid-rows-10",
                cellGap,
              )}
            >
              {Array.from({ length: rows }).map((_, ry) =>
                Array.from({ length: cols }).map((_, cx) => {
                  const isUser = xIdx === cx && yIdx === ry;
                  const distance = Math.hypot(
                    cx - (cols - 1) / 2,
                    ry - (rows - 1) / 2,
                  );
                  const baseOpacity = Math.max(0.04, 0.18 - distance * 0.019);
                  const bg = isUser
                    ? "#e9f1f4"
                    : (`rgba(154,174,181,${baseOpacity})` as string);
                  const sh = isUser ? userShadow : undefined;
                  const c = cn(
                    cellRound,
                    "transition",
                    isUser ? ringUser : "",
                    cellTargetId &&
                      "cursor-pointer hover:brightness-125 focus-visible:outline focus-visible:ring-2 focus-visible:ring-white/35",
                  );
                  if (!cellTargetId) {
                    return (
                      <div
                        key={`cell-${ry}-${cx}`}
                        className={c}
                        style={{
                          backgroundColor: bg,
                          boxShadow: sh,
                        }}
                      />
                    );
                  }
                  return (
                    <button
                      key={`cell-${ry}-${cx}`}
                      type="button"
                      className={cn(c, "h-full min-h-0 w-full border-0 p-0")}
                      style={{
                        backgroundColor: bg,
                        boxShadow: sh,
                      }}
                      aria-label={i18n(language, {
                        en: "Go to density and grooming scores",
                        fr: "Aller aux scores densité et toilettage",
                      })}
                      onClick={() => scrollToWorkerAnchor(cellTargetId)}
                    />
                  );
                })
              )}
            </div>

            {compact ? (
              <>
                <div className="pointer-events-none absolute inset-y-2 left-1/2 w-[1.5px] -translate-x-1/2 rounded-full bg-white/90 shadow-[0_0_8px_rgba(255,255,255,0.35)]" />
                <div className="pointer-events-none absolute inset-x-2 top-1/2 h-[1.5px] -translate-y-1/2 rounded-full bg-white/90 shadow-[0_0_8px_rgba(255,255,255,0.35)]" />
              </>
            ) : (
              <>
                <div className="pointer-events-none absolute inset-y-2 left-1/2 w-px -translate-x-1/2 bg-white/10" />
                <div className="pointer-events-none absolute inset-x-2 top-1/2 h-px -translate-y-1/2 bg-white/10" />
              </>
            )}
          </div>

          {compact ? (
            <div className="flex items-center justify-center">
              <span
                className={`inline-block origin-center rotate-90 whitespace-nowrap text-center ${labelClass}`}
              >
                {i18n(language, { en: "Masculine", fr: "Masculin" })}
              </span>
            </div>
          ) : (
            <div className={`text-left ${labelClass}`}>
              {i18n(language, { en: "Masculine", fr: "Masculin" })}
            </div>
          )}

          <div />
          <div className={`text-center ${labelClass}`}>
            {i18n(language, { en: "Subtle", fr: "Subtil" })}
          </div>
          <div />
        </div>
      </div>
    </div>
  );
}
