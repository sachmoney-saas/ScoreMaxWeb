import { Request, Response, NextFunction } from "express";
import { getApiKeyConfig } from "../lib/env";
import { ApiError } from "../lib/errors";

export function requireAdminApiRoutesEnabled(
  _req: Request,
  _res: Response,
  next: NextFunction,
) {
  try {
    const { adminRoutesEnabled } = getApiKeyConfig();
    if (!adminRoutesEnabled) {
      throw new ApiError({
        code: "API_KEY_FORBIDDEN",
        status: 403,
        message: "Admin API key routes are disabled in this environment",
      });
    }

    next();
  } catch (error) {
    next(error);
  }
}
