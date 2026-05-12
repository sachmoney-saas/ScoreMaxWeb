import { Router } from "express";
import { z } from "zod";
import { requireUser } from "../lib/auth";
import { ApiError } from "../lib/errors";
import { supabaseAdmin } from "../lib/supabase-admin";

const MAX_PAYLOAD_JSON_CHARS = 24_000;

const clientErrorReportBodySchema = z
  .object({
    source: z.string().trim().min(1).max(128),
    message: z.string().trim().min(1).max(4000),
    errorCode: z.string().trim().max(128).optional(),
    errorDetail: z.string().trim().max(8000).optional(),
    errorHint: z.string().trim().max(2000).optional(),
    payload: z.record(z.string(), z.unknown()).optional(),
    clientRoute: z.string().trim().max(512).optional(),
    userAgent: z.string().trim().max(1024).optional(),
    appVersion: z.string().trim().max(64).optional(),
  })
  .strict();

/**
 * POST /v1/client-errors — remontée best-effort des erreurs côté client (auth obligatoire).
 * Persistance via service role ; la table a RLS sans policy utilisateur.
 */
export function createV1ClientErrorsRouter(): Router {
  const router = Router();

  router.post("/client-errors", async (req, res, next) => {
    try {
      const user = await requireUser(req.headers.authorization);
      const body = clientErrorReportBodySchema.parse(req.body);

      let payload: Record<string, unknown> = body.payload ?? {};
      const payloadStr = JSON.stringify(payload);
      if (payloadStr.length > MAX_PAYLOAD_JSON_CHARS) {
        payload = {
          _truncated: true,
          preview: payloadStr.slice(0, MAX_PAYLOAD_JSON_CHARS),
        };
      }

      const { error } = await supabaseAdmin.from("client_error_reports").insert({
        user_id: user.id,
        source: body.source,
        message: body.message,
        error_code: body.errorCode ?? null,
        error_detail: body.errorDetail ?? null,
        error_hint: body.errorHint ?? null,
        payload,
        client_route: body.clientRoute ?? null,
        user_agent: body.userAgent ?? null,
        app_version: body.appVersion ?? null,
      });

      if (error) {
        throw new ApiError({
          code: "INTERNAL_SERVER_ERROR",
          status: 500,
          message: "Unable to persist client error report",
          details: error,
        });
      }

      res.status(201).json({
        ok: true,
        httpStatus: 201,
        data: null,
        error: null,
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
