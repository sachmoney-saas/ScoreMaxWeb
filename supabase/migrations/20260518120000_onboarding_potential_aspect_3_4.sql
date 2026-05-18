-- Aligne la génération OneShot potentiel onboarding sur le ratio portrait 3:4 (UI avant/après).
UPDATE public.scoremax_ai_image_prompts
SET aspect_ratio = '3:4',
    updated_at = now()
WHERE key = 'onboarding_potential_6months'
  AND aspect_ratio IS DISTINCT FROM '3:4';
