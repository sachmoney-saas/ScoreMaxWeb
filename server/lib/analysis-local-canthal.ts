import {
  applyLocalCanthalTiltToAggregates,
  canthalTiltCategoryFromMeanDegrees,
} from "@shared/canthal-tilt";
import type { AnalysesResponse } from "@shared/oneshot";
import {
  CAPTURE_META_EYE_CANTHAL_TILT_DEG,
  type GuideTraceMetricsForAnalysis,
} from "@shared/schema";
import { logger } from "./logger";
import { supabaseAdmin } from "./supabase-admin";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pickFiniteMetric(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export async function loadLatestEyeCanthalTiltDeg(params: {
  userId: string;
  sessionId: string;
}): Promise<number | null> {
  const { data, error } = await supabaseAdmin
    .from("scan_assets")
    .select("capture_metadata, created_at")
    .eq("user_id", params.userId)
    .eq("session_id", params.sessionId)
    .eq("asset_type_code", "GUIDE_TRACE_EYE_CANTHAL_TILT")
    .in("upload_status", ["uploaded", "validated"])
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  for (const row of data ?? []) {
    const metadata = (row as { capture_metadata?: unknown }).capture_metadata;
    if (!isRecord(metadata)) continue;
    const value = pickFiniteMetric(metadata[CAPTURE_META_EYE_CANTHAL_TILT_DEG]);
    if (value !== null) return value;
  }
  return null;
}

export async function tryLoadLatestEyeCanthalTiltDeg(params: {
  userId: string;
  sessionId: string;
  context: string;
}): Promise<number | null> {
  try {
    return await loadLatestEyeCanthalTiltDeg(params);
  } catch (error) {
    logger.warn(
      {
        err: error,
        userId: params.userId,
        sessionId: params.sessionId,
        context: params.context,
      },
      "Unable to load local eye canthal tilt metric",
    );
    return null;
  }
}

export function mergeEyeCanthalTiltIntoCaptureGuideMetrics(
  metrics: GuideTraceMetricsForAnalysis | null,
  eyeCanthalTiltDeg: number | null,
): GuideTraceMetricsForAnalysis | null {
  const next: GuideTraceMetricsForAnalysis = { ...(metrics ?? {}) };
  if (eyeCanthalTiltDeg !== null && canthalTiltCategoryFromMeanDegrees(eyeCanthalTiltDeg)) {
    next[CAPTURE_META_EYE_CANTHAL_TILT_DEG] = eyeCanthalTiltDeg;
  }
  return Object.keys(next).length > 0 ? next : null;
}

export function applyLocalEyeCanthalTiltToAnalysisResponse(
  analysis: AnalysesResponse,
  eyeCanthalTiltDeg: number | null,
): AnalysesResponse {
  if (eyeCanthalTiltDeg === null) return analysis;
  if (!canthalTiltCategoryFromMeanDegrees(eyeCanthalTiltDeg)) return analysis;

  return {
    ...analysis,
    resultsByWorker: analysis.resultsByWorker.map((workerResult) => {
      if (workerResult.worker !== "eyes") return workerResult;
      return {
        ...workerResult,
        outputAggregates: applyLocalCanthalTiltToAggregates(
          workerResult.outputAggregates,
          eyeCanthalTiltDeg,
        ),
      };
    }),
  };
}

export function applyLocalEyeCanthalTiltToStoredResult(
  result: Record<string, unknown>,
  worker: string,
  eyeCanthalTiltDeg: number | null,
): Record<string, unknown> {
  if (worker !== "eyes" || eyeCanthalTiltDeg === null) return result;
  if (!canthalTiltCategoryFromMeanDegrees(eyeCanthalTiltDeg)) return result;
  const outputAggregates = isRecord(result.outputAggregates)
    ? result.outputAggregates
    : {};

  return {
    ...result,
    outputAggregates: applyLocalCanthalTiltToAggregates(
      outputAggregates,
      eyeCanthalTiltDeg,
    ),
  };
}

export function applyLocalEyeCanthalTiltToResultRows<
  T extends { worker?: unknown; result?: unknown },
>(rows: T[] | null | undefined, eyeCanthalTiltDeg: number | null): T[] {
  return (rows ?? []).map((row) => {
    const worker = typeof row.worker === "string" ? row.worker : "";
    if (!isRecord(row.result)) return row;
    return {
      ...row,
      result: applyLocalEyeCanthalTiltToStoredResult(
        row.result,
        worker,
        eyeCanthalTiltDeg,
      ),
    };
  });
}
