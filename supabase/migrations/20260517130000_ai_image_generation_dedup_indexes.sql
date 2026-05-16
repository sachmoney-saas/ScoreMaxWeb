-- Une seule génération active (pending) ou conservée (completed) par utilisateur et prompt onboarding.

WITH ranked_completed AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, prompt_key
      ORDER BY created_at DESC
    ) AS rn
  FROM public.scoremax_ai_image_generations
  WHERE status = 'completed'
)
DELETE FROM public.scoremax_ai_image_generations AS g
USING ranked_completed AS r
WHERE g.id = r.id
  AND r.rn > 1;

WITH ranked_pending AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, prompt_key
      ORDER BY created_at DESC
    ) AS rn
  FROM public.scoremax_ai_image_generations
  WHERE status = 'pending'
)
DELETE FROM public.scoremax_ai_image_generations AS g
USING ranked_pending AS r
WHERE g.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS scoremax_ai_image_generations_one_completed_per_user_prompt
  ON public.scoremax_ai_image_generations (user_id, prompt_key)
  WHERE status = 'completed';

CREATE UNIQUE INDEX IF NOT EXISTS scoremax_ai_image_generations_one_pending_per_user_prompt
  ON public.scoremax_ai_image_generations (user_id, prompt_key)
  WHERE status = 'pending';
