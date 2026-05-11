import type { Express } from "express";
import type { Server } from "http";
import { api } from "@shared/routes";

import { createV1AccountRouter } from "./routes/v1-account";
import { createV1AdminRouter } from "./routes/v1-admin";
import { createV1AnalysesRouter } from "./routes/v1-analyses";
import { createV1BillingRouter } from "./routes/v1-billing";
import { createV1OnboardingRouter } from "./routes/v1-onboarding";
import { createDodoWebhookRouter } from "./routes/webhooks-dodo";

export async function registerRoutes(
  httpServer: Server,
  app: Express,
): Promise<Server> {
  app.get(api.health.path, (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/v1", createV1AccountRouter());
  app.use("/v1", createV1AdminRouter());
  app.use("/v1", createV1AnalysesRouter());
  app.use("/v1", createV1BillingRouter());
  app.use("/v1", createV1OnboardingRouter());

  // Public, unauthenticated webhook receiver — mounted at the app root
  // because Dodo dashboards take an absolute URL we want to keep stable.
  app.use(createDodoWebhookRouter());

  return httpServer;
}
