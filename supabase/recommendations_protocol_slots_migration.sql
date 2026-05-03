-- ============================================================================
-- ScoreMax — Add protocol_slots to scoremax_recommendations
--
-- A recommendation can be placed in 0..N slots of the user "protocole" view:
--   morning  | midday   | evening | night    — daily timeline
--   weekly                                   — weekly cadence
--   general                                  — permanent rules / always-on
--
-- 0 slots → recommendation is treated as a "cure" (one-shot or time-bounded
-- intervention) and surfaces only in the active cures section based on its
-- duration_value / duration_unit.
--
-- Idempotent: safe to re-run.
-- ============================================================================

ALTER TABLE IF EXISTS public.scoremax_recommendations
  ADD COLUMN IF NOT EXISTS protocol_slots TEXT[] NOT NULL DEFAULT ARRAY[]::text[];

-- Element-level CHECK is implemented as a row-level constraint that walks the
-- array. Using DO block so it's idempotent (CHECK constraints don't have
-- IF NOT EXISTS in stock Postgres).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'scoremax_recommendations_protocol_slots_check'
  ) THEN
    EXECUTE $c$
      ALTER TABLE public.scoremax_recommendations
        ADD CONSTRAINT scoremax_recommendations_protocol_slots_check
        CHECK (
          protocol_slots <@ ARRAY[
            'morning', 'midday', 'evening', 'night', 'weekly', 'general'
          ]::text[]
        )
    $c$;
  END IF;
END
$$;

-- GIN index for fast membership queries (`WHERE protocol_slots @> '{morning}'`).
CREATE INDEX IF NOT EXISTS scoremax_recommendations_protocol_slots_idx
  ON public.scoremax_recommendations
  USING GIN (protocol_slots);

COMMENT ON COLUMN public.scoremax_recommendations.protocol_slots IS
  'Where this recommendation should appear in the user protocol view. Empty means it is treated as a cure (time-bounded) rather than a recurring routine.';
