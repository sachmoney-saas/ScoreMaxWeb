-- =========================================================================================
-- SCOREMAX SUPABASE PREFLIGHT (READ-ONLY)
-- =========================================================================================
-- Purpose:
--   Inspect an existing Supabase project before applying ScoreMax compatibility patches.
-- Safety:
--   This script is read-only. It does not create, alter, or drop anything.

-- 1) Core table existence
SELECT to_regclass('public.profiles') AS profiles_table;

-- 2) Identity column compatibility (id vs user_id)
SELECT
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'id'
    ) THEN 'id'
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'user_id'
    ) THEN 'user_id'
    ELSE 'missing'
  END AS identity_column_used;

-- 3) Required columns for current ScoreMax runtime
WITH required_columns(column_name) AS (
  VALUES
    ('id'),
    ('user_id'),
    ('email'),
    ('full_name'),
    ('avatar_url'),
    ('role'),
    ('is_subscriber'),
    ('has_accepted_terms'),
    ('has_completed_onboarding'),
    ('stripe_customer_id'),
    ('stripe_subscription_id'),
    ('subscription_status'),
    ('last_active_at'),
    ('created_at'),
    ('updated_at')
)
SELECT
  required_columns.column_name,
  c.data_type,
  c.is_nullable,
  c.column_default,
  CASE WHEN c.column_name IS NULL THEN 'missing' ELSE 'present' END AS status
FROM required_columns
LEFT JOIN information_schema.columns c
  ON c.table_schema = 'public'
 AND c.table_name = 'profiles'
 AND c.column_name = required_columns.column_name
ORDER BY required_columns.column_name;

-- 4) Existing check constraints on public.profiles
SELECT
  conname AS constraint_name,
  pg_get_constraintdef(c.oid) AS definition
FROM pg_constraint c
JOIN pg_class t ON t.oid = c.conrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
WHERE n.nspname = 'public'
  AND t.relname = 'profiles'
  AND c.contype = 'c'
ORDER BY conname;

-- 5) RLS status + policies on public.profiles
SELECT
  n.nspname AS schema_name,
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'profiles';

SELECT
  policyname,
  cmd,
  roles,
  permissive,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'profiles'
ORDER BY policyname;

-- 6) Trigger inventory on auth.users (profile provisioning flows)
SELECT
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'auth'
  AND event_object_table = 'users'
ORDER BY trigger_name, event_manipulation;

-- 7) Related helper functions that may be present
SELECT
  n.nspname AS schema_name,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'handle_new_user',
    'scoremax_handle_new_user',
    'scoremax_is_admin',
    'ensure_onboarding_scan_session',
    'scoremax_refresh_scan_session_progress',
    'scoremax_refresh_scan_session_progress_trigger',
    'get_onboarding_scan_status'
  )
ORDER BY p.proname;

-- 8) Scan + analysis domain objects for onboarding asset polling and history
WITH required_tables(table_name) AS (
  VALUES
    ('scan_asset_types'),
    ('scan_sessions'),
    ('scan_assets'),
    ('analysis_jobs'),
    ('analysis_job_assets'),
    ('analysis_results')
)
SELECT
  required_tables.table_name,
  CASE WHEN c.table_name IS NULL THEN 'missing' ELSE 'present' END AS status
FROM required_tables
LEFT JOIN information_schema.tables c
  ON c.table_schema = 'public'
 AND c.table_name = required_tables.table_name
ORDER BY required_tables.table_name;

WITH expected_scan_asset_types(code, label_fr, sort_order) AS (
  VALUES
    ('FACE_FRONT', 'Visage de face', 1),
    ('PROFILE_LEFT', 'Profil gauche', 2),
    ('PROFILE_RIGHT', 'Profil droit', 3),
    ('LOOK_UP', 'Regarder en haut', 4),
    ('LOOK_DOWN', 'Regarder en bas', 5),
    ('SMILE', 'Sourire', 6),
    ('HAIR_BACK', 'Cheveux en arrière', 7),
    ('EYE_CLOSEUP', 'Gros plan œil', 8)
)
SELECT
  expected_scan_asset_types.code,
  expected_scan_asset_types.label_fr,
  expected_scan_asset_types.sort_order,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'scan_asset_types'
    ) THEN 'verify_after_patch'
    ELSE 'table_missing'
  END AS status
FROM expected_scan_asset_types
ORDER BY expected_scan_asset_types.sort_order;

SELECT
  policyname,
  cmd,
  roles,
  permissive
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('scan_sessions', 'scan_assets', 'analysis_jobs', 'analysis_job_assets', 'analysis_results')
  AND policyname LIKE 'scoremax_%'
ORDER BY tablename, policyname;

-- 9) Legacy scan compatibility diagnostics
SELECT to_regclass('public.scans') AS scans_table;

WITH expected_scan_assets_columns(column_name) AS (
  VALUES
    ('scan_id'),
    ('asset_type'),
    ('bucket'),
    ('object_path'),
    ('session_id'),
    ('asset_type_code'),
    ('r2_bucket'),
    ('r2_key'),
    ('upload_status')
)
SELECT
  expected_scan_assets_columns.column_name,
  CASE WHEN c.column_name IS NULL THEN 'missing' ELSE 'present' END AS status
FROM expected_scan_assets_columns
LEFT JOIN information_schema.columns c
  ON c.table_schema = 'public'
 AND c.table_name = 'scan_assets'
 AND c.column_name = expected_scan_assets_columns.column_name
ORDER BY expected_scan_assets_columns.column_name;

SELECT
  sa.asset_type,
  COUNT(*) AS asset_count
FROM public.scan_assets sa
GROUP BY sa.asset_type
ORDER BY asset_count DESC, sa.asset_type;

SELECT
  s.status,
  COUNT(*) AS scan_count
FROM public.scans s
GROUP BY s.status
ORDER BY scan_count DESC, s.status;