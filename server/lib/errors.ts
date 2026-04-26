import type { ScoreMaxErrorCode } from "@shared/oneshot";

export class ApiError extends Error {
  code: ScoreMaxErrorCode;
  status: number;
  details?: unknown;

  constructor(params: {
    code: ScoreMaxErrorCode;
    status: number;
    message: string;
    details?: unknown;
  }) {
    super(params.message);
    this.code = params.code;
    this.status = params.status;
    this.details = params.details;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function mapUnknownError(error: unknown): ApiError {
  if (isApiError(error)) {
    return error;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "type" in error &&
    (error as { type?: string }).type === "entity.too.large"
  ) {
    return new ApiError({
      code: "PAYLOAD_TOO_LARGE",
      status: 413,
      message: "Request payload is too large",
    });
  }

  if (error instanceof Error) {
    return new ApiError({
      code: "INTERNAL_SERVER_ERROR",
      status: 500,
      message: error.message || "Unexpected server error",
    });
  }

  return new ApiError({
    code: "INTERNAL_SERVER_ERROR",
    status: 500,
    message: "Unexpected server error",
  });
}
