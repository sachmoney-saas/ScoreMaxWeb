import {
  analysesResponseSchema,
  scoreMaxErrorCodeSchema,
  type AnalysesRequest,
  type AnalysesResponse,
  type ScoreMaxErrorCode,
} from "@shared/oneshot";
import { getScoreMaxEnv } from "./env";
import { ApiError } from "./errors";

type ScoreMaxErrorPayload = {
  code?: string;
  message?: string;
};

function buildUrl(path: string): string {
  const { baseUrl } = getScoreMaxEnv();
  return `${baseUrl.replace(/\/$/, "")}${path}`;
}

async function parseErrorPayload(response: Response): Promise<ScoreMaxErrorPayload> {
  try {
    const json = (await response.json()) as unknown;
    if (json && typeof json === "object") {
      return json as ScoreMaxErrorPayload;
    }
  } catch {
    // ignore
  }

  try {
    const text = await response.text();
    return text ? { message: text } : {};
  } catch {
    return {};
  }
}

function coerceErrorCode(code?: string): ScoreMaxErrorCode {
  const parsed = scoreMaxErrorCodeSchema.safeParse(code);
  return parsed.success ? parsed.data : "INTERNAL_SERVER_ERROR";
}

export async function runScoreMaxAnalyses(
  payload: AnalysesRequest,
): Promise<AnalysesResponse> {
  const { apiKey, timeoutMs } = getScoreMaxEnv();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(buildUrl("/v1/analyses"), {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorPayload = await parseErrorPayload(response);
      throw new ApiError({
        code: coerceErrorCode(errorPayload.code),
        status: response.status,
        message: errorPayload.message || "ScoreMax API request failed",
      });
    }

    const json = (await response.json()) as unknown;
    return analysesResponseSchema.parse(json);
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new ApiError({
        code: "INTERNAL_SERVER_ERROR",
        status: 504,
        message: "ScoreMax API request timed out",
      });
    }

    throw new ApiError({
      code: "INTERNAL_SERVER_ERROR",
      status: 502,
      message: "Unable to reach ScoreMax API",
    });
  } finally {
    clearTimeout(timeout);
  }
}
