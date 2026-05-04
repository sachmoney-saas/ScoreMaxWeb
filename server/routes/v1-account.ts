import { Router } from "express";
import { z } from "zod";
import { deleteUserAccountCompletely } from "../lib/account-deletion";
import { requireAdminUser, requireUser } from "../lib/auth";
import { ApiError } from "../lib/errors";

const userIdParamsSchema = z.object({
  userId: z.string().uuid(),
});

export function createV1AccountRouter(): Router {
  const router = Router();

  /** Self-service : JWT = utilisateur supprimé. */
  router.delete("/account", async (req, res, next) => {
    try {
      const user = await requireUser(req.headers.authorization);
      await deleteUserAccountCompletely(user.id, { allowActiveSubscriber: false });
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  /** Admin : suppression d’un autre compte (abonnés inclus). */
  router.delete("/admin/users/:userId", async (req, res, next) => {
    try {
      const admin = await requireAdminUser(req.headers.authorization);
      const { userId } = userIdParamsSchema.parse(req.params);

      if (userId === admin.id) {
        throw new ApiError({
          code: "VALIDATION_ERROR",
          status: 400,
          message: "Admins cannot delete their own account via this endpoint",
        });
      }

      await deleteUserAccountCompletely(userId, { allowActiveSubscriber: true });
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  return router;
}
