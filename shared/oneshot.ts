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
  "RUNS_LIMIT_EXCEEDED",
  "UNSUPPORTED_LANGUAGE",
  "INTERNAL_SERVER_ERROR",
]);

export type ScoreMaxErrorCode = z.infer<typeof scoreMaxErrorCodeSchema>;

/**
 * Analysis tiers control how many provider runs are requested **per worker**.
 *
 * - `freemium`  → 1 run/worker  (≈5× cheaper, used during onboarding)
 *   ScanFace bypasses its aggregator (no average / most_frequent / collect_texts /
 *   ai_summary) and `outputAggregates` mirrors the single run.
 * - `standard`  → 5 runs/worker (recommended default, full aggregation)
 *
 * Hard cap on the upstream API side is 10 runs per worker (`MAX_RUNS`).
 * Source of truth: ScoreMax/ScanFace API docs.
 */
export const ANALYSIS_TIER_RUNS = {
  freemium: 1,
  standard: 5,
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

const analysesItemSchema = z.object({
  worker: z.string().min(1),
  imageId: z.string().min(1),
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
    const imageIds = new Set(payload.images.map((image) => image.imageId));
    payload.analyses.forEach((analysis, index) => {
      if (!imageIds.has(analysis.imageId)) {
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
