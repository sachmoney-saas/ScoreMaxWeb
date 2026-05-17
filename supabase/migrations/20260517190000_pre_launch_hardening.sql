-- ===========================================================================
-- Pre-launch hardening: subscription sync corner cases + lookup primary key.
--
-- 1. P0-1 — `scoremax_sync_is_subscriber` now looks up profiles by `user_id`
--    (the actual PK), not the legacy nullable `id` column. Same for
--    `scoremax_mark_has_ever_subscribed`.
-- 2. P0-2 — New `scoremax_apply_dodo_active_subscription` RPC: atomically
--    cancel any other active Dodo subscription rows for the same user BEFORE
--    upserting the new one. Protects against the partial unique index
--    `scoremax_user_subscriptions_active_uidx` blowing up when a user
--    re-subscribes while their previous sub is still in the cancel-at-eob
--    grace period.
-- 3. P1-3 — Drop the redundant unique index
--    `user_subscriptions_dodo_external_id_unique` (covered by
--    `scoremax_user_subscriptions_external_uidx`).
-- 4. Cosmetic purge: clear the stale `error` text on `dodo_webhook_events`
--    rows that have since been successfully processed.
-- ===========================================================================

BEGIN;

-- --------------------------------------------------------------------------
-- 1) Profiles lookups: switch from `id` (legacy) to `user_id` (PK)
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.scoremax_sync_is_subscriber(target_user uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_active BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.user_subscriptions us
    WHERE us.user_id = target_user
      AND us.status = 'active'
      AND (us.current_period_end IS NULL OR us.current_period_end > NOW())
  ) INTO has_active;

  UPDATE public.profiles
     SET is_subscriber = has_active,
         updated_at = NOW()
   WHERE user_id = target_user
     AND is_subscriber IS DISTINCT FROM has_active;
END;
$$;

CREATE OR REPLACE FUNCTION public.scoremax_mark_has_ever_subscribed(target_user uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
     SET has_ever_subscribed = true,
         updated_at = NOW()
   WHERE user_id = target_user
     AND has_ever_subscribed IS DISTINCT FROM true;
END;
$$;

-- --------------------------------------------------------------------------
-- 2) Atomic "apply active Dodo subscription" RPC
--    Pre-cancels any other dodo+active rows for the user, then upserts the
--    new one in a single transaction. Returns enough info for the caller to
--    derive `is_first_insert` and decide whether to kick off the analysis.
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.scoremax_apply_dodo_active_subscription(
  p_user_id uuid,
  p_external_subscription_id text,
  p_status text,
  p_current_period_start timestamptz,
  p_current_period_end timestamptz,
  p_metadata jsonb
)
RETURNS TABLE (
  subscription_row_id uuid,
  is_first_insert boolean,
  was_active_before boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_was_active_before boolean := false;
  v_id uuid;
  v_created_at timestamptz;
  v_updated_at timestamptz;
BEGIN
  IF p_user_id IS NULL OR p_external_subscription_id IS NULL OR p_status IS NULL THEN
    RAISE EXCEPTION 'scoremax_apply_dodo_active_subscription: required argument is null';
  END IF;

  IF p_status NOT IN ('active', 'canceled', 'expired') THEN
    RAISE EXCEPTION 'scoremax_apply_dodo_active_subscription: invalid status %', p_status;
  END IF;

  -- Step 1 — Only when we're about to mark a row as active, neutralize any
  -- *other* active dodo rows for the same user. This protects the partial
  -- unique index `scoremax_user_subscriptions_active_uidx`.
  IF p_status = 'active' THEN
    UPDATE public.user_subscriptions
       SET status = 'canceled',
           metadata = COALESCE(metadata, '{}'::jsonb) ||
             jsonb_build_object('superseded_by', p_external_subscription_id,
                                'superseded_at', NOW())
     WHERE user_id = p_user_id
       AND source = 'dodo'
       AND status = 'active'
       AND external_subscription_id IS DISTINCT FROM p_external_subscription_id;
  END IF;

  -- Step 2 — Detect prior active state for this exact subscription id
  -- (informational; the caller might want to log a "reactivation" event).
  SELECT EXISTS (
    SELECT 1
    FROM public.user_subscriptions
    WHERE source = 'dodo'
      AND external_subscription_id = p_external_subscription_id
      AND status = 'active'
  ) INTO v_was_active_before;

  -- Step 3 — Atomic UPSERT on (source, external_subscription_id).
  INSERT INTO public.user_subscriptions (
    user_id, status, source, current_period_start, current_period_end,
    external_subscription_id, metadata
  )
  VALUES (
    p_user_id, p_status, 'dodo', p_current_period_start, p_current_period_end,
    p_external_subscription_id, COALESCE(p_metadata, '{}'::jsonb)
  )
  ON CONFLICT (source, external_subscription_id)
    WHERE external_subscription_id IS NOT NULL
  DO UPDATE SET
    user_id              = EXCLUDED.user_id,
    status               = EXCLUDED.status,
    current_period_start = EXCLUDED.current_period_start,
    current_period_end   = EXCLUDED.current_period_end,
    metadata             = EXCLUDED.metadata
  RETURNING id, created_at, updated_at
  INTO v_id, v_created_at, v_updated_at;

  RETURN QUERY SELECT
    v_id,
    (v_created_at = v_updated_at)::boolean,
    v_was_active_before;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.scoremax_apply_dodo_active_subscription(uuid, text, text, timestamptz, timestamptz, jsonb)
  FROM PUBLIC, anon, authenticated;

-- --------------------------------------------------------------------------
-- 3) Drop redundant unique index — covered by the broader composite index.
-- --------------------------------------------------------------------------
DROP INDEX IF EXISTS public.user_subscriptions_dodo_external_id_unique;

-- --------------------------------------------------------------------------
-- 4) Cosmetic purge — clear stale error text on already-processed rows.
-- --------------------------------------------------------------------------
UPDATE public.dodo_webhook_events
   SET error = NULL
 WHERE error IS NOT NULL
   AND processed_at IS NOT NULL;

COMMIT;
