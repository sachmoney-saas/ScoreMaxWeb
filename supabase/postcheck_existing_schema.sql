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

-- 4) ScoreMax helper function and trigger
SELECT
  n.nspname AS schema_name,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('scoremax_is_admin', 'scoremax_handle_new_user')
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