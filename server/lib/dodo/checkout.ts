import type { CustomerRequest } from "dodopayments/resources/payments";
import type { Plan } from "@shared/schema";
import { isPlan } from "@shared/schema";
import { ApiError } from "../errors";
import { getDodoClient } from "./client";
import { getDodoEnv } from "./env";

export type DodoCheckoutInput = {
  userId: string;
  email: string | null;
  fullName: string | null;
  plan: Plan;
  /** Optional existing Dodo customer id to attach the session to. */
  dodoCustomerId: string | null;
};

export type DodoCheckoutResult = {
  sessionId: string;
  checkoutUrl: string;
};

/**
 * Custom-field key Dodo will echo back in the subscription metadata.
 * We rely on this rather than the customer email to map webhook events
 * back to the originating ScoreMax user.
 */
export const DODO_METADATA_USER_ID_KEY = "scoremax_user_id";

function assertPlan(value: string): Plan {
  if (!isPlan(value)) {
    throw new ApiError({
      code: "VALIDATION_ERROR",
      status: 400,
      message: `Unknown subscription plan: ${value}`,
    });
  }
  return value;
}

/**
 * Create a hosted Dodo Payments checkout session for a subscription product.
 *
 * Hosted checkout is the recommended integration path (vs payment links): we
 * keep full control over the product cart, attach metadata so webhooks can
 * be mapped to a user id, and let Dodo handle PCI, taxes and adaptive pricing.
 */
function buildCustomerRequest(input: DodoCheckoutInput): CustomerRequest | null {
  if (input.dodoCustomerId) {
    return { customer_id: input.dodoCustomerId };
  }
  if (input.email) {
    return {
      email: input.email,
      name: input.fullName ?? null,
    };
  }
  // Fallback: let Dodo collect everything on the hosted page.
  return null;
}

export async function createSubscriptionCheckoutSession(
  input: DodoCheckoutInput,
): Promise<DodoCheckoutResult> {
  const env = getDodoEnv();
  const client = getDodoClient();
  const plan = assertPlan(input.plan);
  const productId = env.productIds[plan];

  const appOrigin = env.appBaseUrl.replace(/\/+$/, "");
  const session = await client.checkoutSessions.create({
    product_cart: [{ product_id: productId, quantity: 1 }],
    customer: buildCustomerRequest(input),
    return_url: `${appOrigin}/billing/success`,
    cancel_url: `${appOrigin}/billing`,
    metadata: {
      [DODO_METADATA_USER_ID_KEY]: input.userId,
      plan,
    },
    feature_flags: {
      allow_discount_code: true,
    },
    customization: {
      theme: "dark",
      show_order_details: true,
    },
  });

  if (!session.checkout_url) {
    throw new ApiError({
      code: "INTERNAL_SERVER_ERROR",
      status: 502,
      message: "Dodo returned a checkout session without a redirect URL",
      details: { sessionId: session.session_id },
    });
  }

  return {
    sessionId: session.session_id,
    checkoutUrl: session.checkout_url,
  };
}
