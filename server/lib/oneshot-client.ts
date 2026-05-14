import type { z } from "zod";
import {
  oneshotCreateJobRequestSchema,
  oneshotJobResponseSchema,
  oneshotUploadCompleteRequestSchema,
  oneshotUploadSignRequestSchema,
  oneshotUploadSignResponseSchema,
  type OneshotAspectRatio,
  type OneshotJobResponse,
  type OneshotModelVariant,
} from "@shared/oneshot-image";
import { getOneShotEnv } from "./env";
import { ApiError } from "./errors";
import { logger } from "./logger";

function joinUrl(base: string, path: string): string {
  const b = base.replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${b}${p}`;
}

async function oneShotFetch<T>(params: {
  method: "GET" | "POST";
  path: string;
  body?: unknown;
}): Promise<T> {
  const { apiKey, baseUrl, timeoutMs } = getOneShotEnv();
  const url = joinUrl(baseUrl, params.path);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: params.method,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: params.body !== undefined ? JSON.stringify(params.body) : undefined,
      signal: controller.signal,
    });

    const text = await res.text();
    let json: unknown;
    try {
      json = text.length > 0 ? JSON.parse(text) : {};
    } catch {
      throw new ApiError({
        code: "INTERNAL_SERVER_ERROR",
        status: 502,
        message: "OneShot API returned non-JSON",
        details: { status: res.status, text: text.slice(0, 500) },
      });
    }

    if (!res.ok) {
      const errBody = json as { error?: { code?: string; message?: string } };
      logger.warn(
        { status: res.status, path: params.path, errBody },
        "OneShot API error response",
      );
      throw new ApiError({
        code: "INTERNAL_SERVER_ERROR",
        status: res.status >= 400 && res.status < 600 ? res.status : 502,
        message:
          errBody?.error?.message ??
          `OneShot request failed (${res.status})`,
        details: errBody?.error?.code ?? null,
      });
    }

    return json as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new ApiError({
        code: "INTERNAL_SERVER_ERROR",
        status: 504,
        message: "OneShot API request timed out",
      });
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function signOneShotUpload(params: {
  filename: string;
  contentType: string;
  sizeBytes: number;
}): Promise<z.infer<typeof oneshotUploadSignResponseSchema>> {
  const body = oneshotUploadSignRequestSchema.parse({
    filename: params.filename,
    contentType: params.contentType,
    sizeBytes: params.sizeBytes,
  });
  const raw = await oneShotFetch<unknown>({
    method: "POST",
    path: "/v1/uploads/sign",
    body,
  });
  return oneshotUploadSignResponseSchema.parse(raw);
}

export async function completeOneShotUpload(params: {
  fileId: string;
}): Promise<void> {
  const body = oneshotUploadCompleteRequestSchema.parse({ fileId: params.fileId });
  await oneShotFetch<unknown>({
    method: "POST",
    path: "/v1/uploads/complete",
    body,
  });
}

export async function uploadBinaryToOneShot(params: {
  uploadUrl: string;
  data: Buffer;
  contentType: string;
  requiredHeaders?: Record<string, string>;
}): Promise<void> {
  const headers: Record<string, string> = {
    ...params.requiredHeaders,
    "Content-Type": params.contentType,
  };

  const controller = new AbortController();
  const { timeoutMs } = getOneShotEnv();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(params.uploadUrl, {
      method: "PUT",
      body: new Uint8Array(params.data),
      headers,
      signal: controller.signal,
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new ApiError({
        code: "INTERNAL_SERVER_ERROR",
        status: 502,
        message: `OneShot upload to storage failed (${res.status})`,
        details: t.slice(0, 300),
      });
    }
  } finally {
    clearTimeout(timer);
  }
}

export async function createOneShotJob(params: {
  prompt: string;
  modelVariant?: OneshotModelVariant;
  aspectRatio?: OneshotAspectRatio;
  safetyFilters?: boolean;
  referenceFileIds?: string[];
}): Promise<OneshotJobResponse> {
  const body = oneshotCreateJobRequestSchema.parse({
    model: "nano-banana",
    prompt: params.prompt,
    options: {
      ...(params.modelVariant !== undefined ? { modelVariant: params.modelVariant } : {}),
      ...(params.aspectRatio !== undefined ? { aspectRatio: params.aspectRatio } : {}),
      ...(params.safetyFilters !== undefined ? { safetyFilters: params.safetyFilters } : {}),
      ...(params.referenceFileIds !== undefined && params.referenceFileIds.length > 0
        ? { referenceFileIds: params.referenceFileIds }
        : {}),
    },
  });
  const raw = await oneShotFetch<unknown>({
    method: "POST",
    path: "/v1/jobs",
    body,
  });
  return oneshotJobResponseSchema.parse(raw);
}

export async function getOneShotJob(jobId: string): Promise<OneshotJobResponse> {
  const raw = await oneShotFetch<unknown>({
    method: "GET",
    path: `/v1/jobs/${encodeURIComponent(jobId)}`,
  });
  return oneshotJobResponseSchema.parse(raw);
}
