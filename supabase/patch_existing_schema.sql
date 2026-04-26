-- =========================================================================================
-- SCOREMAX SUPABASE PATCH (ADDITIVE-ONLY)
-- =========================================================================================
-- Purpose:
--   Align ScoreMax app requirements with an existing Supabase project.
-- Safety:
--   - No DROP statements
--   - No CREATE OR REPLACE statements
--   - Only additive/idempotent changes

-- 1) Ensure the core table exists (for fresh projects)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  role TEXT DEFAULT 'user' NOT NULL,
  is_subscriber BOOLEAN DEFAULT FALSE NOT NULL,
  has_accepted_terms BOOLEAN DEFAULT FALSE NOT NULL,
  has_completed_onboarding BOOLEAN DEFAULT FALSE NOT NULL,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  subscription_status TEXT,
  last_active_at TIMESTAMP WITH TIME ZONE,
  full_name TEXT,
  avatar_url TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  CONSTRAINT scoremax_profiles_role_check CHECK (role IN ('user', 'admin'))
);

CREATE TABLE IF NOT EXISTS public.oneshot_api_keys (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  scopes TEXT[] NOT NULL,
  revoked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  last_used_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT scoremax_oneshot_api_keys_name_check CHECK (char_length(trim(name)) > 0),
  CONSTRAINT scoremax_oneshot_api_keys_scopes_check CHECK (cardinality(scopes) > 0)
);

-- 2) Add missing columns required by current runtime (additive only)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'email'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN email TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'full_name'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN full_name TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'avatar_url'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN avatar_url TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'role'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN role TEXT DEFAULT 'user' NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'is_subscriber'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN is_subscriber BOOLEAN DEFAULT FALSE NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'has_accepted_terms'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN has_accepted_terms BOOLEAN DEFAULT FALSE NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'has_completed_onboarding'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN has_completed_onboarding BOOLEAN DEFAULT FALSE NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'stripe_customer_id'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN stripe_customer_id TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'stripe_subscription_id'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN stripe_subscription_id TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'subscription_status'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN subscription_status TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'last_active_at'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN last_active_at TIMESTAMP WITH TIME ZONE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL;
  END IF;

  -- Compatibility mode for schemas using user_id instead of id.
  -- If user_id exists and id is absent, add id as generated alias for app compatibility.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'user_id'
  )
  AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'id'
  ) THEN
    ALTER TABLE public.profiles
      ADD COLUMN id UUID GENERATED ALWAYS AS (user_id) STORED;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS scoremax_profiles_id_idx ON public.profiles (id);
CREATE UNIQUE INDEX IF NOT EXISTS scoremax_oneshot_api_keys_prefix_idx ON public.oneshot_api_keys (key_prefix);
CREATE INDEX IF NOT EXISTS scoremax_oneshot_api_keys_created_idx ON public.oneshot_api_keys (created_at DESC);

-- 3) Ensure RLS is active (idempotent)
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;

-- 4) Helper function used by admin policies (create only if absent)
DO $$
DECLARE
  identity_col TEXT;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'user_id'
  ) THEN
    identity_col := 'user_id';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'id'
  ) THEN
    identity_col := 'id';
  ELSE
    RAISE EXCEPTION 'public.profiles must contain id or user_id';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'scoremax_is_admin'
      AND pg_get_function_identity_arguments(p.oid) = 'candidate uuid'
  ) THEN
    EXECUTE format(
      $sql$
      CREATE FUNCTION public.scoremax_is_admin(candidate uuid)
      RETURNS BOOLEAN
      LANGUAGE sql
      SECURITY DEFINER
      STABLE
      SET search_path = public
      AS $body$
        SELECT EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.%1$I = candidate
            AND p.role = 'admin'
        );
      $body$;
      $sql$,
      identity_col
    );
  END IF;
END $$;

GRANT EXECUTE ON FUNCTION public.scoremax_is_admin(UUID) TO authenticated;

-- 5) Add RLS policies only when missing
DO $$
DECLARE
  identity_col TEXT;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'user_id'
  ) THEN
    identity_col := 'user_id';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'id'
  ) THEN
    identity_col := 'id';
  ELSE
    RAISE EXCEPTION 'public.profiles must contain id or user_id';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'scoremax_select_own_profile'
  ) THEN
    EXECUTE format(
      'CREATE POLICY "scoremax_select_own_profile" ON public.profiles FOR SELECT USING (auth.uid() = %I)',
      identity_col
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'scoremax_insert_own_profile'
  ) THEN
    EXECUTE format(
      'CREATE POLICY "scoremax_insert_own_profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = %I)',
      identity_col
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'scoremax_update_own_profile'
  ) THEN
    EXECUTE format(
      'CREATE POLICY "scoremax_update_own_profile" ON public.profiles FOR UPDATE USING (auth.uid() = %1$I) WITH CHECK (auth.uid() = %1$I)',
      identity_col
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'scoremax_select_admin_profiles'
  ) THEN
    EXECUTE 'CREATE POLICY "scoremax_select_admin_profiles" ON public.profiles FOR SELECT USING (public.scoremax_is_admin(auth.uid()))';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'scoremax_update_admin_profiles'
  ) THEN
    EXECUTE ''
      || 'CREATE POLICY "scoremax_update_admin_profiles" ON public.profiles FOR UPDATE '
      || 'USING (public.scoremax_is_admin(auth.uid())) '
      || 'WITH CHECK (public.scoremax_is_admin(auth.uid()))';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'scoremax_delete_admin_profiles'
  ) THEN
    EXECUTE 'CREATE POLICY "scoremax_delete_admin_profiles" ON public.profiles FOR DELETE USING (public.scoremax_is_admin(auth.uid()))';
  END IF;
END $$;

-- 6) Profile provisioning fallback for new auth users (without replacing existing objects)
DO $$
DECLARE
  identity_col TEXT;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'user_id'
  ) THEN
    identity_col := 'user_id';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'id'
  ) THEN
    identity_col := 'id';
  ELSE
    RAISE EXCEPTION 'public.profiles must contain id or user_id';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'scoremax_handle_new_user'
      AND pg_get_function_identity_arguments(p.oid) = ''
  ) THEN
    EXECUTE format(
      $sql$
      CREATE FUNCTION public.scoremax_handle_new_user()
      RETURNS TRIGGER
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      AS $body$
      DECLARE
        extracted_name TEXT;
        extracted_avatar TEXT;
        accepted_terms BOOLEAN;
      BEGIN
        extracted_name := COALESCE(
          NEW.raw_user_meta_data->>'full_name',
          NEW.raw_user_meta_data->>'name',
          split_part(NEW.email, '@', 1)
        );

        extracted_avatar := COALESCE(
          NEW.raw_user_meta_data->>'avatar_url',
          NEW.raw_user_meta_data->>'picture'
        );

        accepted_terms := CASE
          WHEN lower(COALESCE(NEW.raw_user_meta_data->>'has_accepted_terms', '')) IN ('true', 't', '1', 'yes') THEN TRUE
          ELSE FALSE
        END;

        INSERT INTO public.profiles (
          %1$I,
          email,
          full_name,
          avatar_url,
          role,
          has_accepted_terms,
          updated_at,
          created_at
        )
        VALUES (
          NEW.id,
          NEW.email,
          extracted_name,
          extracted_avatar,
          'user',
          accepted_terms,
          NOW(),
          NOW()
        )
        ON CONFLICT (%1$I) DO UPDATE
          SET email = EXCLUDED.email,
              full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.profiles.full_name),
              avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
              updated_at = NOW();

        RETURN NEW;
      END;
      $body$;
      $sql$,
      identity_col
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.triggers
    WHERE event_object_schema = 'auth'
      AND event_object_table = 'users'
      AND event_manipulation = 'INSERT'
  ) THEN
    EXECUTE '
      CREATE TRIGGER scoremax_on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.scoremax_handle_new_user()
    ';
  END IF;
END $$;

-- 7) Post-check summary output
SELECT
  policyname,
  cmd,
  permissive
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'profiles'
  AND policyname LIKE 'scoremax_%'
ORDER BY policyname;

SELECT
  trigger_name,
  event_manipulation,
  action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'auth'
  AND event_object_table = 'users'
  AND trigger_name = 'scoremax_on_auth_user_created';