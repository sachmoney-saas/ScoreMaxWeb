-- OneShot / Nano Banana onboarding potential image — prompts + generations
-- Run manually in Supabase SQL editor or via migration pipeline.

-- Prompts pilotables depuis l'admin
CREATE TABLE IF NOT EXISTS scoremax_ai_image_prompts (
  key text PRIMARY KEY,
  description text,
  prompt text NOT NULL,
  model text NOT NULL DEFAULT 'nano-banana',
  model_variant text NOT NULL DEFAULT 'fast',
  aspect_ratio text NOT NULL DEFAULT '1:1',
  safety_filters boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  updated_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Générations par utilisateur (1 ligne par appel OneShot)
CREATE TABLE IF NOT EXISTS scoremax_ai_image_generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  prompt_key text NOT NULL REFERENCES scoremax_ai_image_prompts (key) ON DELETE RESTRICT,
  prompt_snapshot text NOT NULL,
  source_scan_asset_id uuid REFERENCES scan_assets (id) ON DELETE SET NULL,
  oneshot_job_id text,
  oneshot_reference_file_id text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  r2_bucket text,
  r2_key text,
  result_content_type text,
  result_size_bytes bigint,
  error_code text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS scoremax_ai_image_generations_user_idx
  ON scoremax_ai_image_generations (user_id, created_at DESC);

INSERT INTO scoremax_ai_image_prompts (key, description, prompt, aspect_ratio)
VALUES (
  'onboarding_potential_6months',
  'Image générée à la fin de l''onboarding pour montrer le potentiel du user dans 6 mois.',
  'Restyle this photo while keeping the same person''s identity, ethnicity, age, gender, and facial structure. Apply the most flattering looksmaxxing improvements: clearer skin, sharper jawline, healthier hair, brighter eyes, well-groomed eyebrows, balanced face proportions, soft cinematic studio lighting. The result should look like a realistic photo of the same person in 6 months after consistent self-care, fitness, skincare and grooming. Photorealistic, neutral background, head-and-shoulders portrait.',
  '1:1'
) ON CONFLICT (key) DO NOTHING;
