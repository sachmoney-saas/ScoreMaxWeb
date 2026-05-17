-- ===========================================================================
-- Protocol presets: lips, cheeks, eyes
-- ===========================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- lips_v1
-- ---------------------------------------------------------------------------

INSERT INTO public.scoremax_protocol_presets (
  id, slug, target_worker, title_en, title_fr, summary_en, summary_fr, priority
) VALUES (
  'lips_v1',
  'lips',
  'lips',
  'Lips — volume & definition',
  'Lèvres — volume et définition',
  'Peptide plumper AM/PM. Optional Fullips suction for a 1–4h boost.',
  'Plumper peptides matin et soir. Fullips en option pour un boost 1 à 4 h.',
  20
)
ON CONFLICT (id) DO UPDATE SET
  title_en = EXCLUDED.title_en,
  title_fr = EXCLUDED.title_fr,
  summary_en = EXCLUDED.summary_en,
  summary_fr = EXCLUDED.summary_fr,
  priority = EXCLUDED.priority,
  enabled = true;

DELETE FROM public.scoremax_protocol_preset_steps WHERE preset_id = 'lips_v1';
DELETE FROM public.scoremax_protocol_preset_always_on WHERE preset_id = 'lips_v1';
DELETE FROM public.scoremax_protocol_preset_avoid WHERE preset_id = 'lips_v1';

INSERT INTO public.scoremax_protocol_preset_steps
  (preset_id, slot, weekday_pattern, position, title_en, title_fr, detail_en, detail_fr)
VALUES
  ('lips_v1', 'morning', '["all"]', 1,
   'Warm damp towel — 30 sec',
   'Gant humide tiède — 30 sec',
   'Gently dab lips. Opens micro-circulation; no aggressive scrub.',
   'Tamponne doucement. Ouvre la micro-circulation ; pas d''exfoliation agressive.'),
  ('lips_v1', 'morning', '["all"]', 2,
   'Peptide lip plumper — two passes',
   'Plumper à peptides — deux passes',
   'Thin layer on full lip, then extra on cupid''s bow and lower center. Tap with ring finger, do not rub.',
   'Couche fine sur toute la lèvre, puis surplus sur l''arc de Cupidon et le centre inférieur. Tapote au doigt annulaire, ne frotte pas.'),
  ('lips_v1', 'morning', '["all"]', 3,
   'HA micro-drop seal (if product has no HA)',
   'Micro-goutte d''AH (si le produit n''en contient pas)',
   'Apply on slightly warm lips while product is still setting.',
   'Sur lèvres encore légèrement tièdes pendant que le produit prend.'),
  ('lips_v1', 'morning', '["all"]', 4,
   'No licking or drinking — 10 min',
   'Ne pas lécher ni boire — 10 min',
   'Peptides need contact time to diffuse into the epidermis.',
   'Les peptides ont besoin de temps de contact pour diffuser.'),
  ('lips_v1', 'evening', '["all"]', 1,
   'Warm damp towel — 30 sec',
   'Gant humide tiède — 30 sec',
   'Same as morning prep.',
   'Même préparation qu''au matin.'),
  ('lips_v1', 'evening', '["all"]', 2,
   'Peptide lip plumper — two passes',
   'Plumper à peptides — deux passes',
   'Thin layer on full lip, then extra on cupid''s bow and lower center. Tap with ring finger.',
   'Couche fine sur toute la lèvre, puis surplus sur l''arc de Cupidon et le centre inférieur. Tapote au doigt annulaire.'),
  ('lips_v1', 'evening', '["all"]', 3,
   'HA micro-drop seal (if product has no HA)',
   'Micro-goutte d''AH (si le produit n''en contient pas)',
   'Locks hydration in tissue already primed by warmth.',
   'Verrouille l''hydratation dans le tissu déjà préparé par la chaleur.'),
  ('lips_v1', 'evening', '["all"]', 4,
   'No licking or drinking — 10 min',
   'Ne pas lécher ni boire — 10 min',
   'Do not cancel the application with saliva or drinks right after.',
   'Ne pas annuler l''application avec salive ou boisson juste après.'),
  ('lips_v1', 'midday', '["all"]', 1,
   'Fullips suction (optional — 1 to 4h boost)',
   'Succion Fullips (optionnel — boost 1 à 4 h)',
   'Controlled pressure only. Apply HA balm immediately after to lock swelling. Not a long-term structural fix.',
   'Pression contrôlée uniquement. Baume à l''AH juste après pour fixer le gonflement. Pas un fix structurel long terme.');

INSERT INTO public.scoremax_protocol_preset_always_on
  (preset_id, position, title_en, title_fr, detail_en, detail_fr)
VALUES
  ('lips_v1', 1,
   'Peptide lip plumper — morning and evening, every day',
   'Plumper à peptides — matin et soir, tous les jours',
   'Peptides work by accumulation; count 4–8 weeks for visible structural change.',
   'Les peptides agissent par accumulation ; compte 4 à 8 semaines pour un vrai changement structurel.'),
  ('lips_v1', 2,
   'Fullips — calibrated suction, not viral high-pressure challenges',
   'Fullips — succion calibrée, pas les défis à forte pression',
   'Controlled suction + HA right after = temporary 1–4h volume without bruising.',
   'Succion contrôlée + AH juste après = volume temporaire 1 à 4 h sans ecchymoses.');

INSERT INTO public.scoremax_protocol_preset_avoid
  (preset_id, position, title_en, title_fr, detail_en, detail_fr, severity)
VALUES
  ('lips_v1', 1,
   'Uncontrolled high-pressure lip suction',
   'Succion labiale non contrôlée à forte pression',
   'Risk of bruising and visible cupping effect.',
   'Risque d''ecchymoses et d''effet ventouse visible.',
   'danger'),
  ('lips_v1', 2,
   'Aggressive exfoliation before peptides',
   'Exfoliation agressive avant les peptides',
   'Peptides penetrate better on intact lip skin.',
   'Les peptides pénètrent mieux sur une lèvre intacte.',
   'warn'),
  ('lips_v1', 3,
   'Licking or drinking within 10 min after application',
   'Lécher ou boire dans les 10 min après application',
   NULL, NULL, 'warn'),
  ('lips_v1', 4,
   'Rubbing product in — only tap',
   'Frotter le produit — tapoter uniquement',
   NULL, NULL, 'warn');

-- ---------------------------------------------------------------------------
-- cheeks_v1
-- ---------------------------------------------------------------------------

INSERT INTO public.scoremax_protocol_presets (
  id, slug, target_worker, title_en, title_fr, summary_en, summary_fr, priority
) VALUES (
  'cheeks_v1',
  'cheeks',
  'cheeks',
  'Cheeks — Ogee curve',
  'Joues — courbe Ogee',
  'Medical options for cheek projection and curve refinement.',
  'Options médicales pour la projection des joues et la courbe Ogee.',
  30
)
ON CONFLICT (id) DO UPDATE SET
  title_en = EXCLUDED.title_en,
  title_fr = EXCLUDED.title_fr,
  summary_en = EXCLUDED.summary_en,
  summary_fr = EXCLUDED.summary_fr,
  priority = EXCLUDED.priority,
  enabled = true;

DELETE FROM public.scoremax_protocol_preset_steps WHERE preset_id = 'cheeks_v1';
DELETE FROM public.scoremax_protocol_preset_always_on WHERE preset_id = 'cheeks_v1';
DELETE FROM public.scoremax_protocol_preset_avoid WHERE preset_id = 'cheeks_v1';

INSERT INTO public.scoremax_protocol_preset_always_on
  (preset_id, position, title_en, title_fr, detail_en, detail_fr)
VALUES
  ('cheeks_v1', 1,
   'HIFU / radiofrequency (clinic) — firms existing curve',
   'HIFU / radiofréquence (cabinet) — raffermit une courbe existante',
   'Focused ultrasound stimulates deep collagen. Refines an existing Ogee curve; does not create volume where there is none.',
   'Ultrasons focalisés stimulent le collagène profond. Réaffirme une courbe existante ; ne crée pas de volume là où il n''y en a pas.'),
  ('cheeks_v1', 2,
   'HA dermal fillers — primary tool for Ogee sculpting',
   'Fillers AH — outil principal pour sculpter l''Ogee',
   'Most direct medical solution for cheek projection and curve definition.',
   'Solution médicale la plus directe pour la projection et la définition des joues.'),
  ('cheeks_v1', 3,
   'HIFU complements fillers — not a full substitute',
   'Le HIFU complète les fillers — pas un substitut complet',
   'Use together for tightening + volume; do not expect HIFU alone to replace filler where volume is missing.',
   'À combiner pour raffermir + volumiser ; le HIFU seul ne remplace pas le filler si le volume manque.');

INSERT INTO public.scoremax_protocol_preset_avoid
  (preset_id, position, title_en, title_fr, detail_en, detail_fr, severity)
VALUES
  ('cheeks_v1', 1,
   'Expecting HIFU alone to add cheek volume where there is none',
   'Attendre du volume des joues uniquement avec le HIFU',
   NULL, NULL, 'warn');

-- ---------------------------------------------------------------------------
-- eyes_v1
-- ---------------------------------------------------------------------------

INSERT INTO public.scoremax_protocol_presets (
  id, slug, target_worker, title_en, title_fr, summary_en, summary_fr, priority
) VALUES (
  'eyes_v1',
  'eyes',
  'eyes',
  'Eyes — dark circles & canthal tilt',
  'Yeux — cernes et canthal tilt',
  'Daily vascular-circle routine. Pigmented-circle actives. Medical options for hollows and canthal tilt.',
  'Routine quotidienne cernes vasculaires. Actifs cernes pigmentaires. Options médicales pour creux et canthal tilt.',
  25
)
ON CONFLICT (id) DO UPDATE SET
  title_en = EXCLUDED.title_en,
  title_fr = EXCLUDED.title_fr,
  summary_en = EXCLUDED.summary_en,
  summary_fr = EXCLUDED.summary_fr,
  priority = EXCLUDED.priority,
  enabled = true;

DELETE FROM public.scoremax_protocol_preset_steps WHERE preset_id = 'eyes_v1';
DELETE FROM public.scoremax_protocol_preset_always_on WHERE preset_id = 'eyes_v1';
DELETE FROM public.scoremax_protocol_preset_avoid WHERE preset_id = 'eyes_v1';

INSERT INTO public.scoremax_protocol_preset_steps
  (preset_id, slot, weekday_pattern, position, title_en, title_fr, detail_en, detail_fr)
VALUES
  ('eyes_v1', 'morning', '["all"]', 1,
   'Cold — chilled spoons or patches, 2–3 min',
   'Froid — cuillères au frigo ou patchs, 2–3 min',
   'Vasoconstriction for blue/purple (vascular) dark circles. Eyes closed.',
   'Vasoconstriction pour cernes bleus/violacés (vasculaires). Yeux fermés.'),
  ('eyes_v1', 'morning', '["all"]', 2,
   'Caffeine eye serum',
   'Sérum contour des yeux à caféine',
   'Apply before massage. Keep in fridge when possible (cold + caffeine + massage).',
   'Applique avant le massage. Garde au frigo si possible (froid + caféine + massage).'),
  ('eyes_v1', 'morning', '["all"]', 3,
   'Anti–dark circle massage — 3 to 5 min',
   'Massage anti-cernes — 3 à 5 min',
   'Never on dry skin. Tap inner→outer under eye ×5. Smooth inner corner→temple ×5 under eye + ×5 under brow.',
   'Jamais à sec. Tapote intérieur→extérieur sous l''œil ×5. Lisse coin interne→tempe ×5 sous l''œil + ×5 sous le sourcil.'),
  ('eyes_v1', 'morning', '["all"]', 4,
   'SPF around eye contour',
   'SPF autour du contour des yeux',
   'Essential for brown (pigmented) circles — blocks further melanin buildup.',
   'Indispensable pour cernes bruns (pigmentaires) — bloque l''accumulation de mélanine.'),
  ('eyes_v1', 'evening', '["all"]', 1,
   'Vitamin C or niacinamide eye serum',
   'Sérum yeux vitamine C ou niacinamide',
   'For brown/pigmented circles — blocks melanin production and lightens over time.',
   'Pour cernes bruns/marrons — inhibe la mélanine et éclaircit avec le temps.');

INSERT INTO public.scoremax_protocol_preset_always_on
  (preset_id, position, title_en, title_fr, detail_en, detail_fr)
VALUES
  ('eyes_v1', 1,
   'Vascular circles (blue/purple): cold + caffeine + massage',
   'Cernes vasculaires (bleus/violets) : froid + caféine + massage',
   'Most effective daily stack — forces blood and lymph to circulate.',
   'Stack quotidien le plus efficace — force la circulation sanguine et lymphatique.'),
  ('eyes_v1', 2,
   'Pigmented circles (brown): vitamin C + niacinamide + SPF',
   'Cernes pigmentaires (bruns) : vitamine C + niacinamide + SPF',
   'Hereditary or sun-driven melanin — creams can lighten; SPF prevents darkening.',
   'Mélanine héréditaire ou solaire — les crèmes éclaircissent ; le SPF empêche d''assombrir.'),
  ('eyes_v1', 3,
   'Hollow tear trough — creams cannot replace volume',
   'Cernes creux — les crèmes ne recréent pas de volume',
   'Structural shadow from fat loss. Medical option: HA filler in the tear trough.',
   'Ombre structurelle par fonte graisseuse. Option médicale : filler AH vallée des larmes.'),
  ('eyes_v1', 4,
   'Canthal tilt (durable) — medical only',
   'Canthal tilt (durable) — médical uniquement',
   'Thread lift (semi-permanent), canthopexy (tendon repositioned up), canthoplasty (permanent reattachment).',
   'Fils tenseurs (semi-permanent), canthopexie (tendon repositionné), canthoplastie (fixation permanente).');

INSERT INTO public.scoremax_protocol_preset_avoid
  (preset_id, position, title_en, title_fr, detail_en, detail_fr, severity)
VALUES
  ('eyes_v1', 1,
   'Massaging eye contour without serum or cream first',
   'Masser le contour des yeux sans sérum ou crème',
   'Skin is ~4× thinner — risk of stretching and micro-tears.',
   'Peau ~4× plus fine — risque d''étirement et de micro-lésions.',
   'warn'),
  ('eyes_v1', 2,
   'Rubbing eyes repeatedly',
   'Se frotter les yeux en boucle',
   'Worsens pigmented circles and irritates thin skin.',
   'Aggrave les cernes pigmentaires et irrite la peau fine.',
   'warn'),
  ('eyes_v1', 3,
   'Sun exposure without SPF around eyes (pigmented circles)',
   'Soleil sans SPF autour des yeux (cernes pigmentaires)',
   NULL, NULL, 'warn'),
  ('eyes_v1', 4,
   'Expecting creams alone to fill hollow tear troughs',
   'Attendre que les crèmes comblent un creux sous l''œil',
   NULL, NULL, 'danger');

COMMIT;
