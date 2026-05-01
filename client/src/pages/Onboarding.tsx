import * as React from "react";
import { useLocation } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import {
  BriefcaseBusiness,
  Download,
  ImagePlus,
  Infinity as InfinityIcon,
  Loader2,
  LogOut,
  ScanFace,
  Trash2,
  Users,
  MoreVertical,
} from "lucide-react";
import type { OnboardingScanAssetCode } from "@shared/schema";
import { AnalysisProcessingState } from "@/components/analysis/AnalysisProcessingState";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { useOnboardingScanStatus } from "@/hooks/use-supabase";
import { uploadScanAsset } from "@/lib/face-analysis";
import { supabase } from "@/lib/supabase";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { AUTH_CONFIG } from "@/config/auth";
import { i18n, useAppLanguage, type AppLanguage } from "@/lib/i18n";

type OnboardingEvidenceBlock = {
  claim: string;
  source: string;
};

type OnboardingStep = {
  title: string;
  category: string;
  description: string;
  icon?: React.ComponentType<{ className?: string }>;
  /** Blocs citation + source ; vide = pas d’encadré gris (ex. introduction). */
  evidence: OnboardingEvidenceBlock[];
};

type RequiredScanAsset = {
  code: string;
  label_fr: string;
  label_en: string;
};

type OnboardingAnalysisJob = {
  id: string;
  status: "queued" | "running" | "completed" | "failed";
  error_code?: string | null;
  error_message?: string | null;
};

/** Comparatif Rencontres — chargées en cache dès l’entrée dans l’onboarding. */
const ONBOARDING_PRELOAD_IMAGE_URLS = ["/model1.png", "/model2.png"] as const;

function OnboardingBeforeAfterComparison({ language }: { language: AppLanguage }) {
  const [splitPercent, setSplitPercent] = React.useState(50);

  /** Largeur d’image en % du panneau pour retrouver le même cadrage qu’un plein cadre (pas deux couches pleine taille). */
  const leftPanelImgWidthPct = 100 / (splitPercent / 100);
  const rightShare = (100 - splitPercent) / 100;
  const rightPanelImgWidthPct =
    rightShare > 0 ? 100 / rightShare : 100;

  return (
    <div className="space-y-2 sm:space-y-3">
      {/* Hauteur plafonnée par viewport pour garder l'étape lisible sans scroll excessif */}
      <div
        className="relative isolate aspect-[4/5] w-full max-h-[min(28svh,240px)] overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-[0_28px_65px_-52px_rgba(9,20,37,0.18)] sm:aspect-[4/3] sm:max-h-[min(34svh,320px)] md:max-h-[min(38svh,400px)] lg:max-h-[min(42svh,480px)]"
      >
        {/* Panneau gauche : uniquement l’avant — aucune image droite en dessous */}
        <div
          className="pointer-events-none absolute inset-y-0 left-0 z-[1] overflow-hidden"
          style={{ width: `${splitPercent}%` }}
        >
          <img
            src="/model2.png"
            alt="Avant optimisation"
            loading="lazy"
            className="absolute top-0 left-0 h-full max-w-none select-none object-cover object-center"
            style={{ width: `${leftPanelImgWidthPct}%` }}
          />
          <div className="absolute bottom-3 left-3 flex flex-col items-start gap-1.5 sm:bottom-4 sm:left-4">
            <div className="flex items-baseline gap-1 rounded-2xl border border-white/25 bg-gradient-to-br from-black/70 to-black/50 px-3 py-2 shadow-[0_8px_24px_-4px_rgba(0,0,0,0.55)] backdrop-blur-md">
              <span className="font-display text-xl font-bold tabular-nums leading-none text-white sm:text-2xl">
                2
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/85 sm:text-xs">
                match
              </span>
            </div>
            <div className="flex h-9 min-h-9 w-max items-center justify-center rounded-lg border border-white/20 bg-black/45 px-3 text-[10px] font-semibold uppercase tracking-[0.06em] leading-none text-white/95 shadow-sm backdrop-blur-sm sm:h-10 sm:min-h-10 sm:text-[11px]">
              0 Bodycount
            </div>
          </div>
        </div>

        {/* Panneau droit : uniquement l’après */}
        <div
          className="pointer-events-none absolute inset-y-0 right-0 z-[1] overflow-hidden"
          style={{ width: `${100 - splitPercent}%` }}
        >
          <img
            src="/model1.png"
            alt="Après optimisation"
            loading="lazy"
            className="absolute top-0 right-0 h-full max-w-none select-none object-cover object-center"
            style={{ width: `${rightPanelImgWidthPct}%` }}
          />
          <div className="absolute right-3 bottom-3 flex flex-col items-end gap-1.5 sm:right-4 sm:bottom-4">
            <div className="flex items-baseline gap-1 rounded-2xl border border-white/25 bg-gradient-to-br from-[#fe3c72]/95 to-[#fd267d]/90 px-3 py-2 shadow-[0_8px_24px_-4px_rgba(253,38,125,0.45)] backdrop-blur-sm">
              <span className="font-display text-xl font-bold tabular-nums leading-none text-white sm:text-2xl">
                142
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/90 sm:text-xs">
                match
              </span>
            </div>
            <div className="flex h-9 min-h-9 w-max items-center gap-1.5 rounded-lg border border-white/25 bg-[#fd267d]/85 px-3 text-[10px] font-semibold uppercase tracking-[0.06em] leading-none text-white shadow-sm backdrop-blur-sm sm:h-10 sm:min-h-10 sm:text-[11px]">
              <InfinityIcon
                className="h-[18px] w-[30px] shrink-0 stroke-[2.25] text-white"
                strokeWidth={2.25}
                aria-hidden
              />
              <span>bodycount</span>
            </div>
          </div>
        </div>

        <div
          className="pointer-events-none absolute inset-y-0 z-10 w-[2px] -translate-x-1/2 bg-white/90 shadow-[0_0_0_1px_rgba(0,0,0,0.15)]"
          style={{ left: `${splitPercent}%` }}
        />
      </div>

      <input
        type="range"
        min={20}
        max={80}
        value={splitPercent}
        onChange={(event) => setSplitPercent(Number(event.currentTarget.value))}
        aria-label={i18n(language, {
          en: "Compare before and after",
          fr: "Comparer avant et apres",
        })}
        className="h-1.5 w-full shrink-0 cursor-ew-resize appearance-none rounded-full bg-slate-200 accent-slate-900 sm:h-2"
      />
    </div>
  );
}

function OnboardingSocialProofShowcase({ language }: { language: AppLanguage }) {
  const currentScore = 6.42;
  const potentialScore = 7.35;
  const chartWidth = 560;
  const chartHeight = 260;
  const plotLeft = 52;
  const plotRight = 18;
  const plotTop = 42;
  const plotBottom = 48;
  const plotWidth = chartWidth - plotLeft - plotRight;
  const plotHeight = chartHeight - plotTop - plotBottom;
  const xMin = 0;
  const xMax = 10;

  const xToPixel = (x: number) =>
    plotLeft + ((x - xMin) / (xMax - xMin)) * plotWidth;
  const yToPixel = (y: number) => plotTop + (1 - y) * plotHeight;
  const gaussian = (x: number) => {
    const peak = Math.exp(-Math.pow(x - 5.05, 2) / (2 * Math.pow(0.86, 2)));
    const leftTail = 0.085 / (1 + Math.exp((x - 2.35) * 2.1));
    const rightTail = 0.075 / (1 + Math.exp((7.25 - x) * 1.8));
    const shoulder =
      0.018 * Math.exp(-Math.pow(x - 8.9, 2) / (2 * Math.pow(1.05, 2)));
    return Math.min(1, peak + leftTail + rightTail + shoulder);
  };

  const curvePoints = Array.from({ length: 120 }, (_, index) => {
    const x = xMin + (index / 119) * (xMax - xMin);
    return `${xToPixel(x).toFixed(2)},${yToPixel(gaussian(x)).toFixed(2)}`;
  }).join(" ");

  const currentX = xToPixel(currentScore);
  const potentialX = xToPixel(potentialScore);

  return (
    <div className="min-w-0 space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
          <div className="mx-auto max-w-xl text-center">
            <h3 className="font-display text-3xl leading-tight tracking-tight text-slate-900 sm:text-4xl">
              {i18n(language, {
                en: "Your score isn't fixed",
                fr: "Ton score n'est pas figé",
              })}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-500 sm:text-base">
              {i18n(language, {
                en: "Small, consistent changes compound over time. Track your progress and watch your score move.",
                fr: "De petits changements réguliers se cumulent avec le temps. Suis ta progression et regarde ton score évoluer.",
              })}
            </p>
          </div>

          <div className="mt-6 flex items-end justify-center gap-5 text-center sm:gap-9">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                {i18n(language, { en: "Today", fr: "Aujourd'hui" })}
              </p>
              <p className="mt-2 font-display text-5xl tracking-tight text-slate-400 sm:text-6xl">
                {currentScore.toFixed(2)}
              </p>
            </div>
            <div className="pb-3 text-4xl text-slate-300 sm:text-5xl">→</div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                {i18n(language, { en: "Potential", fr: "Potentiel" })}
              </p>
              <p className="mt-2 font-display text-5xl tracking-tight text-slate-900 sm:text-6xl">
                {potentialScore.toFixed(2)}
              </p>
            </div>
          </div>

          <div className="mt-5 w-full min-w-0">
            <svg
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              className="mx-auto block h-auto w-full max-w-full"
              preserveAspectRatio="xMidYMid meet"
              role="img"
              aria-label="Score distribution chart"
            >
              {[0.2, 0.4, 0.6, 0.8, 1].map((value) => (
                <line
                  key={`grid-${value}`}
                  x1={plotLeft}
                  y1={yToPixel(value)}
                  x2={plotLeft + plotWidth}
                  y2={yToPixel(value)}
                  stroke="#dde3ec"
                  strokeWidth="1"
                />
              ))}
              <line
                x1={plotLeft}
                y1={plotTop + plotHeight}
                x2={plotLeft + plotWidth}
                y2={plotTop + plotHeight}
                stroke="#cad2dd"
                strokeWidth="1"
              />
              <polyline
                points={curvePoints}
                fill="none"
                stroke="#aab5c3"
                strokeWidth="2.5"
              />
              <line
                x1={currentX}
                y1={plotTop}
                x2={currentX}
                y2={plotTop + plotHeight}
                stroke="#a8b492"
                strokeWidth="3"
              />
              <line
                x1={potentialX}
                y1={plotTop}
                x2={potentialX}
                y2={plotTop + plotHeight}
                stroke="#9cc5a9"
                strokeWidth="1.6"
                strokeDasharray="5 5"
              />
              <rect
                x={currentX - 56}
                y={plotTop - 30}
                width="116"
                height="24"
                rx="12"
                fill="#eef2e6"
                stroke="#b7c09f"
              />
              <text
                x={currentX + 2}
                y={plotTop - 14}
                textAnchor="middle"
                fontSize="11"
                fill="#9aa775"
                fontWeight="600"
              >
                6.42 · Top 17.0%
              </text>
              <text
                x={(currentX + potentialX) / 2 + 4}
                y={plotTop + plotHeight - 2}
                transform={`rotate(-90 ${(currentX + potentialX) / 2 + 4} ${plotTop + plotHeight - 2})`}
                fontSize="18"
                fill="#a6c0ab"
                fontWeight="500"
                letterSpacing="0.06em"
              >
                {i18n(language, { en: "IMPROVEMENT", fr: "PROGRESSION" })}
              </text>
              {[0, 10, 20, 30, 40].map((tick, index) => (
                <text
                  key={`ytick-${tick}`}
                  x={plotLeft - 10}
                  y={yToPixel(index / 4) + 4}
                  textAnchor="end"
                  fontSize="11"
                  fill="#9aa7b8"
                >
                  {tick}
                </text>
              ))}
              <text
                x={22}
                y={plotTop + plotHeight / 2}
                transform={`rotate(-90 22 ${plotTop + plotHeight / 2})`}
                textAnchor="middle"
                fontSize="11"
                fill="#9aa7b8"
                letterSpacing="0.08em"
                fontWeight="500"
              >
                {i18n(language, { en: "POPULATION DENSITY", fr: "DENSITE DE POPULATION" })}
              </text>
              {Array.from({ length: 11 }, (_, index) => (
                <text
                  key={`tick-${index}`}
                  x={xToPixel(index)}
                  y={plotTop + plotHeight + 20}
                  textAnchor="middle"
                  fontSize="11"
                  fill="#8f9caf"
                >
                  {index}
                </text>
              ))}
              <text
                x={plotLeft + plotWidth / 2}
                y={chartHeight - 10}
                textAnchor="middle"
                fontSize="11"
                fill="#9faabb"
                letterSpacing="0.15em"
                fontWeight="600"
              >
                {i18n(language, { en: "OVERALL SCORE", fr: "SCORE GLOBAL" })}
              </text>
            </svg>
          </div>
      </div>
    </div>
  );
}

const REQUIRED_SCAN_ASSETS: RequiredScanAsset[] = [
  { code: "FACE_FRONT", label_fr: "Visage de face", label_en: "Front face" },
  { code: "PROFILE_LEFT", label_fr: "Profil gauche", label_en: "Left profile" },
  { code: "PROFILE_RIGHT", label_fr: "Profil droit", label_en: "Right profile" },
  { code: "LOOK_UP", label_fr: "Regarder en haut", label_en: "Look up" },
  { code: "LOOK_DOWN", label_fr: "Regarder en bas", label_en: "Look down" },
  { code: "SMILE", label_fr: "Sourire", label_en: "Smile" },
  { code: "HAIR_BACK", label_fr: "Cheveux en arrière", label_en: "Hair back" },
  { code: "EYE_CLOSEUP", label_fr: "Gros plan œil", label_en: "Eye close-up" },
];

function getOnboardingSteps(language: AppLanguage): OnboardingStep[] {
  const tr = (en: string, fr: string) => i18n(language, { en, fr });
  return [
  {
    title: tr("Appearance matters and you already know it", "L'apparence compte et tu le sais déjà"),
    category: tr("Introduction", "Introduction"),
    description: "",
    evidence: [],
  },
  {
    title: tr("Finances: income, hiring and sales", "Finances : revenus, embauche et vente"),
    category: tr("Finances", "Finances"),
    description:
      tr(
        "The beauty premium translates directly into compensation, career opportunities, and transactional outcomes.",
        "Le beauty privilege se traduit concrètement dans la rémunération, les opportunités de carrière et les interactions transactionnelles.",
      ),
    icon: BriefcaseBusiness,
    evidence: [
      {
        claim: tr("Attractive people earn 10-15% more.", "Les personnes attirantes gagnent 10-15% de plus."),
        source:
          "Hamermesh, D. S., and J. E. Biddle. (1994). The American Economic Review.",
      },
      {
        claim: tr("Attractive candidates are perceived as more qualified.", "Les candidats attirants sont perçus comme plus qualifiés."),
        source:
          "Puleo, R. (2006). Journal of Undergraduate Psychological Research.",
      },
      {
        claim:
          tr(
            "Attractive waiters receive $1,261 more in tips per year. Customers are 55% more likely to buy from attractive salespeople.",
            "Les serveurs attirants reçoivent $1261 de pourboires en plus par an. Les clients ont 55% plus de chances d'acheter à des vendeurs attirants.",
          ),
        source:
          "Parrett, M. (2015). Journal of Economic Psychology. Reingen, P. H., and Kernan, J. B. (1993). Journal of Consumer Psychology.",
      },
    ],
  },
  {
    title: tr("Influence: network, leadership and visibility", "Influence : réseau, leadership et visibilité"),
    category: tr("Influence", "Influence"),
    description:
      tr(
        "At work and on social media, multiple studies link appearance to status, promotion, and engagement advantages.",
        "Au travail et sur les réseaux sociaux, plusieurs études associent l'apparence à des avantages de statut, de promotion et d'engagement.",
      ),
    icon: Users,
    evidence: [
      {
        claim:
          tr(
            "Better networking — Attractive people build denser social networks.",
            "Meilleur réseautage — Les personnes attirantes construisent des réseaux sociaux plus denses.",
          ),
        source:
          "O'Connor, K. M., and Gladstone, E. (2018). Social Networks.",
      },
      {
        claim:
          tr(
            "More leadership — Attractive politicians receive more votes.",
            "Plus de leadership — Les politiciens attirants obtiennent plus de votes.",
          ),
        source: "Jaeger et al. (2021). Social Psychology.",
      },
      {
        claim:
          tr(
            "More promotions — Attractive people are more likely to be promoted.",
            "Plus de promotions — Les personnes attirantes ont plus de chances d'être promues.",
          ),
        source:
          "Morrow, P. C., McElroy, J. C., Stamper, B. G., and Wilson, M. A. (1990). Journal of Management.",
      },
      {
        claim:
          tr(
            "More followers — Attractive people get more favorable engagement on social platforms.",
            "Plus de followers — Les personnes attirantes obtiennent un engagement plus favorable sur les réseaux sociaux.",
          ),
        source:
          "Gladstone, E. C., and O'Connor, K. (2013). Academy of Management Proceedings; Strey, S. (2019). MSc dissertation; Lund University.",
      },
    ],
  },
  {
    title: tr("In dating, visuals drive the first decision", "En rencontres, le visuel domine la première décision"),
    category: tr("Dating", "Rencontres"),
    description:
      tr(
        "Your image is the primary entry filter: improving presentation changes opportunity quality.",
        "Ton image est le filtre principal d'entrée: optimiser ta présentation change la qualité des opportunités.",
      ),
    evidence: [
      {
        claim:
          tr(
            "On dating apps, appearance matters about 9 times more than your bio.",
            "Sur les apps de rencontre, l'apparence compte environ 9 fois plus que la bio.",
          ),
        source:
          "Witmer, J., Rosenbusch, H., and Meral, E. O. (2025). Computers in Human Behavior Reports.",
      },
    ],
  },
  {
    title: tr("The halo effect also transforms your social life", "L'effet halo transforme aussi ta vie sociale"),
    category: tr("Social life", "Vie sociale"),
    description:
      tr(
        "Trust, credibility, leadership: appearance influences these perceptions across many contexts.",
        "Confiance, crédibilité, leadership: l'apparence influence ces perceptions dans de nombreux contextes.",
      ),
    icon: Users,
    evidence: [
      {
        claim:
          tr(
            "Attractive people are perceived as more moral and more trustworthy.",
            "Les personnes attirantes sont perçues comme plus morales et plus dignes de confiance.",
          ),
        source:
          "Shinners, E. (2009). UW-L Journal of Undergraduate Research; Klebl et al. (2022). Journal of Nonverbal Behavior.",
      },
    ],
  },
  {
    title: "",
    category: tr("AI analysis", "Analyse IA"),
    description: "",
    icon: ScanFace,
    evidence: [
      {
        claim: tr(
          "Uses infrared sensors for the most precise facial analysis possible (iPhone X and newer).",
          "Permet d'utiliser les capteurs infrarouge pour l'analyse faciale la plus précise possible (iPhone X et +).",
        ),
        source: "",
      },
      {
        claim: tr(
          "Most competitors rely on simple photos, which is far less precise.",
          "Nos concurrents utilisent de simples photos : ce n'est pas précis.",
        ),
        source: "",
      },
      {
        claim: tr(
          "Anti-cheat live capture verifies it's really you, not a static photo upload.",
          "Nous empêchons la triche : la capture est faite en direct sur toi et empêche l'usage de simples photos.",
        ),
        source: "",
      },
    ],
  },
  ];
}

function OnboardingWaveBackground() {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: true,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
    });

    if (!gl) {
      return;
    }

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const vertexShaderSource = `
      attribute vec2 position;
      void main() {
        gl_Position = vec4(position, 0.0, 1.0);
      }
    `;

    const fragmentShaderSource = `
      precision mediump float;

      uniform float u_time;
      uniform vec2 u_resolution;

      vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

      float snoise(vec2 v) {
        const vec4 C = vec4(
          0.211324865405187,
          0.366025403784439,
         -0.577350269189626,
          0.024390243902439
        );

        vec2 i = floor(v + dot(v, C.yy));
        vec2 x0 = v - i + dot(i, C.xx);
        vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
        vec4 x12 = x0.xyxy + C.xxzz;
        x12.xy -= i1;
        i = mod289(i);

        vec3 p = permute(
          permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0)
        );

        vec3 m = max(
          0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)),
          0.0
        );
        m = m * m;
        m = m * m;

        vec3 x = 2.0 * fract(p * C.www) - 1.0;
        vec3 h = abs(x) - 0.5;
        vec3 ox = floor(x + 0.5);
        vec3 a0 = x - ox;

        m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);

        vec3 g;
        g.x = a0.x * x0.x + h.x * x0.y;
        g.yz = a0.yz * x12.xz + h.yz * x12.yw;
        return 130.0 * dot(m, g);
      }

      float fbm(vec2 p) {
        float value = 0.0;
        float amplitude = 0.55;
        for (int i = 0; i < 4; i++) {
          value += amplitude * snoise(p);
          p = p * 1.85;
          amplitude *= 0.52;
        }
        return value;
      }

      void main() {
        vec2 st = gl_FragCoord.xy / u_resolution.xy;
        vec2 uv = st - 0.5;
        uv.x *= u_resolution.x / u_resolution.y;

        float t = u_time * 0.11;

        // Gros volumes lents (2-3 masses dominantes)
        vec2 pA = uv * 1.28 + vec2(t * 0.18, -t * 0.11);
        vec2 pB = uv * 1.05 + vec2(-t * 0.13, t * 0.09);

        float nA = fbm(pA);
        float nB = fbm(pB + nA * 0.28);
        float fluid = nA * 0.68 + nB * 0.32;
        fluid = fluid * 0.5 + 0.5;

        vec3 colorLight = vec3(0.75, 0.82, 0.85);
        vec3 colorDark = vec3(0.15, 0.25, 0.30);
        vec3 baseColor = mix(colorDark, colorLight, smoothstep(0.22, 0.84, fluid));

        // Contours doux modernes (2-3 lignes visibles, pas de géométrie angulaire)
        float line1 = smoothstep(0.48, 0.505, fluid) - smoothstep(0.505, 0.54, fluid);
        float line2 = smoothstep(0.64, 0.67, fluid) - smoothstep(0.67, 0.705, fluid);
        float line3 = smoothstep(0.79, 0.815, fluid) - smoothstep(0.815, 0.845, fluid);
        float lines = line1 * 0.8 + line2 * 0.65 + line3 * 0.5;

        vec3 contourColor = vec3(0.90, 0.95, 0.98) * lines;
        vec3 finalColor = baseColor + contourColor * 0.42;

        float vignette = smoothstep(1.1, 0.18, length(uv));
        finalColor = mix(vec3(0.10, 0.18, 0.22), finalColor, vignette);

        gl_FragColor = vec4(finalColor, 1.0);
      }
    `;

    const createShader = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) {
        return null;
      }
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vertexShader = createShader(gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(
      gl.FRAGMENT_SHADER,
      fragmentShaderSource,
    );

    if (!vertexShader || !fragmentShader) {
      return;
    }

    const program = gl.createProgram();
    if (!program) {
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      return;
    }

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      return;
    }

    gl.useProgram(program);

    const positionBuffer = gl.createBuffer();
    if (!positionBuffer) {
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      return;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );

    const positionLocation = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    const timeLocation = gl.getUniformLocation(program, "u_time");
    const resolutionLocation = gl.getUniformLocation(program, "u_resolution");

    let animationFrameId = 0;
    let startTime = performance.now();

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.floor(window.innerWidth * dpr);
      const height = Math.floor(window.innerHeight * dpr);

      canvas.width = width;
      canvas.height = height;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      gl.viewport(0, 0, width, height);
    };

    const render = (now: number) => {
      const elapsed = (now - startTime) * 0.001;
      const animatedTime = prefersReducedMotion ? 0 : elapsed;

      if (timeLocation) {
        gl.uniform1f(timeLocation, animatedTime);
      }
      if (resolutionLocation) {
        gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
      }

      gl.drawArrays(gl.TRIANGLES, 0, 6);

      if (!prefersReducedMotion) {
        animationFrameId = window.requestAnimationFrame(render);
      }
    };

    resize();
    animationFrameId = window.requestAnimationFrame(render);
    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("resize", resize);
      if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId);
      }

      gl.deleteBuffer(positionBuffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="DetailsForm-module-scss-module__Y0wOgG__background fixed inset-0 h-dvh w-dvw bg-[#9aaeb5]"
      aria-hidden="true"
    />
  );
}

export default function Onboarding() {
  const language = useAppLanguage();
  const isFrench = language === "fr";
  const [, setLocation] = useLocation();
  const { user, profile } = useAuth();
  const [stepIndex, setStepIndex] = React.useState(0);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [analysisMessage, setAnalysisMessage] = React.useState<string | null>(
    null,
  );
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = React.useState(false);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = React.useState(false);
  const [uploadingAssetCode, setUploadingAssetCode] = React.useState<string | null>(
    null,
  );
  const [uploadMessage, setUploadMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    for (const src of ONBOARDING_PRELOAD_IMAGE_URLS) {
      const img = new Image();
      img.decoding = "async";
      img.src = src;
    }
  }, []);

  React.useEffect(() => {
    if (!user) {
      setLocation(AUTH_CONFIG.LOGIN_PATH);
      return;
    }

    if (profile?.has_completed_onboarding) {
      setLocation(AUTH_CONFIG.REDIRECT_PATH);
    }
  }, [profile?.has_completed_onboarding, setLocation, user]);

  const steps = React.useMemo(() => getOnboardingSteps(language), [language]);
  const currentStep = steps[stepIndex];
  const isDatingStep =
    currentStep.category === "Rencontres" || currentStep.category === "Dating";
  const isSocialStep =
    currentStep.category === "Vie sociale" || currentStep.category === "Social life";
  const isIntroStep = currentStep.category === "Introduction";
  const isLastStep = stepIndex === steps.length - 1;
  const isAnalysisRunning = isLastStep && isSubmitting;

  const {
    data: scanStatus,
    isLoading: isScanStatusLoading,
    isError: isScanStatusError,
  } = useOnboardingScanStatus({ enabled: isLastStep && !!user?.id });

  const requiredAssetCount = scanStatus?.required_asset_count ?? 8;
  const completedAssetCount = scanStatus?.completed_asset_count ?? 0;
  const missingAssetTypes = scanStatus?.missing_asset_types ?? [];
  const missingAssetLabels = new Set(missingAssetTypes);
  const isScanReady = scanStatus?.is_ready ?? false;
  const canCompleteOnboarding = !isLastStep || isScanReady;
  const onboardingSessionId = scanStatus?.session_id;

  const markOnboardingCompleted = React.useCallback(async () => {
    if (!user?.id || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setAnalysisMessage(
      i18n(language, {
        en: "Preparing photos for analysis...",
        fr: "Préparation des photos pour l'analyse...",
      }),
    );

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        throw new Error(
          i18n(language, {
            en: "Supabase session not found",
            fr: "Session Supabase introuvable",
          }),
        );
      }

      const headers = { Authorization: `Bearer ${accessToken}` };
      const startResponse = await apiRequest(
        "POST",
        "/v1/onboarding/complete",
        undefined,
        headers,
      );
      const startPayload = (await startResponse.json()) as {
        data?: { job?: OnboardingAnalysisJob };
      };
      const jobId = startPayload.data?.job?.id;

      if (!jobId) {
        throw new Error(
          i18n(language, {
            en: "Analysis job not found",
            fr: "Job d'analyse introuvable",
          }),
        );
      }

      setAnalysisMessage(
        i18n(language, {
          en: "ScoreMax analysis started...",
          fr: "Analyse ScoreMax lancée...",
        }),
      );

      for (let attempt = 0; attempt < 120; attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 1500));

        const statusResponse = await apiRequest(
          "GET",
          `/v1/onboarding/analysis/${jobId}`,
          undefined,
          headers,
        );
        const statusPayload = (await statusResponse.json()) as {
          data?: { job?: OnboardingAnalysisJob };
        };
        const job = statusPayload.data?.job;

        if (!job) {
          throw new Error(
            i18n(language, {
              en: "Analysis status not found",
              fr: "Statut d'analyse introuvable",
            }),
          );
        }

        if (job.status === "queued") {
          setAnalysisMessage(
            i18n(language, {
              en: "Analysis queued...",
              fr: "Analyse en file d'attente...",
            }),
          );
          continue;
        }

        if (job.status === "running") {
          setAnalysisMessage(
            i18n(language, {
              en: "ScoreMax analysis in progress...",
              fr: "Analyse ScoreMax en cours...",
            }),
          );
          continue;
        }

        if (job.status === "failed") {
          throw new Error(
            job.error_message ||
              job.error_code ||
              i18n(language, {
                en: "ScoreMax analysis failed",
                fr: "Analyse ScoreMax échouée",
              }),
          );
        }

        setAnalysisMessage(
          i18n(language, {
            en: "Analysis complete, redirecting to your dashboard...",
            fr: "Analyse terminée, redirection vers votre dashboard...",
          }),
        );
        await queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
        await queryClient.invalidateQueries({
          queryKey: ["latest-face-analysis", user.id],
        });
        setLocation(AUTH_CONFIG.REDIRECT_PATH);
        return;
      }

      throw new Error(
        i18n(language, {
          en: "Analysis is taking too long, please retry in a few moments",
          fr: "Analyse trop longue, réessaie dans quelques instants",
        }),
      );
    } catch (error) {
      console.error("Unable to complete onboarding:", error);
      setAnalysisMessage(
        error instanceof Error
          ? error.message
          : i18n(language, {
              en: "Unable to start analysis right now.",
              fr: "Impossible de lancer l'analyse pour le moment.",
            }),
      );
      setIsSubmitting(false);
    }
  }, [isSubmitting, language, setLocation, user?.id]);

  const handleLogout = React.useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const handleDeleteAccount = React.useCallback(async () => {
    if (!user?.id) return;

    setIsDeletingAccount(true);

    try {
      const { error: deleteProfileError } = await supabase
        .from("profiles")
        .delete()
        .eq("id", user.id);

      if (deleteProfileError) {
        throw deleteProfileError;
      }

      const { error: deleteUserError } = await supabase.auth.admin.deleteUser(
        user.id,
      );

      if (deleteUserError) {
        throw deleteUserError;
      }

      await supabase.auth.signOut();
      queryClient.clear();
      setLocation(AUTH_CONFIG.LOGIN_PATH);
    } catch (error) {
      console.error("Error while deleting account:", error);
      alert(
        i18n(language, {
          en: "Unable to delete account right now. Try again later.",
          fr: "Impossible de supprimer le compte pour le moment. Réessaye plus tard.",
        }),
      );
    } finally {
      setIsDeletingAccount(false);
      setIsDeleteDialogOpen(false);
    }
  }, [language, setLocation, user?.id]);

  const handleManualAssetUpload = React.useCallback(
    async (assetTypeCode: string, file: File | null) => {
      if (!user?.id || !onboardingSessionId || !file || uploadingAssetCode) {
        return;
      }

      if (!["image/jpeg", "image/png"].includes(file.type)) {
        setUploadMessage(
          i18n(language, {
            en: "Use a JPG or PNG image.",
            fr: "Utilise une image JPG ou PNG.",
          }),
        );
        return;
      }

      setUploadingAssetCode(assetTypeCode);
      setUploadMessage(null);

      try {
        await uploadScanAsset({
          userId: user.id,
          sessionId: onboardingSessionId,
          assetTypeCode: assetTypeCode as OnboardingScanAssetCode,
          file,
        });

        await queryClient.invalidateQueries({
          queryKey: ["onboarding-scan-status", user.id],
        });
        setUploadMessage(
          i18n(language, {
            en: "Photo added.",
            fr: "Photo ajoutée.",
          }),
        );
      } catch (error) {
        console.error("Unable to upload onboarding asset:", error);
        setUploadMessage(
          i18n(language, {
            en: "Unable to add this photo.",
            fr: "Impossible d'ajouter cette photo.",
          }),
        );
      } finally {
        setUploadingAssetCode(null);
      }
    },
    [language, onboardingSessionId, uploadingAssetCode, user?.id],
  );

  const handleNext = React.useCallback(() => {
    if (stepIndex >= steps.length - 1) {
      markOnboardingCompleted();
      return;
    }

    setStepIndex((prev) => Math.min(prev + 1, steps.length - 1));
  }, [markOnboardingCompleted, stepIndex]);

  return (
    <div className="relative min-h-dvh overflow-y-auto bg-[#9aaeb5]">
      <OnboardingWaveBackground />

      {/* Account Menu */}
      <div className="absolute top-4 right-4 z-20">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full bg-white/20 hover:bg-white/30"
            >
              <MoreVertical className="h-5 w-5 text-white" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              <span>{i18n(language, { en: "Log out", fr: "Se déconnecter" })}</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setIsDeleteDialogOpen(true)}
              className="text-red-600 focus:text-red-600"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              <span>{i18n(language, { en: "Delete account", fr: "Supprimer le compte" })}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Delete Account Confirmation Dialog */}
      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{i18n(language, { en: "Delete account", fr: "Supprimer le compte" })}</AlertDialogTitle>
            <AlertDialogDescription>
              {i18n(language, {
                en: "This action is permanent. Your account and all your data will be deleted immediately. This cannot be undone.",
                fr: "Cette action est définitive. Ton compte et toutes tes données seront supprimés immédiatement. Tu ne pourras pas revenir en arrière.",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-2">
            <AlertDialogCancel>{i18n(language, { en: "Cancel", fr: "Annuler" })}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              disabled={isDeletingAccount}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeletingAccount
                ? i18n(language, { en: "Deleting...", fr: "Suppression..." })
                : i18n(language, { en: "Delete", fr: "Supprimer" })}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-3xl flex-col justify-center px-4 py-8 sm:px-6">
        <div className="my-auto space-y-4 py-4 sm:space-y-6">
          <div className="flex justify-center">
            <img
              src="/favicon.png"
              alt="Logo ScoreMax"
              className="h-10 w-10 rounded-xl border border-white/50 bg-white/80 p-1.5 shadow-[0_10px_28px_-18px_rgba(9,20,37,0.65)]"
            />
          </div>

          <div
            className="grid gap-1.5"
            style={{
              gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))`,
            }}
          >
            {steps.map((_, index) => (
              <div
                key={`step-segment-${index}`}
                className={`h-2 rounded-full transition-colors duration-200 ${
                  index <= stepIndex ? "bg-[#121826]" : "bg-white/50"
                }`}
              />
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.article
              key={`onboarding-step-${stepIndex}`}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className={`rounded-[2rem] border border-white/60 bg-white p-5 shadow-[0_24px_70px_-35px_rgba(9,20,37,0.55)] sm:p-8 ${
                isIntroStep ? "min-h-[360px] sm:min-h-[420px]" : ""
              } ${isLastStep ? "mx-auto w-full max-w-[430px]" : ""}`}
            >
              {isAnalysisRunning ? (
                <AnalysisProcessingState message={analysisMessage} />
              ) : (
                <div
                  className={`min-w-0 space-y-5 ${
                    isIntroStep
                      ? "flex min-h-[200px] flex-col items-center justify-center text-center sm:min-h-[240px]"
                      : ""
                  }`}
                >
                  {isSocialStep ? (
                    <OnboardingSocialProofShowcase language={language} />
                  ) : (
                    <>
                      <div
                        className={
                          isDatingStep
                            ? "space-y-2 text-center sm:space-y-3"
                            : isIntroStep
                              ? "text-center"
                              : "space-y-3 text-center"
                        }
                      >
                        <motion.h1
                          initial={
                            isIntroStep
                              ? { opacity: 0, scale: 0.84, y: 20 }
                              : undefined
                          }
                          animate={
                            isIntroStep
                              ? { opacity: 1, scale: 1.03, y: 0 }
                              : undefined
                          }
                          transition={
                            isIntroStep
                              ? { duration: 2.9, ease: [0.16, 1, 0.3, 1] }
                              : undefined
                          }
                          className={
                            isDatingStep
                              ? "mx-auto max-w-[18ch] text-xl font-display font-bold leading-snug tracking-tight text-slate-900 sm:text-2xl md:text-[2rem]"
                              : isIntroStep
                                ? "mx-auto max-w-[16ch] text-center text-[2.15rem] font-display font-extrabold leading-[0.96] tracking-[-0.022em] text-slate-900 sm:text-[2.95rem] md:text-[3.35rem]"
                              : "mx-auto max-w-[22ch] text-2xl font-display font-bold leading-tight tracking-tight text-slate-900 sm:text-[2rem]"
                          }
                        >
                          {isIntroStep ? (
                            <>
                              <span className="block">
                                {i18n(language, { en: "Appearance matters", fr: "L'apparence compte" })}
                              </span>
                              <span className="block">
                                {i18n(language, { en: "and you already know it", fr: "et tu le sais déjà" })}
                              </span>
                            </>
                          ) : (
                            currentStep.title
                          )}
                        </motion.h1>
                        {isIntroStep ? (
                          <h2 className="mx-auto mt-14 text-center text-sm font-semibold tracking-[0.09em] text-slate-500 sm:mt-16 sm:text-base">
                            {i18n(language, {
                              en: "Finance, Influence, Dating...",
                              fr: "Finance, Influence, Rencontres...",
                            })}
                          </h2>
                        ) : null}
                        {isDatingStep ? (
                          <OnboardingBeforeAfterComparison language={language} />
                        ) : !isIntroStep ? (
                          <p className="mx-auto max-w-2xl text-center text-sm leading-relaxed text-slate-600 sm:text-base">
                            {currentStep.description}
                          </p>
                        ) : null}
                      </div>
                    </>
                  )}

                {!isDatingStep &&
                !isSocialStep &&
                !isLastStep &&
                currentStep.evidence.length > 0 ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    {currentStep.evidence.map((block, index) => (
                      <div
                        key={`onboarding-evidence-${index}`}
                        className={
                          index > 0
                            ? "mt-3 border-t border-slate-200 pt-3"
                            : undefined
                        }
                      >
                        <p className="text-sm font-semibold leading-relaxed text-slate-900 sm:text-base">
                          {block.claim}
                        </p>
                        {block.source ? (
                          <p className="mt-1 text-xs leading-relaxed text-slate-500 sm:text-sm">
                            {block.source}
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}

                {isLastStep ? (
                  <div className="mx-auto w-full max-w-sm">
                    <div className="flex flex-col text-center">
                      <p className="mt-3 text-[1.45rem] font-extrabold text-slate-900 sm:text-[1.75rem]">
                        {i18n(language, {
                          en: "Start your first analysis",
                          fr: "Lance ta première analyse",
                        })}
                      </p>
                      <div className="mt-3 w-full space-y-2.5 text-left">
                        {currentStep.evidence.map((block, index) => (
                          <div
                            key={`app-card-argument-${index}`}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-2.5"
                          >
                            <div className="flex items-start gap-2">
                              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-500" />
                              <p className="text-xs leading-relaxed text-slate-700 sm:text-sm">
                                {index === 0 ? (
                                  <>
                                    {i18n(language, {
                                      en: "Uses infrared sensors for the most precise facial analysis possible (",
                                      fr: "Permet d'utiliser les capteurs infrarouge pour l'analyse faciale la plus précise possible (",
                                    })}
                                    <em>
                                      {i18n(language, {
                                        en: "iPhone X and newer",
                                        fr: "iPhone X et +",
                                      })}
                                    </em>
                                    )
                                  </>
                                ) : (
                                  block.claim
                                )}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 flex justify-center">
                        <a
                          href="https://apps.apple.com"
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex w-full max-w-[360px] items-center justify-center gap-2 rounded-2xl bg-black p-3 text-white shadow-[0_16px_30px_-18px_rgba(0,0,0,0.95)] transition hover:bg-[#050505]"
                        >
                          <img
                            src="/favicon.png"
                            alt="ScoreMax"
                            className="h-10 w-10 rounded-lg bg-black object-contain"
                          />
                          <span className="text-sm font-semibold tracking-tight sm:text-base">
                            {i18n(language, {
                              en: "ScoreMax 3D Infrared Scan",
                              fr: "ScoreMax Scan 3D Infrarouge",
                            })}
                          </span>
                          <Download className="h-5 w-5 shrink-0" />
                        </a>
                      </div>
                      {canCompleteOnboarding ? (
                        <button
                          type="button"
                          onClick={handleNext}
                          disabled={isSubmitting}
                          className="mx-auto mt-4 flex min-h-[68px] w-full max-w-[360px] items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_-16px_rgba(5,150,105,0.85)] transition hover:bg-emerald-700 disabled:opacity-60 sm:min-h-[76px]"
                        >
                          {i18n(language, { en: "Start", fr: "Commencer" })}
                        </button>
                      ) : (
                        <div className="mx-auto mt-4 flex min-h-[68px] w-full max-w-[360px] items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-700 sm:min-h-[76px]">
                          <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
                          <span>
                            {i18n(language, {
                              en: "Waiting for analysis",
                              fr: "En attente de l'analyse",
                            })}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}

              </div>
              )}

              {!isAnalysisRunning ? (
                isIntroStep ? (
                  <div className="mt-6 flex justify-center sm:mt-8">
                    <Button
                      type="button"
                      onClick={handleNext}
                      disabled={isSubmitting || !canCompleteOnboarding}
                      className="w-full max-w-sm rounded-xl bg-black text-white hover:bg-zinc-800"
                    >
                      {i18n(language, { en: "Continue", fr: "Continuer" })}
                    </Button>
                  </div>
                ) : isLastStep ? null : (
                  <div className="mt-6 grid grid-cols-2 gap-3 sm:mt-8">
                    <Button
                      type="button"
                      onClick={() => setStepIndex((prev) => Math.max(prev - 1, 0))}
                      disabled={stepIndex === 0 || isSubmitting}
                      className="rounded-xl bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-40"
                    >
                      {i18n(language, { en: "Back", fr: "Retour" })}
                    </Button>
                    <Button
                      type="button"
                      onClick={handleNext}
                      disabled={isSubmitting || (isLastStep && !canCompleteOnboarding)}
                      className={`rounded-xl text-white ${
                        isLastStep && !canCompleteOnboarding
                          ? "bg-slate-700 hover:bg-slate-700"
                          : "bg-black hover:bg-zinc-800"
                      }`}
                    >
                      {isLastStep ? (
                        canCompleteOnboarding
                          ? i18n(language, { en: "Start", fr: "Commencer" })
                          : i18n(language, { en: "Start", fr: "Commencer" })
                      ) : (
                        i18n(language, { en: "Continue", fr: "Continuer" })
                      )}
                    </Button>
                  </div>
                )
              ) : null}

              {!isAnalysisRunning && analysisMessage ? (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-center gap-3 text-sm text-slate-700">
                    {isSubmitting ? (
                      <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
                    ) : null}
                    <span>{analysisMessage}</span>
                  </div>
                  {isSubmitting ? (
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200">
                      <div className="h-full w-1/2 animate-pulse rounded-full bg-black" />
                    </div>
                  ) : null}
                </div>
              ) : null}
            </motion.article>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
