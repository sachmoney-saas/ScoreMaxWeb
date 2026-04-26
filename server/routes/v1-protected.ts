import { Router } from "express";
import {
  analysesRequestSchema,
  createJobRequestSchema,
  jobIdParamsSchema,
  type AnalysesRequest,
  type CreateJobRequest,
} from "@shared/oneshot";
import { getOneshotEnv } from "../lib/env";
import { ApiError } from "../lib/errors";
import {
  createAnalysis,
  createJob as createJobUpstream,
  getJob,
} from "../lib/oneshot-client";
import { validateBody, validateParams } from "../lib/validate";
import { apiKeyAuth } from "../middleware/api-key-auth";
import { requireScope } from "../middleware/require-scope";

function getDecodedSizeInBytes(base64: string): number {
  const normalized = base64.trim().replace(/\s+/g, "");
  const payload = normalized.includes(",")
    ? normalized.slice(normalized.indexOf(",") + 1)
    : normalized;

  const padding = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((payload.length * 3) / 4) - padding);
}

function enforceImageSizeLimit(body: AnalysesRequest) {
  const { maxImageBytes } = getOneshotEnv();

  for (const image of body.images) {
    const size = getDecodedSizeInBytes(image.base64);
    if (size > maxImageBytes) {
      throw new ApiError({
        code: "IMAGE_TOO_LARGE",
        status: 413,
        message: `Image ${image.imageId} exceeds MAX_IMAGE_BYTES`,
      });
    }
  }
}

function enforceSupportedWorkers(body: AnalysesRequest) {
  const { supportedWorkers } = getOneshotEnv();
  if (supportedWorkers.length === 0) {
    return;
  }

  for (const analysis of body.analyses) {
    if (!supportedWorkers.includes(analysis.worker)) {
      throw new ApiError({
        code: "UNSUPPORTED_WORKER",
        status: 400,
        message: `Unsupported worker: ${analysis.worker}`,
      });
    }
  }
}

export function createV1ProtectedRouter(): Router {
  const router = Router();

  router.post(
    "/analyses",
    apiKeyAuth,
    requireScope("analyses"),
    validateBody(analysesRequestSchema),
    async (req, res, next) => {
      try {
        const payload = req.body as AnalysesRequest;
        enforceImageSizeLimit(payload);
        enforceSupportedWorkers(payload);

        const response = await createAnalysis(payload);
        res.status(200).json(response);
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/jobs",
    apiKeyAuth,
    requireScope("jobs"),
    validateBody(createJobRequestSchema),
    async (req, res, next) => {
      try {
        const payload = req.body as CreateJobRequest;
        const response = await createJobUpstream(payload);
        res.status(202).json(response);
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    "/jobs/:id",
    apiKeyAuth,
    requireScope("jobs"),
    validateParams(jobIdParamsSchema),
    async (req, res, next) => {
      try {
        const { id } = req.params as { id: string };
        const response = await getJob(id);
        res.status(200).json(response);
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
