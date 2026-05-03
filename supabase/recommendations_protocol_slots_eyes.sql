-- ============================================================================
-- ScoreMax — Assign protocol_slots to all eyes recommendations
--
-- Run AFTER `recommendations_protocol_slots_migration.sql` to make the column
-- exist, and AFTER `recommendations_seed_eyes.sql` to make the rows exist.
--
-- Idempotent: safe to re-run, fully overwrites the slots column for each row.
--
-- Slots semantics:
--   morning|midday|evening|night = daily timeline placement
--   weekly                       = recurring but not daily (exercises, massages)
--   general                      = permanent rule / always-on principle
--   <empty array>                = treated as a "cure" (one-shot or time-bounded)
-- ============================================================================

UPDATE public.scoremax_recommendations
SET protocol_slots = CASE id
  ----------------------------------------------------------- SOFT --------------
  WHEN 'eyes.sleep_optimization'        THEN ARRAY['general','night']
  WHEN 'eyes.eye_nutrition'             THEN ARRAY['general']
  WHEN 'eyes.sun_protection'            THEN ARRAY['morning','midday']
  WHEN 'eyes.cold_therapy'              THEN ARRAY['morning','evening']
  WHEN 'eyes.orbicularis_exercise'      THEN ARRAY['weekly']
  WHEN 'eyes.lateral_lifting_massage'   THEN ARRAY['weekly']
  WHEN 'eyes.topical_antioxidants'      THEN ARRAY['morning']
  WHEN 'eyes.peptide_hyaluronic_cream'  THEN ARRAY['evening']
  WHEN 'eyes.icehooding'                THEN ARRAY['morning']
  WHEN 'eyes.eyelash_growth_natural'    THEN ARRAY['evening']
  WHEN 'eyes.eyelash_dyeing'            THEN ARRAY[]::text[]
  WHEN 'eyes.eye_patching'              THEN ARRAY['weekly']
  WHEN 'eyes.no_rubbing'                THEN ARRAY['general']
  WHEN 'eyes.eyelid_levator_exercise'   THEN ARRAY['weekly']
  WHEN 'eyes.eyebrow_grooming'          THEN ARRAY['weekly']
  ----------------------------------------------------------- HARD --------------
  -- Hard interventions are one-shot or time-bounded → no recurring slot.
  -- They surface in the "Active cures" section automatically.
  WHEN 'eyes.dermal_filler_infraorbital' THEN ARRAY[]::text[]
  WHEN 'eyes.upper_blepharoplasty'       THEN ARRAY[]::text[]
  WHEN 'eyes.lower_blepharoplasty'       THEN ARRAY[]::text[]
  WHEN 'eyes.canthoplasty'               THEN ARRAY[]::text[]
  WHEN 'eyes.canthopexy'                 THEN ARRAY[]::text[]
  WHEN 'eyes.infraorbital_implants'      THEN ARRAY[]::text[]
  WHEN 'eyes.orbital_decompression'      THEN ARRAY[]::text[]
  WHEN 'eyes.laser_resurfacing'          THEN ARRAY[]::text[]
  WHEN 'eyes.microneedling_pro'          THEN ARRAY[]::text[]
  WHEN 'eyes.prp_periocular'             THEN ARRAY[]::text[]
  WHEN 'eyes.eyelash_extensions'         THEN ARRAY[]::text[]
  -- Colored contacts are technically a daily-use accessory, not a one-shot.
  WHEN 'eyes.colored_contacts'           THEN ARRAY['general']
  ELSE protocol_slots
END
WHERE worker = 'eyes';
