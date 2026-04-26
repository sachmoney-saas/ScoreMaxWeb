import { Router } from "express";
import { recentRequestsQuerySchema } from "@shared/oneshot";
import { validateQuery } from "../lib/validate";
import { getRecentRequests, getUiMode } from "../lib/oneshot-client";

export function createV1PublicRouter(): Router {
  const router = Router();

  router.get("/ui-mode", async (_req, res, next) => {
    try {
      const response = await getUiMode();
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  });

  router.get(
    "/recent-requests",
    validateQuery(recentRequestsQuerySchema),
    async (req, res, next) => {
      try {
        const { limit } = req.query as { limit?: number };
        const response = await getRecentRequests(limit);
        res.status(200).json(response);
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
