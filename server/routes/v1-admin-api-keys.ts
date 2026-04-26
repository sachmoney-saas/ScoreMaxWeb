import { Router } from "express";
import {
  createApiKeyRequestSchema,
  revokeApiKeyParamsSchema,
  type CreateApiKeyRequest,
} from "@shared/oneshot";
import {
  createApiKey,
  listApiKeys,
  revokeApiKey,
} from "../lib/api-keys";
import { validateBody, validateParams } from "../lib/validate";
import { requireAdminApiRoutesEnabled } from "../middleware/dev-only";

export function createV1AdminApiKeysRouter(): Router {
  const router = Router();

  router.use(requireAdminApiRoutesEnabled);

  router.get("/", async (_req, res, next) => {
    try {
      const records = await listApiKeys();
      res.status(200).json({ records });
    } catch (error) {
      next(error);
    }
  });

  router.post("/", validateBody(createApiKeyRequestSchema), async (req, res, next) => {
    try {
      const payload = req.body as CreateApiKeyRequest;
      const response = await createApiKey(payload);
      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  });

  router.post(
    "/:id/revoke",
    validateParams(revokeApiKeyParamsSchema),
    async (req, res, next) => {
      try {
        const { id } = req.params as { id: string };
        const record = await revokeApiKey(id);
        res.status(200).json({ record });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
