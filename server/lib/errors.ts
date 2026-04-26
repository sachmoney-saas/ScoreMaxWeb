import type { OneshotErrorCode } from "@shared/oneshot";

export class ApiError extends Error {
  code: OneshotErrorCode;
  status: number;
  details?: unknown;

  constructor(params: {
    code: OneshotErrorCode;
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
