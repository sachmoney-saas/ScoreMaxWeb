import { Request, Response, NextFunction } from "express";
import { verifyApiKey } from "../lib/api-keys";
import { ApiError } from "../lib/errors";

export type AuthenticatedApiKey = {
  id: string;
  scopes: string[];
};

export function getAuthenticatedApiKey(req: Request): AuthenticatedApiKey {
  const auth = (req as Request & { apiKey?: AuthenticatedApiKey }).apiKey;
  if (!auth) {
    throw new ApiError({
      code: "API_KEY_INVALID",
      status: 401,
      message: "Missing authenticated API key context",
    });
  }

  return auth;
}

export async function apiKeyAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const raw = req.header("x-api-key");
    if (!raw) {
      throw new ApiError({
        code: "API_KEY_MISSING",
        status: 401,
        message: "x-api-key header is required",
      });
    }

    const verified = await verifyApiKey(raw);
    (req as Request & { apiKey?: AuthenticatedApiKey }).apiKey = {
      id: verified.id,
      scopes: verified.scopes,
    };

    next();
  } catch (error) {
    next(error);
  }
}
