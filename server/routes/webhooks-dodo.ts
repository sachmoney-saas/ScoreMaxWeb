import { Router } from "express";
import { logger } from "../lib/logger";
import {
  DodoWebhookSignatureError,
  handleDodoWebhook,
} from "../lib/dodo/webhook";

declare module "express-serve-static-core" {
  interface Request {
    /**
     * Raw UTF-8 body, captured by `express.json({ verify })` in `index.ts`.
     * Required for Standard Webhooks signature verification.
     */
    rawBody?: string;
  }
}

/**
 * Express router for the public Dodo Payments webhook endpoint.
 *
 * Mounted outside of the `/v1` API namespace so it can be exposed with a
 * stable path that we register in the Dodo dashboard once. The route relies
 * on `req.rawBody` populated by the global JSON parser's `verify` hook so
 * the SDK can re-compute the HMAC signature against the exact payload bytes.
 */
export function createDodoWebhookRouter(): Router {
  const router = Router();

  router.post("/webhooks/dodo", async (req, res) => {
    const webhookId = req.header("webhook-id");
    const webhookSignature = req.header("webhook-signature");
    const webhookTimestamp = req.header("webhook-timestamp");

    if (!webhookId || !webhookSignature || !webhookTimestamp) {
      logger.warn(
        { headers: { webhookId, webhookSignature, webhookTimestamp } },
        "dodo: webhook missing required signature headers",
      );
      res.status(400).json({ ok: false, error: "missing webhook headers" });
      return;
    }

    const rawBody = req.rawBody;
    if (!rawBody) {
      logger.error("dodo: webhook raw body unavailable; check express.json verify hook");
      res.status(400).json({ ok: false, error: "missing raw body" });
      return;
    }

    try {
      const result = await handleDodoWebhook({
        rawBody,
        headers: {
          webhookId,
          webhookSignature,
          webhookTimestamp,
        },
      });
      res.status(200).json({ ok: true, status: result.status });
    } catch (error) {
      if (error instanceof DodoWebhookSignatureError) {
        logger.warn(
          { err: error.cause, webhookId },
          "dodo: webhook signature verification failed",
        );
        // 401 so Dodo surfaces this clearly in their dashboard. Dodo will not
        // retry on 4xx, which is what we want for malformed deliveries.
        res.status(401).json({ ok: false, error: "invalid signature" });
        return;
      }

      logger.error(
        { err: error, webhookId },
        "dodo: webhook handler failed; will be retried by Dodo",
      );
      // 5xx triggers Dodo's automatic retry with exponential backoff.
      res.status(500).json({ ok: false, error: "webhook processing failed" });
    }
  });

  return router;
}
