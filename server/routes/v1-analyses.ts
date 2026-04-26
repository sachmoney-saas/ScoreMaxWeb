import { Router } from "express";
import {
  analysesRequestSchema,
  type AnalysesRequest,
} from "@shared/oneshot";
import { runScoreMaxAnalyses } from "../lib/scoremax-client";
import { validateBody } from "../lib/validate";

export function createV1AnalysesRouter(): Router {
  const router = Router();

  router.post("/analyses", validateBody(analysesRequestSchema), async (req, res, next) => {
    try {
      const payload = req.body as AnalysesRequest;
      const data = await runScoreMaxAnalyses(payload);

      res.status(200).json({
        ok: true,
        httpStatus: 200,
        data,
        error: null,
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
