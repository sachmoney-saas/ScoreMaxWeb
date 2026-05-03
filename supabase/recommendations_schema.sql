-- ============================================================================
-- ScoreMax — Recommendations schema
--
-- Two tables:
--   1. scoremax_recommendations         — editorial content (one row per rec)
--   2. scoremax_recommendation_actions  — per-user engagement (saved/done/...)
--
-- Matching logic lives client-side: the client downloads all enabled recs for
-- a given worker and filters them against the user aggregates using the
-- conditions JSONB (see client/src/lib/recommendations/matching.ts).
--
-- Idempotent: safe to re-run. Uses DO blocks to add policies only if missing.
-- ============================================================================

-- 1) Editorial content table -------------------------------------------------

CREATE TABLE IF NOT EXISTS public.scoremax_recommendations (
  id              TEXT PRIMARY KEY,                            -- 'eyes.cold_therapy'
  worker          TEXT NOT NULL,                               -- 'eyes', 'jaw', ...
  type            TEXT NOT NULL,                               -- 'soft' | 'hard'
  category        TEXT NOT NULL,                               -- habit/exercise/topical/nutrition/device/injectable/energy/surgery/device_clinical/cosmetic
  priority        INT  NOT NULL DEFAULT 50,                    -- 0..100, used as base for relevance ranking

  title_en        TEXT NOT NULL,
  title_fr        TEXT NOT NULL,
  summary_en      TEXT NOT NULL,
  summary_fr      TEXT NOT NULL,
  steps           JSONB NOT NULL DEFAULT '[]'::jsonb,          -- [{ en, fr }]

  duration_value  INT,
  duration_unit   TEXT,                                        -- 'days'|'weeks'|'months'|'session'|'permanent'
  cost_min        INT,
  cost_max        INT,
  cost_currency   TEXT DEFAULT 'EUR',
  risk            TEXT NOT NULL DEFAULT 'low',                 -- 'none'|'low'|'medium'|'high'
  evidence        TEXT NOT NULL DEFAULT 'community',           -- 'community'|'studies'|'medical'

  targets         TEXT[] NOT NULL DEFAULT ARRAY[]::text[],     -- aggregate keys this rec helps
  conditions      JSONB  NOT NULL DEFAULT '{"all":true}'::jsonb, -- matching DSL
  source_url      TEXT,                                        -- optional reference

  enabled         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT scoremax_recommendations_type_check
    CHECK (type IN ('soft', 'hard')),
  CONSTRAINT scoremax_recommendations_risk_check
    CHECK (risk IN ('none', 'low', 'medium', 'high')),
  CONSTRAINT scoremax_recommendations_evidence_check
    CHECK (evidence IN ('community', 'studies', 'medical')),
  CONSTRAINT scoremax_recommendations_priority_range
    CHECK (priority BETWEEN 0 AND 100),
  CONSTRAINT scoremax_recommendations_category_check
    CHECK (category IN (
      'habit', 'exercise', 'topical', 'nutrition', 'device',
      'injectable', 'energy', 'surgery', 'device_clinical', 'cosmetic'
    ))
);

CREATE INDEX IF NOT EXISTS scoremax_recommendations_worker_idx
  ON public.scoremax_recommendations (worker, type, priority DESC)
  WHERE enabled = TRUE;

-- 2) Per-user engagement table -----------------------------------------------

CREATE TABLE IF NOT EXISTS public.scoremax_recommendation_actions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recommendation_id  TEXT NOT NULL REFERENCES public.scoremax_recommendations(id) ON DELETE CASCADE,
  worker             TEXT NOT NULL,                            -- denormalised for fast filtering
  status             TEXT NOT NULL,                            -- 'saved'|'dismissed'|'in_progress'|'done'
  notes              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT scoremax_recommendation_actions_status_check
    CHECK (status IN ('saved', 'dismissed', 'in_progress', 'done')),
  CONSTRAINT scoremax_recommendation_actions_user_rec_uniq
    UNIQUE (user_id, recommendation_id)
);

CREATE INDEX IF NOT EXISTS scoremax_recommendation_actions_user_idx
  ON public.scoremax_recommendation_actions (user_id, worker, updated_at DESC);

-- 3) updated_at triggers (reuse helper if present, otherwise inline) ---------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'scoremax_set_updated_at'
  ) THEN
    EXECUTE $f$
      CREATE FUNCTION public.scoremax_set_updated_at()
      RETURNS TRIGGER
      LANGUAGE plpgsql
      AS $body$
      BEGIN
        NEW.updated_at := NOW();
        RETURN NEW;
      END;
      $body$;
    $f$;
  END IF;
END
$$;

DROP TRIGGER IF EXISTS scoremax_recommendations_set_updated_at
  ON public.scoremax_recommendations;
CREATE TRIGGER scoremax_recommendations_set_updated_at
  BEFORE UPDATE ON public.scoremax_recommendations
  FOR EACH ROW EXECUTE FUNCTION public.scoremax_set_updated_at();

DROP TRIGGER IF EXISTS scoremax_recommendation_actions_set_updated_at
  ON public.scoremax_recommendation_actions;
CREATE TRIGGER scoremax_recommendation_actions_set_updated_at
  BEFORE UPDATE ON public.scoremax_recommendation_actions
  FOR EACH ROW EXECUTE FUNCTION public.scoremax_set_updated_at();

-- 4) RLS ---------------------------------------------------------------------

ALTER TABLE IF EXISTS public.scoremax_recommendations
  ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.scoremax_recommendation_actions
  ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Recommendations: anyone authenticated can read enabled rows.
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'scoremax_recommendations'
      AND policyname = 'scoremax_recommendations_select_enabled'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "scoremax_recommendations_select_enabled"
        ON public.scoremax_recommendations
        FOR SELECT
        USING (enabled = TRUE)
    $p$;
  END IF;

  -- Admin-only management of editorial content (only if helper exists).
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'scoremax_is_admin'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'scoremax_recommendations'
        AND policyname = 'scoremax_recommendations_admin_manage'
    ) THEN
      EXECUTE $p$
        CREATE POLICY "scoremax_recommendations_admin_manage"
          ON public.scoremax_recommendations
          FOR ALL
          USING (public.scoremax_is_admin(auth.uid()))
          WITH CHECK (public.scoremax_is_admin(auth.uid()))
      $p$;
    END IF;
  END IF;

  -- User actions: users only see and manage their own.
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'scoremax_recommendation_actions'
      AND policyname = 'scoremax_recommendation_actions_select_own'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "scoremax_recommendation_actions_select_own"
        ON public.scoremax_recommendation_actions
        FOR SELECT
        USING (auth.uid() = user_id)
    $p$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'scoremax_recommendation_actions'
      AND policyname = 'scoremax_recommendation_actions_insert_own'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "scoremax_recommendation_actions_insert_own"
        ON public.scoremax_recommendation_actions
        FOR INSERT
        WITH CHECK (auth.uid() = user_id)
    $p$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'scoremax_recommendation_actions'
      AND policyname = 'scoremax_recommendation_actions_update_own'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "scoremax_recommendation_actions_update_own"
        ON public.scoremax_recommendation_actions
        FOR UPDATE
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id)
    $p$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'scoremax_recommendation_actions'
      AND policyname = 'scoremax_recommendation_actions_delete_own'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "scoremax_recommendation_actions_delete_own"
        ON public.scoremax_recommendation_actions
        FOR DELETE
        USING (auth.uid() = user_id)
    $p$;
  END IF;
END
$$;
