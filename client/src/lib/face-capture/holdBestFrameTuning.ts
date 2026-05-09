/**
 * Pondération du mérite agrégé (`computeHoldFrameMerit`) et presets associés
 * (`HoldSamplingTuning` reste disponible pour outillage / évolutions futures).
 */

export type HoldBestFramePreset = "balanced" | "accuracy" | "performance";

/** Poids du score agrégé `computeHoldFrameMerit` (somme normalisée à 1). */
export interface HoldMeritWeights {
  validationScore: number;
  geometry: number;
  detectorConfidence: number;
  readinessBonus: number;
}

export interface HoldSamplingTuning {
  /** Pause minimale cible entre deux clichés lorsqu’on sous-échantillonne une séquence vidéo. */
  minGapMs: number;
  /** Amélioration minimale du mérite pour déclencher un nouveau cliché vs `bestHoldMerit`. */
  meritEpsilon: number;
  /** Plafond sécurité : évite rafales si epsilon très bas ou horloges bizarres. */
  maxSnapshotsPerHold: number;
}

export interface HoldBestFrameOptions {
  preset?: HoldBestFramePreset;
  meritWeights?: Partial<HoldMeritWeights>;
  sampling?: Partial<HoldSamplingTuning>;
  /**
   * Si vrai (défaut), allonge légèrement les intervalles et l’epsilon sur
   * appareils à faible RAM / peu de cœurs (Chrome : deviceMemory / hardwareConcurrency).
   */
  deviceAdaptation?: boolean;
}

export interface ResolvedHoldBestFrameTuning {
  meritWeights: HoldMeritWeights;
  sampling: HoldSamplingTuning;
  preset: HoldBestFramePreset;
}

interface PresetCore {
  merit: HoldMeritWeights;
  /** Borne « idéale » de l’intervalle entre clichés à 60 FPS équivalent */
  minGapBaseMs: number;
  /** Multiplicateur × intervalle détecteur (1000/targetFps) — évite plusieurs encodages quasi consécutifs */
  minGapDetectorIntervals: number;
}

const ACCURACY: PresetCore = {
  merit: {
    validationScore: 0.42,
    geometry: 0.38,
    detectorConfidence: 0.13,
    readinessBonus: 0.07,
  },
  minGapBaseMs: 72,
  minGapDetectorIntervals: 4,
};

const BALANCED: PresetCore = {
  merit: {
    validationScore: 0.41,
    geometry: 0.34,
    detectorConfidence: 0.17,
    readinessBonus: 0.08,
  },
  minGapBaseMs: 108,
  minGapDetectorIntervals: 6,
};

/** Poids par défaut (`balanced`) pour appels à `computeHoldFrameMerit` hors session. */
export const DEFAULT_HOLD_MERIT_WEIGHTS: HoldMeritWeights = normalizeMeritWeights(BALANCED.merit);

const PERFORMANCE: PresetCore = {
  merit: {
    validationScore: 0.39,
    geometry: 0.28,
    detectorConfidence: 0.23,
    readinessBonus: 0.1,
  },
  minGapBaseMs: 155,
  minGapDetectorIntervals: 9,
};

const PRESET_EPSILON: Record<HoldBestFramePreset, number> = {
  accuracy: 0.0022,
  balanced: 0.005,
  performance: 0.011,
};

const PRESET_MAX_SNAPS: Record<HoldBestFramePreset, number> = {
  accuracy: 22,
  balanced: 15,
  performance: 10,
};

export function normalizeMeritWeights(w: HoldMeritWeights): HoldMeritWeights {
  const s =
    w.validationScore + w.geometry + w.detectorConfidence + w.readinessBonus || 1;
  return {
    validationScore: w.validationScore / s,
    geometry: w.geometry / s,
    detectorConfidence: w.detectorConfidence / s,
    readinessBonus: w.readinessBonus / s,
  };
}

/** Appareils « légers » : moins de JPEG concurrents pendant le hold. */
export function inferLowTierDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const cores = navigator.hardwareConcurrency;
  const nav = navigator as Navigator & { deviceMemory?: number };
  const memGb = nav.deviceMemory;
  const weakCores = typeof cores === "number" && cores > 0 && cores <= 4;
  const lowMem = typeof memGb === "number" && memGb > 0 && memGb <= 4;
  return weakCores || lowMem;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export function mergePartialSampling(
  base: HoldSamplingTuning,
  patch?: Partial<HoldSamplingTuning>,
): HoldSamplingTuning {
  if (!patch) return base;
  return {
    minGapMs: patch.minGapMs ?? base.minGapMs,
    meritEpsilon: patch.meritEpsilon ?? base.meritEpsilon,
    maxSnapshotsPerHold: patch.maxSnapshotsPerHold ?? base.maxSnapshotsPerHold,
  };
}

/** Résolution finale : presets, FPS session, surcharge optionnelle, adaptation machine. */
export function resolveHoldBestFrameTuning(input: {
  mediaPipeTargetFps: number;
  options?: HoldBestFrameOptions;
}): ResolvedHoldBestFrameTuning {
  const preset = input.options?.preset ?? "balanced";
  const core: PresetCore =
    preset === "accuracy" ? ACCURACY : preset === "performance" ? PERFORMANCE : BALANCED;

  const fps = clamp(Math.round(input.mediaPipeTargetFps || 60), 15, 60);
  const frameMs = 1000 / fps;
  let minGapMs = Math.max(core.minGapBaseMs, frameMs * core.minGapDetectorIntervals);
  let meritEpsilon = PRESET_EPSILON[preset];
  let maxSnapshots = PRESET_MAX_SNAPS[preset];

  const adapt = input.options?.deviceAdaptation !== false;
  if (adapt && inferLowTierDevice()) {
    minGapMs = Math.round(minGapMs * 1.28);
    meritEpsilon *= 1.45;
    maxSnapshots = Math.max(6, maxSnapshots - 3);
  }

  const mergedMeritRaw: HoldMeritWeights = {
    validationScore:
      input.options?.meritWeights?.validationScore ?? core.merit.validationScore,
    geometry: input.options?.meritWeights?.geometry ?? core.merit.geometry,
    detectorConfidence:
      input.options?.meritWeights?.detectorConfidence ?? core.merit.detectorConfidence,
    readinessBonus:
      input.options?.meritWeights?.readinessBonus ?? core.merit.readinessBonus,
  };
  const meritWeights = normalizeMeritWeights(mergedMeritRaw);

  const sampling = mergePartialSampling(
    {
      minGapMs: Math.round(minGapMs),
      meritEpsilon,
      maxSnapshotsPerHold: maxSnapshots,
    },
    input.options?.sampling,
  );

  sampling.minGapMs = Math.max(sampling.minGapMs, Math.ceil(frameMs * 2));
  sampling.maxSnapshotsPerHold = Math.max(4, sampling.maxSnapshotsPerHold);

  return { meritWeights, sampling, preset };
}
