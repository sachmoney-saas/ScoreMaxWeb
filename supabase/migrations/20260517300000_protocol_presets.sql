-- ===========================================================================
-- Protocol presets: catalogue + user assignments (routine automatique)
-- ===========================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Catalogue
-- ---------------------------------------------------------------------------

CREATE TABLE public.scoremax_protocol_presets (
  id          text PRIMARY KEY,
  slug        text NOT NULL UNIQUE,
  target_worker text NOT NULL,
  title_en    text NOT NULL,
  title_fr    text NOT NULL,
  summary_en  text NOT NULL DEFAULT '',
  summary_fr  text NOT NULL DEFAULT '',
  priority    integer NOT NULL DEFAULT 0,
  enabled     boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.scoremax_protocol_preset_steps (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  preset_id       text NOT NULL REFERENCES public.scoremax_protocol_presets(id) ON DELETE CASCADE,
  slot            text NOT NULL CHECK (slot IN ('morning', 'midday', 'evening')),
  weekday_pattern jsonb NOT NULL DEFAULT '["all"]'::jsonb,
  position        integer NOT NULL DEFAULT 0,
  title_en        text NOT NULL,
  title_fr        text NOT NULL,
  detail_en       text,
  detail_fr       text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT scoremax_protocol_preset_steps_weekday_array
    CHECK (jsonb_typeof(weekday_pattern) = 'array')
);

CREATE INDEX scoremax_protocol_preset_steps_preset_slot
  ON public.scoremax_protocol_preset_steps (preset_id, slot, position);

CREATE TABLE public.scoremax_protocol_preset_always_on (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  preset_id   text NOT NULL REFERENCES public.scoremax_protocol_presets(id) ON DELETE CASCADE,
  position    integer NOT NULL DEFAULT 0,
  title_en    text NOT NULL,
  title_fr    text NOT NULL,
  detail_en   text,
  detail_fr   text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX scoremax_protocol_preset_always_on_preset
  ON public.scoremax_protocol_preset_always_on (preset_id, position);

CREATE TABLE public.scoremax_protocol_preset_avoid (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  preset_id   text NOT NULL REFERENCES public.scoremax_protocol_presets(id) ON DELETE CASCADE,
  position    integer NOT NULL DEFAULT 0,
  title_en    text NOT NULL,
  title_fr    text NOT NULL,
  detail_en   text,
  detail_fr   text,
  severity    text NOT NULL DEFAULT 'warn' CHECK (severity IN ('warn', 'danger')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX scoremax_protocol_preset_avoid_preset
  ON public.scoremax_protocol_preset_avoid (preset_id, position);

-- ---------------------------------------------------------------------------
-- User assignments
-- ---------------------------------------------------------------------------

CREATE TABLE public.scoremax_user_routine (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  preset_id   text NOT NULL REFERENCES public.scoremax_protocol_presets(id) ON DELETE RESTRICT,
  started_at  timestamptz NOT NULL DEFAULT now(),
  removed_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX scoremax_user_routine_active_unique
  ON public.scoremax_user_routine (user_id, preset_id)
  WHERE removed_at IS NULL;

CREATE INDEX scoremax_user_routine_user_active
  ON public.scoremax_user_routine (user_id)
  WHERE removed_at IS NULL;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.scoremax_protocol_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scoremax_protocol_preset_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scoremax_protocol_preset_always_on ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scoremax_protocol_preset_avoid ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scoremax_user_routine ENABLE ROW LEVEL SECURITY;

CREATE POLICY scoremax_protocol_presets_select_authenticated
  ON public.scoremax_protocol_presets
  FOR SELECT TO authenticated
  USING (enabled = true);

CREATE POLICY scoremax_protocol_preset_steps_select_authenticated
  ON public.scoremax_protocol_preset_steps
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.scoremax_protocol_presets p
      WHERE p.id = preset_id AND p.enabled = true
    )
  );

CREATE POLICY scoremax_protocol_preset_always_on_select_authenticated
  ON public.scoremax_protocol_preset_always_on
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.scoremax_protocol_presets p
      WHERE p.id = preset_id AND p.enabled = true
    )
  );

CREATE POLICY scoremax_protocol_preset_avoid_select_authenticated
  ON public.scoremax_protocol_preset_avoid
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.scoremax_protocol_presets p
      WHERE p.id = preset_id AND p.enabled = true
    )
  );

CREATE POLICY scoremax_user_routine_select_self
  ON public.scoremax_user_routine
  FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY scoremax_user_routine_insert_self
  ON public.scoremax_user_routine
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY scoremax_user_routine_update_self
  ON public.scoremax_user_routine
  FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Seed: skin_v1
-- ---------------------------------------------------------------------------

INSERT INTO public.scoremax_protocol_presets (
  id, slug, target_worker, title_en, title_fr, summary_en, summary_fr, priority
) VALUES (
  'skin_v1',
  'skin',
  'skin',
  'Skin routine',
  'Routine peau',
  'Morning hydration + SPF. Evening BHA/AHA rotation with barrier recovery nights.',
  'Hydratation + SPF le matin. Soir : alternance BHA/AHA et nuits réparation barrière.',
  10
);

-- Morning (every day)
INSERT INTO public.scoremax_protocol_preset_steps
  (preset_id, slot, weekday_pattern, position, title_en, title_fr, detail_en, detail_fr)
VALUES
  ('skin_v1', 'morning', '["all"]', 1,
   'Gentle cleanse',
   'Nettoyage doux',
   'Rinse with water or use a gentle cleanser. Pat dry with a clean towel.',
   'Rince à l''eau ou nettoyant doux. Sèche en tapotant avec une serviette propre.'),
  ('skin_v1', 'morning', '["all"]', 2,
   'Hyaluronic acid',
   'Acide hyaluronique',
   'Apply on slightly damp skin.',
   'Sur peau encore un peu humide.'),
  ('skin_v1', 'morning', '["all"]', 3,
   'Niacinamide 10%',
   'Niacinamide 10%',
   '2–3 drops on full face. Wait 1 minute.',
   '2 à 3 gouttes sur tout le visage. Laisse pénétrer 1 minute.'),
  ('skin_v1', 'morning', '["all"]', 4,
   'Light moisturizer (optional)',
   'Crème hydratante légère (optionnelle)',
   'Skip if oily skin; go straight to sunscreen.',
   'Passe si peau très grasse ; enchaîne sur le SPF.'),
  ('skin_v1', 'morning', '["all"]', 5,
   'Sunscreen without octocrylene',
   'Crème solaire sans octocrylène',
   'Generous amount (~2 finger lengths) on face and neck.',
   'Quantité généreuse (~2 doigts) sur visage et cou.');

-- Evening: Mon + Thu — BHA
INSERT INTO public.scoremax_protocol_preset_steps
  (preset_id, slot, weekday_pattern, position, title_en, title_fr, detail_en, detail_fr)
VALUES
  ('skin_v1', 'evening', '["mon","thu"]', 1,
   'Double cleanse',
   'Double nettoyage',
   'Remove sunscreen and daytime sebum.',
   'Retire crème solaire et sébum de la journée.'),
  ('skin_v1', 'evening', '["mon","thu"]', 2,
   'BHA salicylic acid',
   'BHA acide salicylique',
   'On dry skin. Nose, forehead, chin. Wait 10–15 min.',
   'Sur peau sèche. Nez, front, menton. Laisse agir 10 à 15 min.'),
  ('skin_v1', 'evening', '["mon","thu"]', 3,
   'Hyaluronic acid',
   'Acide hyaluronique',
   'Lightly mist face (thermal water or damp hands) before applying.',
   'Humidifie légèrement (eau thermale ou mains mouillées) avant application.'),
  ('skin_v1', 'evening', '["mon","thu"]', 4,
   'Moisturizer (generous)',
   'Crème hydratante (généreuse)',
   'Unscented, no alcohol. Thicker layer than morning.',
   'Sans parfum ni alcool. Couche plus épaisse que le matin.');

-- Evening: Tue + Fri — AHA
INSERT INTO public.scoremax_protocol_preset_steps
  (preset_id, slot, weekday_pattern, position, title_en, title_fr, detail_en, detail_fr)
VALUES
  ('skin_v1', 'evening', '["tue","fri"]', 1,
   'Double cleanse',
   'Double nettoyage',
   'Remove sunscreen and daytime sebum.',
   'Retire crème solaire et sébum de la journée.'),
  ('skin_v1', 'evening', '["tue","fri"]', 2,
   'AHA glycolic acid',
   'AHA acide glycolique',
   'On dry skin. Wait 10–15 min.',
   'Sur peau sèche. Laisse agir 10 à 15 min.'),
  ('skin_v1', 'evening', '["tue","fri"]', 3,
   'Hyaluronic acid',
   'Acide hyaluronique',
   'Lightly mist face before applying.',
   'Humidifie légèrement avant application.'),
  ('skin_v1', 'evening', '["tue","fri"]', 4,
   'Moisturizer',
   'Crème hydratante',
   'Unscented, no alcohol.',
   'Sans parfum ni alcool.');

-- Evening: Wed + Sat + Sun — recovery
INSERT INTO public.scoremax_protocol_preset_steps
  (preset_id, slot, weekday_pattern, position, title_en, title_fr, detail_en, detail_fr)
VALUES
  ('skin_v1', 'evening', '["wed","sat","sun"]', 1,
   'Double cleanse',
   'Double nettoyage',
   'No exfoliation tonight — barrier recovery.',
   'Pas d''exfoliation — réparation barrière.'),
  ('skin_v1', 'evening', '["wed","sat","sun"]', 2,
   'Hyaluronic acid',
   'Acide hyaluronique',
   'Maximum hydration.',
   'Hydratation maximale.'),
  ('skin_v1', 'evening', '["wed","sat","sun"]', 3,
   'Moisturizer (very generous)',
   'Crème hydratante (très généreuse)',
   'Thick layer to help skin recover overnight.',
   'Couche épaisse pour aider la peau à récupérer.');

-- Always-on rules
INSERT INTO public.scoremax_protocol_preset_always_on
  (preset_id, position, title_en, title_fr, detail_en, detail_fr)
VALUES
  ('skin_v1', 1,
   'Niacinamide 10% + 1% Zinc — morning and evening',
   'Niacinamide 10% + 1% Zinc — matin et soir',
   NULL, NULL),
  ('skin_v1', 2,
   'Sunscreen without octocrylene — every morning',
   'Crème solaire sans octocrylène — tous les matins',
   NULL, NULL),
  ('skin_v1', 3,
   'Hyaluronic acid before niacinamide (morning buffer)',
   'Acide hyaluronique avant niacinamide (coussin hydratant le matin)',
   NULL, NULL),
  ('skin_v1', 4,
   'BHA is the only pore-penetrating exfoliant',
   'Le BHA est le seul exfoliant qui pénètre le pore',
   NULL, NULL),
  ('skin_v1', 5,
   'Satin pillowcase — less friction, actives stay on skin',
   'Taie en satin — moins de friction, actifs conservés sur la peau',
   NULL, NULL),
  ('skin_v1', 6,
   'Never AHA + BHA the same evening',
   'Jamais AHA + BHA le même soir',
   NULL, NULL),
  ('skin_v1', 7,
   'After acids: do not rinse — mist lightly before HA',
   'Après acide : ne pas rincer — brumiser avant l''AH',
   NULL, NULL),
  ('skin_v1', 8,
   '4-night rule: if stinging, drop to 1 BHA + 1 AHA per week',
   'Règle des 4 soirs : si picotements, passe à 1 BHA + 1 AHA / semaine',
   NULL, NULL);

-- Avoid list
INSERT INTO public.scoremax_protocol_preset_avoid
  (preset_id, position, title_en, title_fr, detail_en, detail_fr, severity)
VALUES
  ('skin_v1', 1,
   'AHA and BHA on the same evening',
   'AHA et BHA le même soir',
   NULL, NULL, 'danger'),
  ('skin_v1', 2,
   'Sunscreens containing octocrylene',
   'Crèmes solaires avec octocrylène',
   NULL, NULL, 'danger'),
  ('skin_v1', 3,
   'Rinsing face right after applying an acid',
   'Rincer le visage juste après un acide',
   NULL, NULL, 'warn'),
  ('skin_v1', 4,
   'Cotton pillowcases',
   'Taies d''oreiller en coton',
   NULL, NULL, 'warn'),
  ('skin_v1', 5,
   'Rubbing face with a towel',
   'Frotter le visage avec la serviette',
   NULL, NULL, 'warn'),
  ('skin_v1', 6,
   'Harsh foaming cleansers with fragrance/alcohol at night',
   'Nettoyants moussants agressifs parfumés/alcool le soir',
   NULL, NULL, 'warn');

COMMIT;
