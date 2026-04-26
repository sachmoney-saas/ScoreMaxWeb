-- =========================================================================================
-- SCOREMAX SUPABASE POST-CHECK
-- =========================================================================================
-- Purpose:
--   Verify additive compatibility objects are in place after patch execution.

-- 1) Profiles table and identity column mode
SELECT to_regclass('public.profiles') AS profiles_table;

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

-- 2) Required columns
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
  CASE WHEN c.column_name IS NULL THEN 'missing' ELSE 'present' END AS status
FROM required_columns
LEFT JOIN information_schema.columns c
  ON c.table_schema = 'public'
 AND c.table_name = 'profiles'
 AND c.column_name = required_columns.column_name
ORDER BY required_columns.column_name;

-- 3) RLS and ScoreMax policies
SELECT
  c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'profiles';

SELECT
  policyname,
  cmd,
  roles,
  permissive
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'profiles'
  AND policyname LIKE 'scoremax_%'
ORDER BY policyname;

-- 4) ScoreMax helper functions and triggers
SELECT
  n.nspname AS schema_name,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'scoremax_is_admin',
    'scoremax_handle_new_user',
    'ensure_onboarding_scan_session',
    'scoremax_refresh_scan_session_progress',
    'scoremax_refresh_scan_session_progress_trigger',
    'get_onboarding_scan_status'
  )
ORDER BY p.proname;

SELECT
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'auth'
  AND event_object_table = 'users'
  AND trigger_name = 'scoremax_on_auth_user_created';

SELECT
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table = 'scan_assets'
  AND trigger_name = 'scoremax_on_scan_asset_change';

-- 5) Scan + analysis domain verification
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
  CASE WHEN sat.code IS NULL THEN 'missing' ELSE 'present' END AS status,
  sat.is_required_onboarding,
  sat.is_active
FROM expected_scan_asset_types
LEFT JOIN public.scan_asset_types sat
  ON sat.code = expected_scan_asset_types.code
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

-- 6) Strict v2 scan_assets verification
WITH expected_scan_assets_columns(column_name) AS (
  VALUES
    ('id'),
    ('session_id'),
    ('user_id'),
    ('asset_type_code'),
    ('r2_bucket'),
    ('r2_key'),
    ('mime_type'),
    ('byte_size'),
    ('checksum_sha256'),
    ('upload_status'),
    ('captured_at'),
    ('created_at'),
    ('updated_at')
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

WITH forbidden_scan_assets_columns(column_name) AS (
  VALUES
    ('scan_id'),
    ('asset_type'),
    ('bucket'),
    ('object_path')
)
SELECT
  forbidden_scan_assets_columns.column_name,
  CASE WHEN c.column_name IS NULL THEN 'absent_ok' ELSE 'still_present' END AS status
FROM forbidden_scan_assets_columns
LEFT JOIN information_schema.columns c
  ON c.table_schema = 'public'
 AND c.table_name = 'scan_assets'
 AND c.column_name = forbidden_scan_assets_columns.column_name
ORDER BY forbidden_scan_assets_columns.column_name;

SELECT
  COUNT(*) AS total_scan_assets,
  COUNT(*) FILTER (WHERE session_id IS NULL) AS missing_session_id,
  COUNT(*) FILTER (WHERE asset_type_code IS NULL) AS missing_asset_type_code,
  COUNT(*) FILTER (WHERE r2_key IS NULL OR length(btrim(r2_key)) = 0) AS missing_r2_key,
  COUNT(*) FILTER (WHERE mime_type NOT IN ('image/jpeg', 'image/png')) AS invalid_mime_type,
  COUNT(*) FILTER (WHERE upload_status NOT IN ('pending', 'uploaded', 'validated', 'failed')) AS invalid_upload_status
FROM public.scan_assets;

SELECT
  asset_type_code,
  COUNT(*) AS asset_count
FROM public.scan_assets
GROUP BY asset_type_code
ORDER BY asset_count DESC, asset_type_code;

SELECT
  ss.status,
  COUNT(*) AS session_count
FROM public.scan_sessions ss
GROUP BY ss.status
ORDER BY session_count DESC, ss.status;

-- 7) Onboarding polling function smoke check (authenticated context required)
-- Expected shape: session_id, required_asset_count, completed_asset_count, is_ready, missing_asset_types
SELECT
  n.nspname AS schema_name,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS args,
  pg_get_function_result(p.oid) AS return_type
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'get_onboarding_scan_status';