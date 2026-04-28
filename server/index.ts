import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { recoverAnalysisJobsOnStartup } from "./lib/analysis-jobs";
import { logger } from "./lib/logger";
import { serverEnv } from "./lib/env";
import { mapUnknownError } from "./lib/errors";
import pinoHttp from "pino-http";

const app = express();
const httpServer = createServer(app);

app.use(express.json({ limit: serverEnv.SCOREMAX_PAYLOAD_LIMIT }));
app.use(express.urlencoded({ extended: false }));

app.get(["/health", "/healthz"], (_req, res) => {
  res.status(200).json({ ok: true });
});

app.use(
  pinoHttp({
    logger,
    // Filter out asset requests from logs to keep them clean
    autoLogging: {
      ignore: (req) => {
        const url = req.url || "";
        return (
          url.startsWith("/@") ||
          url.includes(".") ||
          url.startsWith("/src/") ||
          url.startsWith("/node_modules/")
        );
      },
    },
    customLogLevel: (req, res, err) => {
      if (res.statusCode >= 500 || err) return "error";
      if (res.statusCode >= 400) return "warn";
      return "info";
    },
    serializers: {
      req: (req) => ({
        method: req.method,
        url: req.url,
      }),
    },
  }),
);

(async () => {
  await registerRoutes(httpServer, app);

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const apiError = mapUnknownError(err);

    logger.error(
      {
        err,
        code: apiError.code,
        status: apiError.status,
      },
      apiError.message,
    );

    res.status(apiError.status).json({
      ok: false,
      httpStatus: apiError.status,
      data: null,
      error: {
        code: apiError.code,
        message: apiError.message,
      },
    });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (serverEnv.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // Serve the app on the port from PORT, defaulting to 5000.
  // This serves both the API and the client.
  const port = serverEnv.PORT;
  httpServer.listen(port, "0.0.0.0", () => {
    logger.info(`serving on port ${port}`);
    setImmediate(() => {
      void recoverAnalysisJobsOnStartup();
    });
  });
})();
