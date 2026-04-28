import type { Express } from "express";
import type { Server } from "http";
import { api } from "@shared/routes";

import { createV1AdminRouter } from "./routes/v1-admin";
import { createV1AnalysesRouter } from "./routes/v1-analyses";
import { createV1OnboardingRouter } from "./routes/v1-onboarding";

export async function registerRoutes(
  httpServer: Server,
  app: Express,
): Promise<Server> {
  app.get(api.health.path, (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/v1", createV1AdminRouter());
  app.use("/v1", createV1AnalysesRouter());
  app.use("/v1", createV1OnboardingRouter());

  return httpServer;
}
