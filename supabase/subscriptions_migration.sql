-- =============================================================================
-- SCOREMAX — Subscription infrastructure (additive, idempotent)
-- =============================================================================
-- Goals:
--   * Track real subscriptions in `user_subscriptions` (one active row per user)
--   * Audit grants/revocations in `subscription_events`
--   * `profiles.is_subscriber` is a denormalised mirror, maintained by trigger
--   * Two access functions:
--       - scoremax_is_subscriber(uid)        : has an active subscription row
--       - scoremax_has_premium_access(uid)   : admin OR active subscription
--   * Admins keep premium access automatically (no need to grant a sub)
--   * Backfill: existing `profiles.is_subscriber = true` becomes a manual_admin
--     subscription row, so history is preserved.
--
-- Run-once instructions:
--   1) Execute this script in the Supabase SQL Editor, on top of the standard
--      patch. It is safe to re-run.
--   2) Application code uses scoremax_has_premium_access(auth.uid()) wherever
--      a "subscribed-or-admin" gate is needed.
-- =============================================================================

-- 1) Subscriptions table (one logical "active" row per user) -------------------
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  source TEXT NOT NULL,
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  granted_reason TEXT,
  external_subscription_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  CONSTRAINT scoremax_user_subscriptions_status_check
    CHECK (status IN ('active', 'canceled', 'expired')),
  CONSTRAINT scoremax_user_subscriptions_source_check
    CHECK (source IN ('manual_admin', 'dodo', 'stripe'))
);

-- At most one active subscription per user (any status/source).
-- "active" rows are the only ones that grant premium access today.
CREATE UNIQUE INDEX IF NOT EXISTS scoremax_user_subscriptions_active_uidx
  ON public.user_subscriptions (user_id)
  WHERE status = 'active';

-- Frequently used filters
CREATE INDEX IF NOT EXISTS scoremax_user_subscriptions_user_idx
  ON public.user_subscriptions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS scoremax_user_subscriptions_source_idx
  ON public.user_subscriptions (source, status);
CREATE UNIQUE INDEX IF NOT EXISTS scoremax_user_subscriptions_external_uidx
  ON public.user_subscriptions (source, external_subscription_id)
  WHERE external_subscription_id IS NOT NULL;

ALTER TABLE IF EXISTS public.user_subscriptions ENABLE ROW LEVEL SECURITY;

-- 2) Audit log (immutable, INSERT-only by app/admins) -------------------------
CREATE TABLE IF NOT EXISTS public.subscription_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.user_subscriptions(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  source TEXT NOT NULL,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reason TEXT,
  metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  CONSTRAINT scoremax_subscription_events_type_check
    CHECK (event_type IN (
      'granted',
      'revoked',
      'expired',
      'renewed',
      'period_updated',
      'admin_note'
    )),
  CONSTRAINT scoremax_subscription_events_source_check
    CHECK (source IN ('manual_admin', 'dodo', 'stripe', 'system'))
);

CREATE INDEX IF NOT EXISTS scoremax_subscription_events_user_idx
  ON public.subscription_events (user_id, created_at DESC);

ALTER TABLE IF EXISTS public.subscription_events ENABLE ROW LEVEL SECURITY;

-- 3) updated_at trigger on user_subscriptions ---------------------------------
CREATE OR REPLACE FUNCTION public.scoremax_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'scoremax_user_subscriptions_touch_updated_at'
  ) THEN
    CREATE TRIGGER scoremax_user_subscriptions_touch_updated_at
      BEFORE UPDATE ON public.user_subscriptions
      FOR EACH ROW
      EXECUTE FUNCTION public.scoremax_touch_updated_at();
  END IF;
END $$;

-- 4) Mirror trigger: keep profiles.is_subscriber in sync ----------------------
-- profiles.is_subscriber is a fast-path for app/UI; the source of truth is
-- user_subscriptions. Any insert/update/delete on user_subscriptions for a
-- given user recomputes the mirror.
CREATE OR REPLACE FUNCTION public.scoremax_sync_is_subscriber(target_user UUID)
RETURNS VOID
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
   WHERE id = target_user
     AND is_subscriber IS DISTINCT FROM has_active;
END;
$$;

CREATE OR REPLACE FUNCTION public.scoremax_user_subscriptions_sync_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.scoremax_sync_is_subscriber(OLD.user_id);
    RETURN OLD;
  END IF;

  PERFORM public.scoremax_sync_is_subscriber(NEW.user_id);

  IF TG_OP = 'UPDATE' AND NEW.user_id <> OLD.user_id THEN
    PERFORM public.scoremax_sync_is_subscriber(OLD.user_id);
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'scoremax_on_user_subscription_change'
  ) THEN
    CREATE TRIGGER scoremax_on_user_subscription_change
      AFTER INSERT OR UPDATE OR DELETE ON public.user_subscriptions
      FOR EACH ROW
      EXECUTE FUNCTION public.scoremax_user_subscriptions_sync_trigger();
  END IF;
END $$;

-- 5) Access functions ---------------------------------------------------------
-- scoremax_is_subscriber: TRUE iff the user has at least one active sub row
-- (independent of admin status). Used for analytics and pure subscriber gates.
CREATE OR REPLACE FUNCTION public.scoremax_is_subscriber(target_user UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_subscriptions us
    WHERE us.user_id = target_user
      AND us.status = 'active'
      AND (us.current_period_end IS NULL OR us.current_period_end > NOW())
  );
$$;

-- scoremax_has_premium_access: TRUE iff user is admin OR has an active sub.
-- This is the gate to use in the application and in RLS for premium features.
CREATE OR REPLACE FUNCTION public.scoremax_has_premium_access(target_user UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    public.scoremax_is_admin(target_user)
    OR public.scoremax_is_subscriber(target_user);
$$;

GRANT EXECUTE ON FUNCTION public.scoremax_is_subscriber(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.scoremax_has_premium_access(UUID) TO authenticated;

-- 6) RLS policies -------------------------------------------------------------
DO $$
BEGIN
  -- user_subscriptions: a user can read their own row; admins see all.
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_subscriptions'
      AND policyname = 'scoremax_user_subscriptions_select_own'
  ) THEN
    EXECUTE 'CREATE POLICY "scoremax_user_subscriptions_select_own" ON public.user_subscriptions FOR SELECT USING (auth.uid() = user_id)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_subscriptions'
      AND policyname = 'scoremax_user_subscriptions_select_admin'
  ) THEN
    EXECUTE 'CREATE POLICY "scoremax_user_subscriptions_select_admin" ON public.user_subscriptions FOR SELECT USING (public.scoremax_is_admin(auth.uid()))';
  END IF;

  -- All write paths flow through the service role (server). We do NOT grant
  -- INSERT/UPDATE/DELETE to authenticated, on purpose.

  -- subscription_events: read-own and admin-read; inserts via service role.
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'subscription_events'
      AND policyname = 'scoremax_subscription_events_select_own'
  ) THEN
    EXECUTE 'CREATE POLICY "scoremax_subscription_events_select_own" ON public.subscription_events FOR SELECT USING (auth.uid() = user_id)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'subscription_events'
      AND policyname = 'scoremax_subscription_events_select_admin'
  ) THEN
    EXECUTE 'CREATE POLICY "scoremax_subscription_events_select_admin" ON public.subscription_events FOR SELECT USING (public.scoremax_is_admin(auth.uid()))';
  END IF;
END $$;

-- 7) Backfill existing data ---------------------------------------------------
-- Any pre-existing `profiles.is_subscriber = true` row is converted to an
-- active manual_admin subscription so the new function returns the correct
-- value. Idempotent: ON CONFLICT skips already-imported users.
INSERT INTO public.user_subscriptions (user_id, status, source, granted_reason)
SELECT p.id, 'active', 'manual_admin', 'backfill: legacy profiles.is_subscriber = true'
FROM public.profiles p
LEFT JOIN public.user_subscriptions us
  ON us.user_id = p.id AND us.status = 'active'
WHERE p.is_subscriber = TRUE
  AND us.id IS NULL;

INSERT INTO public.subscription_events (user_id, subscription_id, event_type, source, reason)
SELECT us.user_id, us.id, 'granted', 'manual_admin', us.granted_reason
FROM public.user_subscriptions us
LEFT JOIN public.subscription_events se
  ON se.subscription_id = us.id AND se.event_type = 'granted'
WHERE us.granted_reason = 'backfill: legacy profiles.is_subscriber = true'
  AND se.id IS NULL;

-- Re-sync mirror in case some users had no row inserted (already there) but
-- the boolean and the active subscription state diverged.
SELECT public.scoremax_sync_is_subscriber(p.id)
FROM public.profiles p;

-- 8) Quick verification -------------------------------------------------------
SELECT
  CASE WHEN to_regclass('public.user_subscriptions') IS NULL THEN 'missing' ELSE 'present' END AS user_subscriptions_table,
  CASE WHEN to_regclass('public.subscription_events') IS NULL THEN 'missing' ELSE 'present' END AS subscription_events_table;

SELECT
  proname AS function_name
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'scoremax_is_subscriber',
    'scoremax_has_premium_access',
    'scoremax_sync_is_subscriber'
  )
ORDER BY proname;

SELECT
  source,
  status,
  COUNT(*) AS row_count
FROM public.user_subscriptions
GROUP BY source, status
ORDER BY source, status;
