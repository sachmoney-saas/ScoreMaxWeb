-- Repasse la génération OneShot « potentiel » onboarding sur le carré 1:1 (UI avant/après + prompt).
UPDATE scoremax_ai_image_prompts
SET aspect_ratio = '1:1',
    updated_at = now()
WHERE key = 'onboarding_potential_6months'
  AND aspect_ratio IS DISTINCT FROM '1:1';
