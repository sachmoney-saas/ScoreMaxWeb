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

-- 7) Scan asset taxonomy (8 required onboarding photo types)
CREATE TABLE IF NOT EXISTS public.scan_asset_types (
  code TEXT PRIMARY KEY,
  label_fr TEXT NOT NULL,
  is_required_onboarding BOOLEAN DEFAULT TRUE NOT NULL,
  sort_order INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

INSERT INTO public.scan_asset_types (code, label_fr, is_required_onboarding, sort_order, is_active)
VALUES
  ('FACE_FRONT', 'Visage de face', TRUE, 1, TRUE),
  ('PROFILE_LEFT', 'Profil gauche', TRUE, 2, TRUE),
  ('PROFILE_RIGHT', 'Profil droit', TRUE, 3, TRUE),
  ('LOOK_UP', 'Regarder en haut', TRUE, 4, TRUE),
  ('LOOK_DOWN', 'Regarder en bas', TRUE, 5, TRUE),
  ('SMILE', 'Sourire', TRUE, 6, TRUE),
  ('HAIR_BACK', 'Cheveux en arrière', TRUE, 7, TRUE),
  ('EYE_CLOSEUP', 'Gros plan œil', TRUE, 8, TRUE)
ON CONFLICT (code) DO UPDATE
SET
  label_fr = EXCLUDED.label_fr,
  is_required_onboarding = EXCLUDED.is_required_onboarding,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- 8) Scan sessions and scan assets metadata (Cloudflare R2 metadata only)
CREATE TABLE IF NOT EXISTS public.scan_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source TEXT DEFAULT 'onboarding' NOT NULL,
  status TEXT DEFAULT 'collecting' NOT NULL,
  required_asset_count INTEGER DEFAULT 8 NOT NULL,
  completed_asset_count INTEGER DEFAULT 0 NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  ready_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  CONSTRAINT scoremax_scan_sessions_source_check CHECK (source IN ('onboarding', 'manual_rescan', 'automated')),
  CONSTRAINT scoremax_scan_sessions_status_check CHECK (status IN ('collecting', 'ready', 'processing', 'completed', 'failed', 'abandoned')),
  CONSTRAINT scoremax_scan_sessions_required_positive CHECK (required_asset_count > 0),
  CONSTRAINT scoremax_scan_sessions_completed_non_negative CHECK (completed_asset_count >= 0),
  CONSTRAINT scoremax_scan_sessions_completed_le_required CHECK (completed_asset_count <= required_asset_count)
);

CREATE TABLE IF NOT EXISTS public.scan_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  asset_type_code TEXT,
  r2_bucket TEXT,
  r2_key TEXT,
  mime_type TEXT,
  byte_size BIGINT,
  checksum_sha256 TEXT,
  upload_status TEXT DEFAULT 'pending' NOT NULL,
  captured_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  CONSTRAINT scoremax_scan_assets_status_check CHECK (upload_status IN ('pending', 'uploaded', 'validated', 'failed')),
  CONSTRAINT scoremax_scan_assets_mime_type_check CHECK (mime_type IS NULL OR mime_type IN ('image/jpeg', 'image/png')),
  CONSTRAINT scoremax_scan_assets_r2_key_not_blank CHECK (r2_key IS NULL OR length(btrim(r2_key)) > 0),
  CONSTRAINT scoremax_scan_assets_byte_size_positive CHECK (byte_size IS NULL OR byte_size > 0),
  CONSTRAINT scoremax_scan_assets_checksum_format CHECK (checksum_sha256 IS NULL OR checksum_sha256 ~ '^[0-9a-f]{64}$')
);

DO $$
BEGIN
  BEGIN
    ALTER TABLE public.scan_assets
      ALTER COLUMN r2_key SET NOT NULL;
  EXCEPTION WHEN not_null_violation THEN
    NULL;
  END;

  BEGIN
    ALTER TABLE public.scan_assets
      ALTER COLUMN asset_type_code SET NOT NULL;
  EXCEPTION WHEN not_null_violation THEN
    NULL;
  END;

  BEGIN
    ALTER TABLE public.scan_assets
      ALTER COLUMN session_id SET NOT NULL;
  EXCEPTION WHEN not_null_violation THEN
    NULL;
  END;

  BEGIN
    ALTER TABLE public.scan_assets
      ALTER COLUMN mime_type SET NOT NULL;
  EXCEPTION WHEN not_null_violation THEN
    NULL;
  END;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'scoremax_scan_assets_status_check'
      AND conrelid = 'public.scan_assets'::regclass
  ) THEN
    ALTER TABLE public.scan_assets
      ADD CONSTRAINT scoremax_scan_assets_status_check
      CHECK (upload_status IN ('pending', 'uploaded', 'validated', 'failed'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'scoremax_scan_assets_mime_type_check'
      AND conrelid = 'public.scan_assets'::regclass
  ) THEN
    ALTER TABLE public.scan_assets
      ADD CONSTRAINT scoremax_scan_assets_mime_type_check
      CHECK (mime_type IS NULL OR mime_type IN ('image/jpeg', 'image/png'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'scoremax_scan_assets_r2_key_not_blank'
      AND conrelid = 'public.scan_assets'::regclass
  ) THEN
    ALTER TABLE public.scan_assets
      ADD CONSTRAINT scoremax_scan_assets_r2_key_not_blank
      CHECK (r2_key IS NULL OR length(btrim(r2_key)) > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'scoremax_scan_assets_byte_size_positive'
      AND conrelid = 'public.scan_assets'::regclass
  ) THEN
    ALTER TABLE public.scan_assets
      ADD CONSTRAINT scoremax_scan_assets_byte_size_positive
      CHECK (byte_size IS NULL OR byte_size > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'scoremax_scan_assets_checksum_format'
      AND conrelid = 'public.scan_assets'::regclass
  ) THEN
    ALTER TABLE public.scan_assets
      ADD CONSTRAINT scoremax_scan_assets_checksum_format
      CHECK (checksum_sha256 IS NULL OR checksum_sha256 ~ '^[0-9a-f]{64}$');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'scoremax_scan_assets_session_id_fkey'
      AND conrelid = 'public.scan_assets'::regclass
  ) THEN
    BEGIN
      ALTER TABLE public.scan_assets
        ADD CONSTRAINT scoremax_scan_assets_session_id_fkey
        FOREIGN KEY (session_id) REFERENCES public.scan_sessions(id) ON DELETE CASCADE;
    EXCEPTION WHEN invalid_foreign_key OR datatype_mismatch THEN
      -- Keep compatibility when existing column type differs.
      NULL;
    END;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'scoremax_scan_assets_asset_type_code_fkey'
      AND conrelid = 'public.scan_assets'::regclass
  ) THEN
    BEGIN
      ALTER TABLE public.scan_assets
        ADD CONSTRAINT scoremax_scan_assets_asset_type_code_fkey
        FOREIGN KEY (asset_type_code) REFERENCES public.scan_asset_types(code);
    EXCEPTION WHEN invalid_foreign_key OR datatype_mismatch THEN
      -- Keep compatibility when existing column type differs.
      NULL;
    END;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'scoremax_scan_assets_unique_session_type_key'
      AND conrelid = 'public.scan_assets'::regclass
  ) THEN
    ALTER TABLE public.scan_assets
      ADD CONSTRAINT scoremax_scan_assets_unique_session_type_key
      UNIQUE (session_id, asset_type_code, r2_key);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS scoremax_scan_sessions_user_created_idx
  ON public.scan_sessions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS scoremax_scan_sessions_status_idx
  ON public.scan_sessions (status, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS scoremax_active_onboarding_scan_session_uidx
  ON public.scan_sessions (user_id)
  WHERE source = 'onboarding' AND status IN ('collecting', 'ready', 'processing');

CREATE INDEX IF NOT EXISTS scoremax_scan_assets_user_created_idx
  ON public.scan_assets (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS scoremax_scan_assets_session_type_status_idx
  ON public.scan_assets (session_id, asset_type_code, upload_status);

-- 9) Immutable analysis history (supports future re-analyses)
CREATE TABLE IF NOT EXISTS public.analysis_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.scan_sessions(id) ON DELETE RESTRICT,
  trigger_source TEXT DEFAULT 'onboarding_auto' NOT NULL,
  status TEXT DEFAULT 'queued' NOT NULL,
  request_payload JSONB DEFAULT '{}'::jsonb NOT NULL,
  version INTEGER DEFAULT 1 NOT NULL,
  parent_analysis_job_id UUID REFERENCES public.analysis_jobs(id) ON DELETE SET NULL,
  upstream_job_id TEXT,
  error_code TEXT,
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  failed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  CONSTRAINT scoremax_analysis_jobs_status_check CHECK (status IN ('queued', 'running', 'completed', 'failed')),
  CONSTRAINT scoremax_analysis_jobs_trigger_source_check CHECK (trigger_source IN ('onboarding_auto', 'user_rerun', 'admin')),
  CONSTRAINT scoremax_analysis_jobs_version_positive CHECK (version > 0)
);

CREATE TABLE IF NOT EXISTS public.analysis_job_assets (
  analysis_job_id UUID NOT NULL REFERENCES public.analysis_jobs(id) ON DELETE CASCADE,
  asset_type_code TEXT NOT NULL REFERENCES public.scan_asset_types(code),
  scan_asset_id UUID NOT NULL REFERENCES public.scan_assets(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  PRIMARY KEY (analysis_job_id, asset_type_code)
);

CREATE TABLE IF NOT EXISTS public.analysis_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_job_id UUID NOT NULL REFERENCES public.analysis_jobs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  worker TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  provider TEXT,
  result JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS scoremax_analysis_jobs_user_created_idx
  ON public.analysis_jobs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS scoremax_analysis_jobs_session_created_idx
  ON public.analysis_jobs (session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS scoremax_analysis_jobs_parent_idx
  ON public.analysis_jobs (parent_analysis_job_id);
CREATE UNIQUE INDEX IF NOT EXISTS scoremax_analysis_jobs_session_version_uidx
  ON public.analysis_jobs (session_id, version);
CREATE INDEX IF NOT EXISTS scoremax_analysis_job_assets_user_idx
  ON public.analysis_job_assets (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS scoremax_analysis_results_job_created_idx
  ON public.analysis_results (analysis_job_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS scoremax_analysis_results_job_worker_uidx
  ON public.analysis_results (analysis_job_id, worker);

-- 10) Enable RLS on scan and analysis tables
ALTER TABLE IF EXISTS public.scan_asset_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.scan_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.scan_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.analysis_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.analysis_job_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.analysis_results ENABLE ROW LEVEL SECURITY;

-- 11) Add RLS policies for scan and analysis domain (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'scan_asset_types' AND policyname = 'scoremax_scan_asset_types_select_all'
  ) THEN
    EXECUTE 'CREATE POLICY "scoremax_scan_asset_types_select_all" ON public.scan_asset_types FOR SELECT USING (is_active = TRUE)';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'scoremax_is_admin'
      AND pg_get_function_identity_arguments(p.oid) = 'candidate uuid'
  )
  AND NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'scan_asset_types' AND policyname = 'scoremax_scan_asset_types_admin_manage'
  ) THEN
    EXECUTE '
      CREATE POLICY "scoremax_scan_asset_types_admin_manage" ON public.scan_asset_types
      FOR ALL
      USING (public.scoremax_is_admin(auth.uid()))
      WITH CHECK (public.scoremax_is_admin(auth.uid()))
    ';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'scan_sessions' AND policyname = 'scoremax_scan_sessions_select_own'
  ) THEN
    EXECUTE 'CREATE POLICY "scoremax_scan_sessions_select_own" ON public.scan_sessions FOR SELECT USING (auth.uid() = user_id)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'scan_sessions' AND policyname = 'scoremax_scan_sessions_insert_own'
  ) THEN
    EXECUTE '
      CREATE POLICY "scoremax_scan_sessions_insert_own" ON public.scan_sessions
      FOR INSERT
      WITH CHECK (
        auth.uid() = user_id
        AND source IN (''onboarding'', ''manual_rescan'')
        AND status = ''collecting''
        AND completed_asset_count = 0
      )
    ';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'scan_sessions' AND policyname = 'scoremax_scan_sessions_update_own'
  ) THEN
    EXECUTE '
      CREATE POLICY "scoremax_scan_sessions_update_own" ON public.scan_sessions
      FOR UPDATE
      USING (
        auth.uid() = user_id
        AND status IN (''collecting'', ''processing'')
      )
      WITH CHECK (
        auth.uid() = user_id
        AND source IN (''onboarding'', ''manual_rescan'')
        AND status IN (''collecting'', ''processing'')
        AND completed_asset_count <= required_asset_count
      )
    ';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'scan_sessions' AND policyname = 'scoremax_scan_sessions_select_admin'
  ) THEN
    EXECUTE 'CREATE POLICY "scoremax_scan_sessions_select_admin" ON public.scan_sessions FOR SELECT USING (public.scoremax_is_admin(auth.uid()))';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'scan_assets' AND policyname = 'scoremax_scan_assets_select_own'
  ) THEN
    EXECUTE 'CREATE POLICY "scoremax_scan_assets_select_own" ON public.scan_assets FOR SELECT USING (auth.uid() = user_id)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'scan_assets' AND policyname = 'scoremax_scan_assets_insert_own'
  ) THEN
    EXECUTE '
      CREATE POLICY "scoremax_scan_assets_insert_own" ON public.scan_assets
      FOR INSERT
      WITH CHECK (
        auth.uid() = user_id
        AND EXISTS (
          SELECT 1
          FROM public.scan_sessions ss
          WHERE ss.id = session_id
            AND ss.user_id = auth.uid()
        )
        AND EXISTS (
          SELECT 1
          FROM public.scan_asset_types sat
          WHERE sat.code = asset_type_code
            AND sat.is_active = TRUE
        )
      )
    ';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'scan_assets' AND policyname = 'scoremax_scan_assets_update_own'
  ) THEN
    EXECUTE '
      CREATE POLICY "scoremax_scan_assets_update_own" ON public.scan_assets
      FOR UPDATE
      USING (
        auth.uid() = user_id
        AND upload_status IN (''pending'', ''uploaded'')
      )
      WITH CHECK (
        auth.uid() = user_id
        AND upload_status IN (''pending'', ''uploaded'')
        AND mime_type IN (''image/jpeg'', ''image/png'')
        AND length(btrim(r2_key)) > 0
        AND EXISTS (
          SELECT 1
          FROM public.scan_sessions ss
          WHERE ss.id = session_id
            AND ss.user_id = auth.uid()
        )
        AND EXISTS (
          SELECT 1
          FROM public.scan_asset_types sat
          WHERE sat.code = asset_type_code
            AND sat.is_active = TRUE
        )
      )
    ';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'scan_assets' AND policyname = 'scoremax_scan_assets_select_admin'
  ) THEN
    EXECUTE 'CREATE POLICY "scoremax_scan_assets_select_admin" ON public.scan_assets FOR SELECT USING (public.scoremax_is_admin(auth.uid()))';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'analysis_jobs' AND policyname = 'scoremax_analysis_jobs_select_own'
  ) THEN
    EXECUTE 'CREATE POLICY "scoremax_analysis_jobs_select_own" ON public.analysis_jobs FOR SELECT USING (auth.uid() = user_id)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'analysis_jobs' AND policyname = 'scoremax_analysis_jobs_update_own'
  ) THEN
    EXECUTE '
      CREATE POLICY "scoremax_analysis_jobs_update_own" ON public.analysis_jobs
      FOR UPDATE
      USING (
        auth.uid() = user_id
        AND status IN (''queued'', ''running'')
      )
      WITH CHECK (
        auth.uid() = user_id
        AND trigger_source IN (''onboarding_auto'', ''user_rerun'', ''admin'')
        AND status IN (''queued'', ''running'', ''completed'', ''failed'')
        AND version > 0
      )
    ';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'analysis_jobs' AND policyname = 'scoremax_analysis_jobs_insert_own'
  ) THEN
    EXECUTE '
      CREATE POLICY "scoremax_analysis_jobs_insert_own" ON public.analysis_jobs
      FOR INSERT
      WITH CHECK (
        auth.uid() = user_id
        AND EXISTS (
          SELECT 1
          FROM public.scan_sessions ss
          WHERE ss.id = session_id
            AND ss.user_id = auth.uid()
        )
      )
    ';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'analysis_jobs' AND policyname = 'scoremax_analysis_jobs_select_admin'
  ) THEN
    EXECUTE 'CREATE POLICY "scoremax_analysis_jobs_select_admin" ON public.analysis_jobs FOR SELECT USING (public.scoremax_is_admin(auth.uid()))';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'analysis_job_assets' AND policyname = 'scoremax_analysis_job_assets_select_own'
  ) THEN
    EXECUTE 'CREATE POLICY "scoremax_analysis_job_assets_select_own" ON public.analysis_job_assets FOR SELECT USING (auth.uid() = user_id)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'analysis_job_assets' AND policyname = 'scoremax_analysis_job_assets_insert_own'
  ) THEN
    EXECUTE '
      CREATE POLICY "scoremax_analysis_job_assets_insert_own" ON public.analysis_job_assets
      FOR INSERT
      WITH CHECK (
        auth.uid() = user_id
        AND EXISTS (
          SELECT 1
          FROM public.analysis_jobs aj
          WHERE aj.id = analysis_job_id
            AND aj.user_id = auth.uid()
        )
        AND EXISTS (
          SELECT 1
          FROM public.scan_assets sa
          WHERE sa.id = scan_asset_id
            AND sa.user_id = auth.uid()
            AND sa.asset_type_code = asset_type_code
        )
      )
    ';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'analysis_job_assets' AND policyname = 'scoremax_analysis_job_assets_select_admin'
  ) THEN
    EXECUTE 'CREATE POLICY "scoremax_analysis_job_assets_select_admin" ON public.analysis_job_assets FOR SELECT USING (public.scoremax_is_admin(auth.uid()))';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'analysis_results' AND policyname = 'scoremax_analysis_results_select_own'
  ) THEN
    EXECUTE 'CREATE POLICY "scoremax_analysis_results_select_own" ON public.analysis_results FOR SELECT USING (auth.uid() = user_id)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'analysis_results' AND policyname = 'scoremax_analysis_results_insert_own'
  ) THEN
    EXECUTE '
      CREATE POLICY "scoremax_analysis_results_insert_own" ON public.analysis_results
      FOR INSERT
      WITH CHECK (
        auth.uid() = user_id
        AND EXISTS (
          SELECT 1
          FROM public.analysis_jobs aj
          WHERE aj.id = analysis_job_id
            AND aj.user_id = auth.uid()
        )
      )
    ';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'analysis_results' AND policyname = 'scoremax_analysis_results_select_admin'
  ) THEN
    EXECUTE 'CREATE POLICY "scoremax_analysis_results_select_admin" ON public.analysis_results FOR SELECT USING (public.scoremax_is_admin(auth.uid()))';
  END IF;
END $$;

-- 12) Helper functions and trigger for onboarding scan polling
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'ensure_onboarding_scan_session'
      AND pg_get_function_identity_arguments(p.oid) = ''
  ) THEN
    EXECUTE $sql$
      CREATE FUNCTION public.ensure_onboarding_scan_session()
      RETURNS UUID
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      AS $body$
      DECLARE
        current_user_id UUID;
        existing_session UUID;
        required_count INTEGER;
      BEGIN
        current_user_id := auth.uid();

        IF current_user_id IS NULL THEN
          RAISE EXCEPTION 'auth.uid() is required';
        END IF;

        SELECT COUNT(*)::INTEGER
        INTO required_count
        FROM public.scan_asset_types
        WHERE is_required_onboarding = TRUE
          AND is_active = TRUE;

        SELECT ss.id
        INTO existing_session
        FROM public.scan_sessions ss
        WHERE ss.user_id = current_user_id
          AND ss.source = 'onboarding'
          AND ss.status IN ('collecting', 'ready', 'processing')
        ORDER BY ss.created_at DESC
        LIMIT 1;

        IF existing_session IS NOT NULL THEN
          RETURN existing_session;
        END IF;

        BEGIN
          INSERT INTO public.scan_sessions (
            user_id,
            source,
            status,
            required_asset_count,
            completed_asset_count,
            started_at,
            created_at,
            updated_at
          )
          VALUES (
            current_user_id,
            'onboarding',
            'collecting',
            GREATEST(required_count, 1),
            0,
            NOW(),
            NOW(),
            NOW()
          )
          RETURNING id INTO existing_session;
        EXCEPTION
          WHEN unique_violation THEN
            SELECT ss.id
            INTO existing_session
            FROM public.scan_sessions ss
            WHERE ss.user_id = current_user_id
              AND ss.source = 'onboarding'
              AND ss.status IN ('collecting', 'ready', 'processing')
            ORDER BY ss.created_at DESC
            LIMIT 1;
        END;

        RETURN existing_session;
      END;
      $body$;
    $sql$;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'scoremax_refresh_scan_session_progress'
      AND pg_get_function_identity_arguments(p.oid) = 'target_session uuid'
  ) THEN
    EXECUTE $sql$
      CREATE FUNCTION public.scoremax_refresh_scan_session_progress(target_session UUID)
      RETURNS VOID
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      AS $body$
      DECLARE
        required_count INTEGER := 0;
        completed_count INTEGER := 0;
      BEGIN
        IF target_session IS NULL THEN
          RETURN;
        END IF;

        SELECT COUNT(*)::INTEGER
        INTO required_count
        FROM public.scan_asset_types
        WHERE is_required_onboarding = TRUE
          AND is_active = TRUE;

        SELECT COUNT(DISTINCT sa.asset_type_code)::INTEGER
        INTO completed_count
        FROM public.scan_assets sa
        JOIN public.scan_asset_types sat
          ON sat.code = sa.asset_type_code
        WHERE sa.session_id = target_session
          AND sat.is_required_onboarding = TRUE
          AND sat.is_active = TRUE
          AND sa.upload_status IN ('uploaded', 'validated')
          AND length(btrim(COALESCE(sa.r2_key, ''))) > 0;

        UPDATE public.scan_sessions ss
        SET required_asset_count = required_count,
            completed_asset_count = completed_count,
            status = CASE
              WHEN ss.status IN ('completed', 'failed', 'abandoned') THEN ss.status
              WHEN required_count > 0 AND completed_count >= required_count THEN 'ready'
              ELSE 'collecting'
            END,
            ready_at = CASE
              WHEN required_count > 0 AND completed_count >= required_count
                THEN COALESCE(ss.ready_at, NOW())
              ELSE NULL
            END,
            updated_at = NOW()
        WHERE ss.id = target_session;
      END;
      $body$;
    $sql$;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'scoremax_refresh_scan_session_progress_trigger'
      AND pg_get_function_identity_arguments(p.oid) = ''
  ) THEN
    EXECUTE $sql$
      CREATE FUNCTION public.scoremax_refresh_scan_session_progress_trigger()
      RETURNS TRIGGER
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      AS $body$
      BEGIN
        IF TG_OP = 'DELETE' THEN
          PERFORM public.scoremax_refresh_scan_session_progress(OLD.session_id);
          RETURN OLD;
        END IF;

        PERFORM public.scoremax_refresh_scan_session_progress(NEW.session_id);
        RETURN NEW;
      END;
      $body$;
    $sql$;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'get_onboarding_scan_status'
      AND pg_get_function_identity_arguments(p.oid) = ''
  ) THEN
    EXECUTE $sql$
      CREATE FUNCTION public.get_onboarding_scan_status()
      RETURNS TABLE (
        session_id UUID,
        required_asset_count INTEGER,
        completed_asset_count INTEGER,
        is_ready BOOLEAN,
        missing_asset_types TEXT[]
      )
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      AS $body$
      DECLARE
        current_user_id UUID;
        current_session_id UUID;
      BEGIN
        current_user_id := auth.uid();

        IF current_user_id IS NULL THEN
          RAISE EXCEPTION 'auth.uid() is required';
        END IF;

        current_session_id := public.ensure_onboarding_scan_session();

        PERFORM public.scoremax_refresh_scan_session_progress(current_session_id);

        RETURN QUERY
        WITH missing AS (
          SELECT sat.label_fr
          FROM public.scan_asset_types sat
          WHERE sat.is_required_onboarding = TRUE
            AND sat.is_active = TRUE
            AND NOT EXISTS (
              SELECT 1
              FROM public.scan_assets sa
              WHERE sa.session_id = current_session_id
                AND sa.asset_type_code = sat.code
                AND sa.upload_status IN ('uploaded', 'validated')
                AND length(btrim(COALESCE(sa.r2_key, ''))) > 0
            )
          ORDER BY sat.sort_order
        )
        SELECT
          ss.id AS session_id,
          ss.required_asset_count,
          ss.completed_asset_count,
          (ss.completed_asset_count >= ss.required_asset_count AND ss.required_asset_count > 0) AS is_ready,
          COALESCE(array_agg(missing.label_fr) FILTER (WHERE missing.label_fr IS NOT NULL), ARRAY[]::TEXT[]) AS missing_asset_types
        FROM public.scan_sessions ss
        LEFT JOIN missing ON TRUE
        WHERE ss.id = current_session_id
        GROUP BY ss.id, ss.required_asset_count, ss.completed_asset_count;
      END;
      $body$;
    $sql$;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.triggers
    WHERE event_object_schema = 'public'
      AND event_object_table = 'scan_assets'
      AND trigger_name = 'scoremax_on_scan_asset_change'
  ) THEN
    EXECUTE '
      CREATE TRIGGER scoremax_on_scan_asset_change
      AFTER INSERT OR UPDATE OR DELETE ON public.scan_assets
      FOR EACH ROW EXECUTE FUNCTION public.scoremax_refresh_scan_session_progress_trigger()
    ';
  END IF;
END $$;

-- get_recent_scan_status: returns the user's latest scan progress within
-- a rolling time window (default 60 minutes) regardless of scan_session.
-- Used by the "Nouvelle analyse" page to detect freshly captured assets
-- pushed by the iPhone app and let the user launch an analysis from them.
CREATE OR REPLACE FUNCTION public.get_recent_scan_status(
  p_window_minutes INTEGER DEFAULT 60
) RETURNS TABLE (
  window_minutes INTEGER,
  required_count INTEGER,
  received_count INTEGER,
  missing_asset_types TEXT[],
  received_asset_types TEXT[],
  latest_session_id UUID,
  latest_captured_at TIMESTAMPTZ,
  is_ready BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $body$
DECLARE
  current_user_id UUID;
  effective_window INTEGER;
  window_start TIMESTAMPTZ;
BEGIN
  current_user_id := auth.uid();

  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'auth.uid() is required';
  END IF;

  effective_window := GREATEST(COALESCE(p_window_minutes, 60), 1);
  window_start := NOW() - make_interval(mins => effective_window);

  RETURN QUERY
  WITH required_codes AS (
    SELECT sat.code
    FROM public.scan_asset_types sat
    WHERE sat.is_active = TRUE
      AND sat.is_required_onboarding = TRUE
  ),
  recent_assets AS (
    SELECT
      sa.asset_type_code,
      sa.session_id,
      sa.created_at,
      sa.captured_at,
      ROW_NUMBER() OVER (
        PARTITION BY sa.asset_type_code
        ORDER BY sa.created_at DESC
      ) AS rn
    FROM public.scan_assets sa
    WHERE sa.user_id = current_user_id
      AND sa.created_at >= window_start
      AND sa.upload_status IN ('uploaded', 'validated')
      AND length(btrim(COALESCE(sa.r2_key, ''))) > 0
  ),
  latest_per_type AS (
    SELECT ra.*
    FROM recent_assets ra
    JOIN required_codes rc ON rc.code = ra.asset_type_code
    WHERE ra.rn = 1
  ),
  picked_session AS (
    SELECT lpt.session_id
    FROM latest_per_type lpt
    ORDER BY lpt.created_at DESC
    LIMIT 1
  ),
  required_array AS (
    SELECT COALESCE(array_agg(rc.code ORDER BY rc.code), ARRAY[]::TEXT[]) AS codes
    FROM required_codes rc
  ),
  received_array AS (
    SELECT COALESCE(
      array_agg(lpt.asset_type_code ORDER BY lpt.asset_type_code),
      ARRAY[]::TEXT[]
    ) AS codes
    FROM latest_per_type lpt
  )
  SELECT
    effective_window AS window_minutes,
    COALESCE(array_length(ra.codes, 1), 0) AS required_count,
    COALESCE(array_length(rec.codes, 1), 0) AS received_count,
    ARRAY(
      SELECT unnest(ra.codes)
      EXCEPT
      SELECT unnest(rec.codes)
    )::TEXT[] AS missing_asset_types,
    rec.codes AS received_asset_types,
    (SELECT session_id FROM picked_session) AS latest_session_id,
    (SELECT MAX(COALESCE(lpt.captured_at, lpt.created_at)) FROM latest_per_type lpt) AS latest_captured_at,
    (
      COALESCE(array_length(ra.codes, 1), 0) > 0
      AND COALESCE(array_length(rec.codes, 1), 0) >= COALESCE(array_length(ra.codes, 1), 0)
    ) AS is_ready
  FROM required_array ra
  CROSS JOIN received_array rec;
END;
$body$;

GRANT EXECUTE ON FUNCTION public.ensure_onboarding_scan_session() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_onboarding_scan_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_recent_scan_status(INTEGER) TO authenticated;

-- 13) Post-check summary output
SELECT
  policyname,
  cmd,
  permissive
FROM pg_policies
WHERE schemaname = 'public'
  AND (
    tablename = 'profiles'
    OR tablename LIKE 'scan_%'
    OR tablename LIKE 'analysis_%'
  )
  AND policyname LIKE 'scoremax_%'
ORDER BY tablename, policyname;

SELECT
  trigger_name,
  event_manipulation,
  action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'auth'
  AND event_object_table = 'users'
  AND trigger_name = 'scoremax_on_auth_user_created';

SELECT
  trigger_name,
  event_manipulation,
  action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table = 'scan_assets'
  AND trigger_name = 'scoremax_on_scan_asset_change';

SELECT
  code,
  label_fr,
  is_required_onboarding,
  sort_order,
  is_active
FROM public.scan_asset_types
ORDER BY sort_order;

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