import { getDodoClient } from "./client";
import { getDodoEnv } from "./env";

export type DodoPortalResult = {
  /** Hosted Dodo customer-portal URL. Single-use; safe to redirect to. */
  url: string;
};

/**
 * Create a Dodo Payments customer-portal session for an existing customer.
 *
 * The portal lets the customer manage payment methods, view invoices, cancel,
 * upgrade/downgrade and reactivate their subscription — without us having to
 * build any of that UI server-side.
 */
export async function createCustomerPortalSession(params: {
  dodoCustomerId: string;
}): Promise<DodoPortalResult> {
  const env = getDodoEnv();
  const client = getDodoClient();

  const appOrigin = env.appBaseUrl.replace(/\/+$/, "");
  const session = await client.customers.customerPortal.create(
    params.dodoCustomerId,
    {
      return_url: `${appOrigin}/billing`,
    },
  );

  return { url: session.link };
}
