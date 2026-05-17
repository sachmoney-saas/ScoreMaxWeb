import { z } from "zod";

export const scoreMaxErrorCodeSchema = z.enum([
  "API_KEY_MISSING",
  "API_KEY_INVALID",
  "API_KEY_FORBIDDEN",
  "API_KEY_REVOKED",
  "VALIDATION_ERROR",
  "IMAGE_TOO_LARGE",
  "PAYLOAD_TOO_LARGE",
  "UNSUPPORTED_WORKER",
  "PROMPT_NOT_FOUND",
  "IMAGE_NOT_FOUND",
  "MISSING_REQUIRED_IMAGE_SLOT",
  "TOO_MANY_REQUIRED_IMAGE_SLOTS",
  "RUNS_LIMIT_EXCEEDED",
  "UNSUPPORTED_LANGUAGE",
  "ANALYSIS_WEEKLY_LIMIT",
  "INTERNAL_SERVER_ERROR",
]);

export type ScoreMaxErrorCode = z.infer<typeof scoreMaxErrorCodeSchema>;

/**
 * Analysis tiers control how many provider runs are requested **per worker**.
 *
 * - `freemium`  → 2 runs/worker (used during onboarding, cheapest tier).
 *   With 2 runs the ScanFace aggregator runs normally (average / most_frequent /
 *   collect_texts / ai_summary), so `outputAggregates` has the same shape as standard.
 * - `standard`  → 3 runs/worker (recommended default for paid subscribers,
 *   balances cost and aggregation stability).
 *
 * Hard cap on the upstream API side is 10 runs per worker (`MAX_RUNS`).
 * Source of truth: ScoreMax/ScanFace API docs.
 */
export const ANALYSIS_TIER_RUNS = {
  freemium: 2,
  standard: 3,
} as const;

export type AnalysisTier = keyof typeof ANALYSIS_TIER_RUNS;

export const ANALYSIS_TIER_VALUES = Object.keys(
  ANALYSIS_TIER_RUNS,
) as AnalysisTier[];

const promptVersionSchema = z.union([
  z.literal("latest"),
  z.string().regex(/^v\d+$/),
]);

const imageMimeTypeSchema = z.enum(["image/jpeg", "image/png"]);

const analysesImageSchema = z.object({
  imageId: z.string().min(1),
  mimeType: imageMimeTypeSchema,
  base64: z.string().min(1),
});

/**
 * `imageId` is **optional**: ScanFace decides which images each worker
 * receives based on the prompt's `requiredImageSlots`. It only needs to
 * be set on the legacy single-image fallback path (prompt with no slots).
 */
const analysesItemSchema = z.object({
  worker: z.string().min(1),
  imageId: z.string().min(1).optional(),
  promptVersion: promptVersionSchema,
  runs: z.number().int().min(1).max(10).optional(),
});

/** ISO 639-1 two-letter code; normalized to lowercase. Omitted/empty → undefined (upstream defaults to English). */
const analysisLangFieldSchema = z.preprocess((val) => {
  if (val === undefined || val === null) return undefined;
  if (typeof val !== "string") return val;
  const t = val.trim().toLowerCase();
  return t === "" ? undefined : t;
}, z.string().regex(/^[a-z]{2}$/).optional());

export const optionalAnalysisLangBodySchema = z.preprocess(
  (val) =>
    val === undefined || val === null || typeof val !== "object"
      ? {}
      : val,
  z
    .object({
      lang: analysisLangFieldSchema.optional(),
    })
    .strict(),
);

export const analysesRequestSchema = z
  .object({
    requestId: z.string().min(1),
    images: z.array(analysesImageSchema).min(1),
    analyses: z.array(analysesItemSchema).min(1),
    metadata: z.record(z.unknown()).optional(),
    lang: analysisLangFieldSchema.optional(),
  })
  .superRefine((payload, ctx) => {
    /**
     * Legacy single-image fallback only: when an analysis explicitly
     * sets `imageId`, it must reference one of the uploaded images.
     * The slot-driven path leaves `imageId` undefined and ScanFace
     * resolves the matching slots itself.
     */
    const imageIds = new Set(payload.images.map((image) => image.imageId));
    payload.analyses.forEach((analysis, index) => {
      if (analysis.imageId !== undefined && !imageIds.has(analysis.imageId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["analyses", index, "imageId"],
          message: "analysis.imageId must match an existing images[].imageId",
        });
      }
    });
  });

const rawRunSchema = z.object({
  analysisId: z.string().optional(),
  runIndex: z.number().int().optional(),
  status: z.string().optional(),
  providerRequestId: z.string().optional(),
  latencyMs: z.number().optional(),
  raw: z.unknown().optional(),
  createdAt: z.string().optional(),
});

const resultsByWorkerSchema = z.object({
  worker: z.string(),
  promptVersion: z.string(),
  requestedRuns: z.number().int(),
  completedRuns: z.number().int(),
  /** Worker averages / scores as plain JSON; decimals must pass through (no int coercion in app parse). */
  outputAggregates: z.record(z.unknown()),
  rawRuns: z.array(rawRunSchema),
});

export const analysesResponseSchema = z.object({
  requestId: z.string(),
  createdAt: z.string(),
  resultsByWorker: z.array(resultsByWorkerSchema),
});

export const scoreMaxErrorSchema = z.object({
  code: scoreMaxErrorCodeSchema,
  message: z.string(),
});

export const scoreMaxSuccessEnvelopeSchema = <T extends z.ZodTypeAny>(
  dataSchema: T,
) =>
  z.object({
    ok: z.literal(true),
    httpStatus: z.number().int(),
    data: dataSchema,
    error: z.null(),
  });

export const scoreMaxErrorEnvelopeSchema = z.object({
  ok: z.literal(false),
  httpStatus: z.number().int(),
  data: z.null(),
  error: scoreMaxErrorSchema,
});

export const analysesSuccessEnvelopeSchema = scoreMaxSuccessEnvelopeSchema(
  analysesResponseSchema,
);

export type AnalysesRequest = z.infer<typeof analysesRequestSchema>;
export type AnalysesResponse = z.infer<typeof analysesResponseSchema>;
export type ScoreMaxError = z.infer<typeof scoreMaxErrorSchema>;
