-- =========================================================================================
-- SUPABASE SENIOR BOILERPLATE SETUP (ROBUST EDITION)
-- =========================================================================================

-- 1. SCHEMA DEFINITION
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL PRIMARY KEY,
    email TEXT,
    role TEXT DEFAULT 'user' NOT NULL,
    is_subscriber BOOLEAN DEFAULT FALSE NOT NULL,
    has_accepted_terms BOOLEAN DEFAULT FALSE NOT NULL,
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    subscription_status TEXT,
    last_active_at TIMESTAMP WITH TIME ZONE,
    full_name TEXT,
    avatar_url TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,

    CONSTRAINT profiles_role_check CHECK (role IN ('user', 'admin'))
);

-- Assurer la présence des colonnes même si la table existe déjà
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='profiles' AND COLUMN_NAME='role') THEN
        ALTER TABLE public.profiles ADD COLUMN role TEXT DEFAULT 'user' NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='profiles' AND COLUMN_NAME='has_accepted_terms') THEN
        ALTER TABLE public.profiles ADD COLUMN has_accepted_terms BOOLEAN DEFAULT FALSE NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='profiles' AND COLUMN_NAME='is_subscriber') THEN
        ALTER TABLE public.profiles ADD COLUMN is_subscriber BOOLEAN DEFAULT FALSE NOT NULL;
    END IF;
END $$;

-- 2. ROW LEVEL SECURITY (RLS) - DÉSACTIVER PUIS RÉACTIVER POUR NETTOYER
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Nettoyage des anciennes politiques
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
    DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
    DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
    DROP POLICY IF EXISTS "Admins can perform all actions" ON public.profiles;
    DROP POLICY IF EXISTS "Enable read access for all users" ON public.profiles;
    DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.profiles;
    DROP POLICY IF EXISTS "Enable update for users based on id" ON public.profiles;
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;

-- NOUVELLES POLITIQUES ROBUSTES
-- Tout le monde peut voir les profils (nécessaire pour certaines fonctions)
CREATE POLICY "Enable read access for all users" ON public.profiles FOR SELECT USING (true);

-- Seul l'utilisateur lui-même peut insérer son profil (via le trigger ou direct)
CREATE POLICY "Enable insert for authenticated users only" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Seul l'utilisateur peut modifier son propre profil
CREATE POLICY "Enable update for users based on id" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- 3. AUTOMATION: HANDLER FOR NEW USERS
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    extracted_name TEXT;
    extracted_avatar TEXT;
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

    -- Utilisation de INSERT ... ON CONFLICT pour éviter les erreurs si le profil existe déjà
    INSERT INTO public.profiles (id, email, full_name, avatar_url, role, has_accepted_terms)
    VALUES (
        NEW.id, 
        NEW.email, 
        extracted_name,
        extracted_avatar,
        'user',
        COALESCE((NEW.raw_user_meta_data->>'has_accepted_terms')::boolean, false)
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), profiles.full_name),
        avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
        updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. TRIGGER REGISTRATION
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created 
    AFTER INSERT ON auth.users 
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 10. PERMISSIONS
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;
GRANT ALL ON public.profiles TO service_role;

-- 11. ADMIN MANAGEMENT (Instruction pour l'utilisateur)
-- Pour promouvoir un utilisateur en administrateur, exécutez la commande suivante
-- dans l'éditeur SQL de Supabase en remplaçant 'email@example.com' :
-- UPDATE public.profiles SET role = 'admin' WHERE email = 'email@example.com';
