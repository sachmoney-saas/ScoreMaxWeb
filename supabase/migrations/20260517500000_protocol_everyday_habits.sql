-- ===========================================================================
-- Everyday habits: separate from slot routines (no redundancy with skin steps)
-- ===========================================================================

BEGIN;

-- Remove always-on rules that duplicate the daily skin/lips/eyes routines
DELETE FROM public.scoremax_protocol_preset_always_on
WHERE preset_id IN ('skin_v1', 'lips_v1', 'cheeks_v1', 'eyes_v1');

INSERT INTO public.scoremax_protocol_presets (
  id, slug, target_worker, title_en, title_fr, summary_en, summary_fr, priority
) VALUES (
  'daily_habits_v1',
  'daily_habits',
  'habits',
  'Daily habits',
  'Habitudes quotidiennes',
  'Universal habits outside your skincare routine.',
  'Habitudes universelles en dehors de la routine skincare.',
  5
)
ON CONFLICT (id) DO UPDATE SET
  title_en = EXCLUDED.title_en,
  title_fr = EXCLUDED.title_fr,
  summary_en = EXCLUDED.summary_en,
  summary_fr = EXCLUDED.summary_fr,
  priority = EXCLUDED.priority,
  enabled = true;

DELETE FROM public.scoremax_protocol_preset_always_on
WHERE preset_id = 'daily_habits_v1';

INSERT INTO public.scoremax_protocol_preset_always_on
  (preset_id, position, title_en, title_fr, detail_en, detail_fr)
VALUES (
  'daily_habits_v1',
  1,
  'Drink 2 liters of water',
  'Boire 2 litres d''eau',
  NULL,
  NULL
);

COMMIT;
