import { z } from "zod";

export const oneshotErrorCodeSchema = z.enum([
  "API_KEY_MISSING",
  "API_KEY_INVALID",
  "API_KEY_FORBIDDEN",
  "API_KEY_REVOKED",
  "VALIDATION_ERROR",
  "IMAGE_TOO_LARGE",
  "UNSUPPORTED_WORKER",
  "INTERNAL_SERVER_ERROR",
]);

export type OneshotErrorCode = z.infer<typeof oneshotErrorCodeSchema>;

export const oneshotApiErrorSchema = z.object({
  code: oneshotErrorCodeSchema,
  message: z.string(),
  details: z.unknown().optional(),
});

export const apiKeyScopeSchema = z.enum(["analyses", "jobs"]);
export type ApiKeyScope = z.infer<typeof apiKeyScopeSchema>;

const promptVersionSchema = z.union([
  z.literal("latest"),
  z.string().regex(/^v\d+$/),
]);

const imageMimeTypeSchema = z.enum(["image/jpeg", "image/png"]);

const analysisImageSchema = z.object({
  imageId: z.string().min(1),
  mimeType: imageMimeTypeSchema,
  base64: z.string().min(1),
});

const analysisRunSchema = z.object({
  worker: z.string().min(1),
  imageId: z.string().min(1),
  promptVersion: promptVersionSchema,
  runs: z.number().int().min(1).max(10).optional(),
});

export const analysesRequestSchema = z.object({
  requestId: z.string().min(1),
  images: z.array(analysisImageSchema).min(1),
  analyses: z.array(analysisRunSchema).min(1),
  metadata: z.record(z.unknown()).optional(),
});

const analysisWorkerResultSchema = z.object({
  worker: z.string(),
  promptVersion: promptVersionSchema,
  provider: z.string(),
  requestedRuns: z.number().int().min(1),
  completedRuns: z.number().int().min(0),
  outputAggregates: z.record(z.unknown()),
  rawRuns: z.array(z.unknown()),
});

export const analysesResponseSchema = z.object({
  requestId: z.string(),
  createdAt: z.string(),
  resultsByWorker: z.array(analysisWorkerResultSchema),
});

const jobMessageRoleSchema = z.enum(["system", "user", "assistant"]);

const jobMessageSchema = z.object({
  role: jobMessageRoleSchema,
  content: z.string().min(1),
});

const jobOptionsSchema = z.object({
  modelVariant: z.enum(["flash-lite", "pro"]),
  referenceFileIds: z.array(z.string().uuid()).max(4).optional(),
});

export const createJobRequestSchema = z
  .object({
    model: z.literal("gemini-3.1"),
    messages: z.array(jobMessageSchema).min(1),
    options: jobOptionsSchema,
  })
  .superRefine((value, ctx) => {
    const hasUserMessage = value.messages.some((message) => message.role === "user");
    if (!hasUserMessage) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["messages"],
        message: "messages[] must include at least one user role",
      });
    }
  });

export const createJobResponseSchema = z.object({
  id: z.string(),
  status: z.literal("pending"),
  model: z.literal("gemini-3.1"),
  createdAt: z.string(),
});

const jobResultSchema = z.object({
  textResponse: z.string(),
  modelVariant: z.enum(["flash-lite", "pro"]),
  modelName: z.literal("gemini-3.1"),
});

export const getJobResponseSchema = z.object({
  id: z.string(),
  status: z.enum(["pending", "processing", "completed", "failed"]),
  model: z.literal("gemini-3.1"),
  result: jobResultSchema.optional(),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
});

export const jobIdParamsSchema = z.object({
  id: z.string().min(1),
});

export const publicUiModeResponseSchema = z.object({
  mode: z.enum(["admin", "production_status"]),
});

export const recentRequestsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

const recentRequestSchema = z.object({
  requestId: z.string(),
  status: z.enum(["pending", "processing", "completed", "failed"]),
  requestedWorkersCount: z.number().int().min(0),
  startedAt: z.string(),
  updatedAt: z.string(),
  finishedAt: z.string().nullable(),
});

export const recentRequestsResponseSchema = z.object({
  requests: z.array(recentRequestSchema),
});

export const createApiKeyRequestSchema = z.object({
  name: z.string().trim().min(1).max(80),
  scopes: z.array(apiKeyScopeSchema).min(1).superRefine((scopes, ctx) => {
    if (new Set(scopes).size !== scopes.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["scopes"],
        message: "scopes must not contain duplicates",
      });
    }
  }),
});

export const apiKeyRecordSchema = z.object({
  id: z.string(),
  name: z.string(),
  keyPrefix: z.string(),
  scopes: z.array(apiKeyScopeSchema),
  createdAt: z.string(),
  revokedAt: z.string().nullable().optional(),
  lastUsedAt: z.string().nullable().optional(),
});

export const createApiKeyResponseSchema = z.object({
  apiKey: z.string(),
  record: apiKeyRecordSchema,
});

export const listApiKeysResponseSchema = z.object({
  records: z.array(apiKeyRecordSchema),
});

export const revokeApiKeyParamsSchema = z.object({
  id: z.string().min(1),
});

export const revokeApiKeyResponseSchema = z.object({
  record: apiKeyRecordSchema,
});

export type AnalysesRequest = z.infer<typeof analysesRequestSchema>;
export type AnalysesResponse = z.infer<typeof analysesResponseSchema>;
export type CreateJobRequest = z.infer<typeof createJobRequestSchema>;
export type CreateJobResponse = z.infer<typeof createJobResponseSchema>;
export type GetJobResponse = z.infer<typeof getJobResponseSchema>;
export type RecentRequestsQuery = z.infer<typeof recentRequestsQuerySchema>;
export type RecentRequestsResponse = z.infer<typeof recentRequestsResponseSchema>;
export type PublicUiModeResponse = z.infer<typeof publicUiModeResponseSchema>;
export type CreateApiKeyRequest = z.infer<typeof createApiKeyRequestSchema>;
export type ApiKeyRecord = z.infer<typeof apiKeyRecordSchema>;
