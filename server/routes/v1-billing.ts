import { Router } from "express";
import { z } from "zod";
import { isPlan, SUBSCRIPTION_PLANS } from "@shared/schema";
import { requireUser } from "../lib/auth";
import { createSubscriptionCheckoutSession } from "../lib/dodo/checkout";
import { createCustomerPortalSession } from "../lib/dodo/customer-portal";
import { ApiError } from "../lib/errors";
import { getPremiumAccessState } from "../lib/subscriptions";
import { supabaseAdmin } from "../lib/supabase-admin";

const checkoutBodySchema = z.object({
  plan: z.enum(SUBSCRIPTION_PLANS),
});

type ProfileBillingRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  dodo_customer_id: string | null;
};

async function loadBillingProfile(userId: string): Promise<ProfileBillingRow> {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, email, full_name, dodo_customer_id")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new ApiError({
      code: "INTERNAL_SERVER_ERROR",
      status: 500,
      message: "Unable to load billing profile",
      details: error,
    });
  }

  if (!data) {
    throw new ApiError({
      code: "VALIDATION_ERROR",
      status: 404,
      message: "User profile not found",
    });
  }

  return data as ProfileBillingRow;
}

export function createV1BillingRouter(): Router {
  const router = Router();

  /** Current premium-access state for the calling user. */
  router.get("/billing/subscription", async (req, res, next) => {
    try {
      const user = await requireUser(req.headers.authorization);
      const state = await getPremiumAccessState(user.id);
      res.json({
        ok: true,
        httpStatus: 200,
        data: state,
        error: null,
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Create a Dodo hosted checkout session for the requested plan and return
   * the URL the client should redirect the user to.
   */
  router.post("/billing/checkout", async (req, res, next) => {
    try {
      const user = await requireUser(req.headers.authorization);
      const body = checkoutBodySchema.parse(req.body ?? {});
      if (!isPlan(body.plan)) {
        throw new ApiError({
          code: "VALIDATION_ERROR",
          status: 400,
          message: "Unsupported subscription plan",
        });
      }

      const profile = await loadBillingProfile(user.id);
      const access = await getPremiumAccessState(user.id);

      if (access.is_subscriber) {
        throw new ApiError({
          code: "VALIDATION_ERROR",
          status: 409,
          message: "User already has an active subscription",
          details: { reason: "already_subscribed" },
        });
      }

      const { sessionId, checkoutUrl } =
        await createSubscriptionCheckoutSession({
          userId: user.id,
          email: user.email ?? profile.email,
          fullName: profile.full_name,
          dodoCustomerId: profile.dodo_customer_id,
          plan: body.plan,
        });

      res.json({
        ok: true,
        httpStatus: 200,
        data: { session_id: sessionId, checkout_url: checkoutUrl },
        error: null,
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * Create a Dodo customer-portal session so the user can manage their
   * subscription (cancel, change payment method, view invoices…).
   */
  router.post("/billing/portal", async (req, res, next) => {
    try {
      const user = await requireUser(req.headers.authorization);
      const profile = await loadBillingProfile(user.id);

      if (!profile.dodo_customer_id) {
        throw new ApiError({
          code: "VALIDATION_ERROR",
          status: 404,
          message: "No Dodo customer attached to this account",
          details: { reason: "no_dodo_customer" },
        });
      }

      const { url } = await createCustomerPortalSession({
        dodoCustomerId: profile.dodo_customer_id,
      });

      res.json({
        ok: true,
        httpStatus: 200,
        data: { portal_url: url },
        error: null,
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
