-- =============================================================================
-- One-off fix if CREATE INDEX scoremax_analysis_jobs_user_freemium_active_uidx
-- failed with ERROR 23505 (duplicate user_id).
--
-- Run this in Supabase SQL Editor, then re-run the remainder of
-- patch_existing_schema.sql from the CREATE UNIQUE INDEX line onward if needed.
-- =============================================================================

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id
      ORDER BY
        CASE status
          WHEN 'completed' THEN 0
          WHEN 'running' THEN 1
          WHEN 'queued' THEN 2
          ELSE 3
        END,
        completed_at DESC NULLS LAST,
        created_at DESC
    ) AS rn
  FROM public.analysis_jobs
  WHERE tier = 'freemium'
    AND status IN ('queued', 'running', 'completed')
)
UPDATE public.analysis_jobs aj
SET tier = 'standard',
    updated_at = NOW()
FROM ranked r
WHERE aj.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS scoremax_analysis_jobs_user_freemium_active_uidx
  ON public.analysis_jobs (user_id)
  WHERE tier = 'freemium' AND status IN ('queued', 'running', 'completed');
