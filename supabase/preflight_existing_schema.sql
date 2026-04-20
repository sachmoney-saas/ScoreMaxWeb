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
  AND p.proname IN ('handle_new_user', 'scoremax_handle_new_user', 'scoremax_is_admin')
ORDER BY p.proname;