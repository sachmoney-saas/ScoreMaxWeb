import { Request, Response, NextFunction } from "express";
import type { ApiKeyScope } from "@shared/oneshot";
import { ApiError } from "../lib/errors";
import { getAuthenticatedApiKey } from "./api-key-auth";

export function requireScope(scope: ApiKeyScope) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      const apiKey = getAuthenticatedApiKey(req);
      if (!apiKey.scopes.includes(scope)) {
        throw new ApiError({
          code: "API_KEY_FORBIDDEN",
          status: 403,
          message: `API key missing required scope: ${scope}`,
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
