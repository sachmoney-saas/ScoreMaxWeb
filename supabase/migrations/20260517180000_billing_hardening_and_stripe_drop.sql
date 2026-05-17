-- ===========================================================================
-- Durcissement billing + suppression code Stripe legacy.
--
-- 1. Recâble `scoremax_profiles_billing_customer_ever_subscribed` pour ne
--    plus dépendre de `profiles.stripe_customer_id` avant son DROP.
-- 2. Supprime les colonnes Stripe orphelines (`stripe_customer_id`,
--    `stripe_subscription_id`, `subscription_status`) — plus aucune lecture
--    serveur n'en dépend (seul `client/src/lib/stripe.ts` les touchait, et
--    il est lui-même supprimé dans ce patch côté code).
-- 3. Ajoute l'index manquant sur `subscription_events(subscription_id)`.
-- 4. REVOKE EXECUTE des fonctions SECURITY DEFINER qui ne doivent pas être
--    appelables depuis /rest/v1/rpc/ par anon/authenticated.
-- 5. Fixe le `search_path` des fonctions touch/updated_at qui étaient
--    listées en `function_search_path_mutable` par l'advisor.
-- 6. Ajoute une fonction de purge `dodo_webhook_events` (utilisable depuis
--    un cron ou le serveur).
-- ===========================================================================

BEGIN;

-- --------------------------------------------------------------------------
-- 1) Trigger function: drop stripe dependency
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.scoremax_profiles_billing_customer_ever_subscribed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.dodo_customer_id IS NOT NULL THEN
    PERFORM public.scoremax_mark_has_ever_subscribed(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS scoremax_profiles_mark_ever_subscribed ON public.profiles;
CREATE TRIGGER scoremax_profiles_mark_ever_subscribed
  AFTER INSERT OR UPDATE OF dodo_customer_id ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.scoremax_profiles_billing_customer_ever_subscribed();

-- --------------------------------------------------------------------------
-- 2) Drop legacy Stripe columns from profiles
-- --------------------------------------------------------------------------
ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS stripe_customer_id,
  DROP COLUMN IF EXISTS stripe_subscription_id,
  DROP COLUMN IF EXISTS subscription_status;

-- --------------------------------------------------------------------------
-- 3) subscription_events: index FK
-- --------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS scoremax_subscription_events_subscription_idx
  ON public.subscription_events (subscription_id);

-- --------------------------------------------------------------------------
-- 4) Lock down SECURITY DEFINER functions that should not be REST-callable
--    by anon / authenticated. These are internal helpers (triggers, sync,
--    bootstrap) — the server reaches them with the service_role JWT, which
--    bypasses the role grants below.
-- --------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.set_updated_at()                               FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.scoremax_set_updated_at()                      FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.scoremax_touch_updated_at()                    FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.rls_auto_enable()                              FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.scoremax_handle_new_user()                     FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.scoremax_has_premium_access(uuid)              FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.scoremax_is_admin(uuid)                        FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.scoremax_is_subscriber(uuid)                   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.scoremax_mark_has_ever_subscribed(uuid)        FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.scoremax_sync_is_subscriber(uuid)              FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.scoremax_profiles_billing_customer_ever_subscribed() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.scoremax_user_subscriptions_sync_trigger()           FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.scoremax_refresh_scan_session_progress(uuid)         FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.scoremax_refresh_scan_session_progress_trigger()     FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.scoremax_purge_client_error_reports(boolean)         FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_recent_scan_status(integer)                      FROM PUBLIC, anon, authenticated;

-- `ensure_onboarding_scan_session()` and `get_onboarding_scan_status()` are
-- intentionally callable by authenticated users (front-end RPCs) — kept as-is.

-- --------------------------------------------------------------------------
-- 5) Pin search_path on touch/updated_at functions flagged as mutable
-- --------------------------------------------------------------------------
ALTER FUNCTION public.set_updated_at()              SET search_path = public, pg_temp;
ALTER FUNCTION public.scoremax_set_updated_at()     SET search_path = public, pg_temp;
ALTER FUNCTION public.scoremax_touch_updated_at()   SET search_path = public, pg_temp;

-- --------------------------------------------------------------------------
-- 6) Maintenance: purge old, successfully-processed webhook deliveries
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.scoremax_purge_dodo_webhook_events(
  p_processed_older_than_days integer DEFAULT 90
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_deleted bigint;
BEGIN
  IF p_processed_older_than_days < 7 THEN
    RAISE EXCEPTION 'Refusing to purge dodo_webhook_events younger than 7 days';
  END IF;

  WITH del AS (
    DELETE FROM public.dodo_webhook_events
    WHERE processed_at IS NOT NULL
      AND error IS NULL
      AND received_at < (now() - make_interval(days => p_processed_older_than_days))
    RETURNING 1
  )
  SELECT count(*) INTO v_deleted FROM del;

  RETURN v_deleted;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.scoremax_purge_dodo_webhook_events(integer)
  FROM PUBLIC, anon, authenticated;

COMMIT;
