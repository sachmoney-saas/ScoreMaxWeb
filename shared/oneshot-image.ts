import { z } from "zod";

/** Documented OneShot aspect ratios for `nano-banana`. */
export const oneshotAspectRatioSchema = z.enum(["1:1", "16:9", "9:16", "4:3", "3:4"]);
export type OneshotAspectRatio = z.infer<typeof oneshotAspectRatioSchema>;

export const oneshotModelVariantSchema = z.enum(["default", "fast"]);
export type OneshotModelVariant = z.infer<typeof oneshotModelVariantSchema>;

export const oneshotUploadSignRequestSchema = z
  .object({
    filename: z.string().min(1),
    contentType: z.string().min(1),
    sizeBytes: z.number().int().positive(),
  })
  .strict();

export const oneshotUploadSignResponseSchema = z
  .object({
    fileId: z.string().min(1),
    uploadUrl: z.string().url(),
    requiredHeaders: z.record(z.string(), z.string()).optional(),
    expiresAt: z.string().optional(),
  })
  .passthrough();

export const oneshotUploadCompleteRequestSchema = z
  .object({
    fileId: z.string().min(1),
  })
  .strict();

export const oneshotUploadCompleteResponseSchema = z.record(z.unknown()).optional();

export const oneshotCreateJobRequestSchema = z
  .object({
    model: z.literal("nano-banana"),
    prompt: z.string().min(1).max(3000),
    options: z
      .object({
        modelVariant: oneshotModelVariantSchema.optional(),
        safetyFilters: z.boolean().optional(),
        aspectRatio: oneshotAspectRatioSchema.optional(),
        referenceFileIds: z.array(z.string().min(1)).min(1).max(4).optional(),
        referenceImageUrl: z.string().url().optional(),
        referenceImageUrls: z.array(z.string().url()).optional(),
        referenceFileUrl: z.string().url().optional(),
        inputFileUrl: z.string().url().optional(),
        fileUrl: z.string().url().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export const oneshotJobCreditsSchema = z
  .object({
    charged: z.number().optional(),
    balance: z.number().optional(),
    pricing: z.unknown().nullable().optional(),
  })
  .passthrough();

export const oneshotJobResultSchema = z
  .object({
    url: z.string().url(),
    storageKey: z.string().optional(),
    contentType: z.string().optional(),
    sizeBytes: z.number().optional(),
  })
  .passthrough();

export const oneshotJobErrorSchema = z
  .object({
    code: z.string(),
    message: z.string(),
  })
  .passthrough();

export const oneshotJobStatusSchema = z.enum([
  "pending",
  "queued",
  "running",
  "processing",
  "completed",
  "failed",
]);

export const oneshotJobResponseSchema = z
  .object({
    id: z.string().min(1),
    status: z.string(),
    model: z.string().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
    result: oneshotJobResultSchema.nullable().optional(),
    error: oneshotJobErrorSchema.nullable().optional(),
    credits: oneshotJobCreditsSchema.optional(),
  })
  .passthrough();

export type OneshotJobResponse = z.infer<typeof oneshotJobResponseSchema>;
