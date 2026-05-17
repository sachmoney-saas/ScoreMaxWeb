-- ===========================================================================
-- Consolidation RLS + perf : élimine les `multiple_permissive_policies` et
-- les `auth_rls_initplan` signalés par l'advisor Supabase, et drop l'index
-- doublon sur scan_assets.
--
-- Principes appliqués :
--   1. Une seule policy permissive par couple (table, command, role) ;
--      les versions "_own" et "_admin" sont fusionnées en
--      "_self_or_admin" avec un OR explicite.
--   2. Toutes les policies sont scopées `TO authenticated` (anon ne peut
--      jamais satisfaire `user_id = auth.uid()` mais on l'exclut quand
--      même pour aider le planner et clarifier l'intention).
--   3. `auth.uid()` est wrappé en `(select auth.uid())` → évalué une seule
--      fois par requête au lieu d'une fois par ligne (initplan).
--   4. Les policies INSERT/UPDATE restent les variantes STRICTES quand il
--      en existait deux concurrentes (la version permissive simple
--      `auth.uid() = user_id` est supprimée au profit de celle qui vérifie
--      aussi l'existence de la session / l'asset_type actif).
-- ===========================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS profiles_insert_own              ON public.profiles;
DROP POLICY IF EXISTS scoremax_insert_own_profile     ON public.profiles;
DROP POLICY IF EXISTS profiles_select_own              ON public.profiles;
DROP POLICY IF EXISTS scoremax_select_own_profile     ON public.profiles;
DROP POLICY IF EXISTS scoremax_select_admin_profiles  ON public.profiles;
DROP POLICY IF EXISTS profiles_update_own              ON public.profiles;
DROP POLICY IF EXISTS scoremax_update_own_profile     ON public.profiles;
DROP POLICY IF EXISTS scoremax_update_admin_profiles  ON public.profiles;
DROP POLICY IF EXISTS profiles_delete_own              ON public.profiles;
DROP POLICY IF EXISTS scoremax_delete_admin_profiles  ON public.profiles;

CREATE POLICY scoremax_profiles_insert_self ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY scoremax_profiles_select_self_or_admin ON public.profiles
  FOR SELECT TO authenticated
  USING (
    user_id = (select auth.uid())
    OR public.scoremax_is_admin((select auth.uid()))
  );

CREATE POLICY scoremax_profiles_update_self_or_admin ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    user_id = (select auth.uid())
    OR public.scoremax_is_admin((select auth.uid()))
  )
  WITH CHECK (
    user_id = (select auth.uid())
    OR public.scoremax_is_admin((select auth.uid()))
  );

CREATE POLICY scoremax_profiles_delete_self_or_admin ON public.profiles
  FOR DELETE TO authenticated
  USING (
    user_id = (select auth.uid())
    OR public.scoremax_is_admin((select auth.uid()))
  );

-- ---------------------------------------------------------------------------
-- analysis_job_assets
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS scoremax_analysis_job_assets_select_admin ON public.analysis_job_assets;
DROP POLICY IF EXISTS scoremax_analysis_job_assets_select_own   ON public.analysis_job_assets;
DROP POLICY IF EXISTS scoremax_analysis_job_assets_insert_own   ON public.analysis_job_assets;

CREATE POLICY scoremax_analysis_job_assets_select_self_or_admin ON public.analysis_job_assets
  FOR SELECT TO authenticated
  USING (
    user_id = (select auth.uid())
    OR public.scoremax_is_admin((select auth.uid()))
  );

CREATE POLICY scoremax_analysis_job_assets_insert_self ON public.analysis_job_assets
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.analysis_jobs aj
      WHERE aj.id = analysis_job_assets.analysis_job_id
        AND aj.user_id = (select auth.uid())
    )
    AND EXISTS (
      SELECT 1 FROM public.scan_assets sa
      WHERE sa.id = analysis_job_assets.scan_asset_id
        AND sa.user_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- analysis_jobs
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS scoremax_analysis_jobs_select_admin ON public.analysis_jobs;
DROP POLICY IF EXISTS scoremax_analysis_jobs_select_own   ON public.analysis_jobs;
DROP POLICY IF EXISTS scoremax_analysis_jobs_insert_own   ON public.analysis_jobs;
DROP POLICY IF EXISTS scoremax_analysis_jobs_update_own   ON public.analysis_jobs;

CREATE POLICY scoremax_analysis_jobs_select_self_or_admin ON public.analysis_jobs
  FOR SELECT TO authenticated
  USING (
    user_id = (select auth.uid())
    OR public.scoremax_is_admin((select auth.uid()))
  );

CREATE POLICY scoremax_analysis_jobs_insert_self ON public.analysis_jobs
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.scan_sessions ss
      WHERE ss.id = analysis_jobs.session_id
        AND ss.user_id = (select auth.uid())
    )
  );

CREATE POLICY scoremax_analysis_jobs_update_self ON public.analysis_jobs
  FOR UPDATE TO authenticated
  USING (
    user_id = (select auth.uid())
    AND status = ANY (ARRAY['queued'::text, 'running'::text])
  )
  WITH CHECK (
    user_id = (select auth.uid())
    AND trigger_source = ANY (ARRAY['onboarding_auto'::text, 'user_rerun'::text, 'admin'::text])
    AND status = ANY (ARRAY['queued'::text, 'running'::text, 'completed'::text, 'failed'::text])
    AND version > 0
  );

-- ---------------------------------------------------------------------------
-- analysis_results
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS scoremax_analysis_results_select_admin ON public.analysis_results;
DROP POLICY IF EXISTS scoremax_analysis_results_select_own   ON public.analysis_results;
DROP POLICY IF EXISTS scoremax_analysis_results_insert_own   ON public.analysis_results;

CREATE POLICY scoremax_analysis_results_select_self_or_admin ON public.analysis_results
  FOR SELECT TO authenticated
  USING (
    user_id = (select auth.uid())
    OR public.scoremax_is_admin((select auth.uid()))
  );

CREATE POLICY scoremax_analysis_results_insert_self ON public.analysis_results
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.analysis_jobs aj
      WHERE aj.id = analysis_results.analysis_job_id
        AND aj.user_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- onboarding_responses (auth.uid() unwrapped → wrap)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS onboarding_responses_insert_own ON public.onboarding_responses;
DROP POLICY IF EXISTS onboarding_responses_select_own ON public.onboarding_responses;
DROP POLICY IF EXISTS onboarding_responses_update_own ON public.onboarding_responses;
DROP POLICY IF EXISTS onboarding_responses_delete_own ON public.onboarding_responses;

CREATE POLICY scoremax_onboarding_responses_insert_self ON public.onboarding_responses
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY scoremax_onboarding_responses_select_self ON public.onboarding_responses
  FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY scoremax_onboarding_responses_update_self ON public.onboarding_responses
  FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY scoremax_onboarding_responses_delete_self ON public.onboarding_responses
  FOR DELETE TO authenticated
  USING (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- onboarding_mesh_replays
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can insert own onboarding mesh replays" ON public.onboarding_mesh_replays;
DROP POLICY IF EXISTS "Users can read own onboarding mesh replays"   ON public.onboarding_mesh_replays;
DROP POLICY IF EXISTS "Users can update own onboarding mesh replays" ON public.onboarding_mesh_replays;

CREATE POLICY scoremax_onboarding_mesh_replays_insert_self ON public.onboarding_mesh_replays
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.scan_sessions ss
      WHERE ss.id = onboarding_mesh_replays.session_id
        AND ss.user_id = (select auth.uid())
    )
  );

CREATE POLICY scoremax_onboarding_mesh_replays_select_self ON public.onboarding_mesh_replays
  FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY scoremax_onboarding_mesh_replays_update_self ON public.onboarding_mesh_replays
  FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (
    user_id = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.scan_sessions ss
      WHERE ss.id = onboarding_mesh_replays.session_id
        AND ss.user_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- scan_asset_types (lecture publique des actifs + manage admin)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS scoremax_scan_asset_types_admin_manage ON public.scan_asset_types;

CREATE POLICY scoremax_scan_asset_types_admin_manage ON public.scan_asset_types
  FOR ALL TO authenticated
  USING (public.scoremax_is_admin((select auth.uid())))
  WITH CHECK (public.scoremax_is_admin((select auth.uid())));

-- (la policy `scoremax_scan_asset_types_select_all` ne contient pas
--  d'`auth.<func>()`, on la laisse inchangée.)

-- ---------------------------------------------------------------------------
-- scan_assets
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS scan_assets_insert_own            ON public.scan_assets;
DROP POLICY IF EXISTS scoremax_scan_assets_insert_own  ON public.scan_assets;
DROP POLICY IF EXISTS scan_assets_select_own            ON public.scan_assets;
DROP POLICY IF EXISTS scoremax_scan_assets_select_own  ON public.scan_assets;
DROP POLICY IF EXISTS scoremax_scan_assets_select_admin ON public.scan_assets;
DROP POLICY IF EXISTS scan_assets_update_own            ON public.scan_assets;
DROP POLICY IF EXISTS scoremax_scan_assets_update_own  ON public.scan_assets;
DROP POLICY IF EXISTS scan_assets_delete_own            ON public.scan_assets;

CREATE POLICY scoremax_scan_assets_select_self_or_admin ON public.scan_assets
  FOR SELECT TO authenticated
  USING (
    user_id = (select auth.uid())
    OR public.scoremax_is_admin((select auth.uid()))
  );

CREATE POLICY scoremax_scan_assets_insert_self ON public.scan_assets
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (select auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.scan_sessions ss
      WHERE ss.id = scan_assets.session_id
        AND ss.user_id = (select auth.uid())
    )
    AND EXISTS (
      SELECT 1 FROM public.scan_asset_types sat
      WHERE sat.code = scan_assets.asset_type_code
        AND sat.is_active = true
    )
  );

CREATE POLICY scoremax_scan_assets_update_self ON public.scan_assets
  FOR UPDATE TO authenticated
  USING (
    user_id = (select auth.uid())
    AND upload_status = ANY (ARRAY['pending'::text, 'uploaded'::text])
  )
  WITH CHECK (
    user_id = (select auth.uid())
    AND upload_status = ANY (ARRAY['pending'::text, 'uploaded'::text])
    AND mime_type = ANY (ARRAY['image/jpeg'::text, 'image/png'::text])
    AND length(btrim(r2_key)) > 0
    AND EXISTS (
      SELECT 1 FROM public.scan_sessions ss
      WHERE ss.id = scan_assets.session_id
        AND ss.user_id = (select auth.uid())
    )
    AND EXISTS (
      SELECT 1 FROM public.scan_asset_types sat
      WHERE sat.code = scan_assets.asset_type_code
        AND sat.is_active = true
    )
  );

CREATE POLICY scoremax_scan_assets_delete_self ON public.scan_assets
  FOR DELETE TO authenticated
  USING (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- scan_sessions
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS scoremax_scan_sessions_select_admin ON public.scan_sessions;
DROP POLICY IF EXISTS scoremax_scan_sessions_select_own   ON public.scan_sessions;
DROP POLICY IF EXISTS scoremax_scan_sessions_insert_own   ON public.scan_sessions;
DROP POLICY IF EXISTS scoremax_scan_sessions_update_own   ON public.scan_sessions;

CREATE POLICY scoremax_scan_sessions_select_self_or_admin ON public.scan_sessions
  FOR SELECT TO authenticated
  USING (
    user_id = (select auth.uid())
    OR public.scoremax_is_admin((select auth.uid()))
  );

CREATE POLICY scoremax_scan_sessions_insert_self ON public.scan_sessions
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (select auth.uid())
    AND source = ANY (ARRAY['onboarding'::text, 'manual_rescan'::text])
    AND status = 'collecting'::text
    AND completed_asset_count = 0
  );

CREATE POLICY scoremax_scan_sessions_update_self ON public.scan_sessions
  FOR UPDATE TO authenticated
  USING (
    user_id = (select auth.uid())
    AND status = ANY (ARRAY['collecting'::text, 'processing'::text])
  )
  WITH CHECK (
    user_id = (select auth.uid())
    AND source = ANY (ARRAY['onboarding'::text, 'manual_rescan'::text])
    AND status = ANY (ARRAY['collecting'::text, 'processing'::text])
    AND completed_asset_count <= required_asset_count
  );

-- ---------------------------------------------------------------------------
-- scoremax_recommendation_actions (auth.uid() unwrapped → wrap)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS scoremax_recommendation_actions_insert_own ON public.scoremax_recommendation_actions;
DROP POLICY IF EXISTS scoremax_recommendation_actions_select_own ON public.scoremax_recommendation_actions;
DROP POLICY IF EXISTS scoremax_recommendation_actions_update_own ON public.scoremax_recommendation_actions;
DROP POLICY IF EXISTS scoremax_recommendation_actions_delete_own ON public.scoremax_recommendation_actions;

CREATE POLICY scoremax_recommendation_actions_insert_self ON public.scoremax_recommendation_actions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY scoremax_recommendation_actions_select_self ON public.scoremax_recommendation_actions
  FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY scoremax_recommendation_actions_update_self ON public.scoremax_recommendation_actions
  FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY scoremax_recommendation_actions_delete_self ON public.scoremax_recommendation_actions
  FOR DELETE TO authenticated
  USING (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- scoremax_recommendations (admin manage wrappé)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS scoremax_recommendations_admin_manage ON public.scoremax_recommendations;

CREATE POLICY scoremax_recommendations_admin_manage ON public.scoremax_recommendations
  FOR ALL TO authenticated
  USING (public.scoremax_is_admin((select auth.uid())))
  WITH CHECK (public.scoremax_is_admin((select auth.uid())));

-- (la policy `scoremax_recommendations_select_enabled` est intacte.)

-- ---------------------------------------------------------------------------
-- subscription_events (select admin OR own → fusion)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS scoremax_subscription_events_select_admin ON public.subscription_events;
DROP POLICY IF EXISTS scoremax_subscription_events_select_own   ON public.subscription_events;

CREATE POLICY scoremax_subscription_events_select_self_or_admin ON public.subscription_events
  FOR SELECT TO authenticated
  USING (
    user_id = (select auth.uid())
    OR public.scoremax_is_admin((select auth.uid()))
  );

-- ---------------------------------------------------------------------------
-- user_subscriptions (select admin OR own → fusion)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS scoremax_user_subscriptions_select_admin ON public.user_subscriptions;
DROP POLICY IF EXISTS scoremax_user_subscriptions_select_own   ON public.user_subscriptions;

CREATE POLICY scoremax_user_subscriptions_select_self_or_admin ON public.user_subscriptions
  FOR SELECT TO authenticated
  USING (
    user_id = (select auth.uid())
    OR public.scoremax_is_admin((select auth.uid()))
  );

-- ---------------------------------------------------------------------------
-- Index doublon sur scan_assets
-- ---------------------------------------------------------------------------
-- `idx_scan_assets_user_created_at` et `scoremax_scan_assets_user_created_idx`
-- sont strictement identiques (btree user_id, created_at DESC).
-- On garde la variante préfixée `scoremax_` (convention du projet).
DROP INDEX IF EXISTS public.idx_scan_assets_user_created_at;

COMMIT;
