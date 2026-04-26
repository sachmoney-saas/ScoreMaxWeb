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
  "INTERNAL_SERVER_ERROR",
]);

export type ScoreMaxErrorCode = z.infer<typeof scoreMaxErrorCodeSchema>;

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

export const analysesRequestSchema = z
  .object({
    requestId: z.string().min(1),
    images: z.array(analysesImageSchema).min(1),
    analyses: z.array(analysesItemSchema).min(1),
    metadata: z.record(z.unknown()).optional(),
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
  provider: z.string(),
  requestedRuns: z.number().int(),
  completedRuns: z.number().int(),
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
