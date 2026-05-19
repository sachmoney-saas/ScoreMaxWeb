-- ============================================================================
-- ScoreMax — Softmaxxing recommendations seed for all face workers
--
-- Run after:
--   1. supabase/recommendations_schema.sql
--
-- Idempotent: safe to re-run. Uses stable IDs and ON CONFLICT updates content
-- in place without breaking existing user actions.
-- ============================================================================

-- Self-heal protocol placement support so the seed can run even when
-- recommendations_protocol_slots_migration.sql has not been applied yet.
ALTER TABLE IF EXISTS public.scoremax_recommendations
  ADD COLUMN IF NOT EXISTS protocol_slots TEXT[] NOT NULL DEFAULT ARRAY[]::text[];

ALTER TABLE IF EXISTS public.scoremax_recommendations
  DROP CONSTRAINT IF EXISTS scoremax_recommendations_protocol_slots_check;

ALTER TABLE IF EXISTS public.scoremax_recommendations
  ADD CONSTRAINT scoremax_recommendations_protocol_slots_check
  CHECK (
    protocol_slots <@ ARRAY[
      'morning', 'midday', 'evening', 'night', 'weekly', 'general', 'avoid'
    ]::text[]
  );

CREATE INDEX IF NOT EXISTS scoremax_recommendations_protocol_slots_idx
  ON public.scoremax_recommendations
  USING GIN (protocol_slots);

WITH raw AS (
  SELECT *
  FROM jsonb_to_recordset($scoremax_soft_recs$
[
  {
    "id": "age.sleep_collagen_recovery",
    "worker": "age",
    "type": "soft",
    "category": "habit",
    "priority": 82,
    "title_en": "Sleep rhythm for younger facial recovery",
    "title_fr": "Rythme de sommeil pour récupération faciale",
    "summary_en": "A stable sleep window improves periorbital freshness, skin plumpness and the softer recovery cues that make the face read younger.",
    "summary_fr": "Une fenêtre de sommeil stable améliore la fraîcheur péri-orbitaire, le rebond cutané et les signaux de récupération qui rajeunissent le visage.",
    "steps": [
      { "en": "Keep wake-up and sleep time within the same 45-minute window.", "fr": "Garde lever et coucher dans une fenêtre de 45 minutes." },
      { "en": "Stop bright screens 45 minutes before bed and sleep slightly elevated.", "fr": "Coupe les écrans lumineux 45 minutes avant et dors légèrement surélevé." }
    ],
    "duration_value": 8,
    "duration_unit": "weeks",
    "cost_min": 0,
    "cost_max": 40,
    "cost_currency": "EUR",
    "risk": "none",
    "evidence": "studies",
    "targets": ["skin_quality_and_plumpness.periorbital_freshness", "skin_quality_and_plumpness.epidermal_plumpness_baby_skin"],
    "conditions": { "or": [
      { "score_lte": { "key": "skin_quality_and_plumpness.periorbital_freshness", "value": 7 } },
      { "score_lte": { "key": "skin_quality_and_plumpness.epidermal_plumpness_baby_skin", "value": 7 } }
    ] },
    "source_url": null,
    "protocol_slots": ["night", "general"],
    "enabled": true
  },
  {
    "id": "age.protein_resistance_training",
    "worker": "age",
    "type": "soft",
    "category": "nutrition",
    "priority": 76,
    "title_en": "Protein + resistance training base",
    "title_fr": "Base protéines + musculation",
    "summary_en": "Protein intake and resistance training keep the lower face firm while weight changes happen, preventing the soft depleted look.",
    "summary_fr": "Protéines et musculation gardent le bas du visage ferme pendant les variations de poids, pour éviter l'effet vidé ou mou.",
    "steps": [
      { "en": "Hit a consistent protein target at every meal.", "fr": "Mets une source de protéines solide à chaque repas." },
      { "en": "Train full body 3 times per week and track strength, not just weight.", "fr": "Fais 3 séances full-body par semaine et suis la force, pas seulement le poids." }
    ],
    "duration_value": 12,
    "duration_unit": "weeks",
    "cost_min": 0,
    "cost_max": 80,
    "cost_currency": "EUR",
    "risk": "none",
    "evidence": "studies",
    "targets": ["facial_neoteny_and_fat.lower_face_softness", "facial_neoteny_and_fat.juvenile_fat_retention_roundness"],
    "conditions": { "score_lte": { "key": "facial_neoteny_and_fat.lower_face_softness", "value": 7 } },
    "source_url": null,
    "protocol_slots": ["general", "weekly"],
    "enabled": true
  },
  {
    "id": "symmetry_shape.back_sleep_symmetry",
    "worker": "symmetry_shape",
    "type": "soft",
    "category": "habit",
    "priority": 74,
    "title_en": "Back-sleeping symmetry reset",
    "title_fr": "Reset symétrie en dormant sur le dos",
    "summary_en": "Reducing side pressure at night limits daily compression asymmetry on cheeks, brows, mouth and jaw.",
    "summary_fr": "Réduire la pression latérale la nuit limite les asymétries de compression sur joues, sourcils, bouche et mâchoire.",
    "steps": [
      { "en": "Use a supportive pillow and place small side cushions to stay on your back.", "fr": "Utilise un oreiller stable et deux petits coussins latéraux pour rester sur le dos." },
      { "en": "Take one relaxed front photo every 2 weeks to monitor asymmetry.", "fr": "Prends une photo de face détendue toutes les 2 semaines pour suivre l'asymétrie." }
    ],
    "duration_value": 8,
    "duration_unit": "weeks",
    "cost_min": 0,
    "cost_max": 60,
    "cost_currency": "EUR",
    "risk": "none",
    "evidence": "community",
    "targets": ["symmetry.cheekbone_balance", "symmetry.mouth_symmetry", "symmetry.jaw_chin_midline"],
    "conditions": { "or": [
      { "score_lte": { "key": "symmetry.cheekbone_balance", "value": 7 } },
      { "score_lte": { "key": "symmetry.mouth_symmetry", "value": 7 } },
      { "score_lte": { "key": "symmetry.jaw_chin_midline", "value": 7 } }
    ] },
    "source_url": null,
    "protocol_slots": ["night", "general"],
    "enabled": true
  },
  {
    "id": "symmetry_shape.face_shape_haircut",
    "worker": "symmetry_shape",
    "type": "soft",
    "category": "cosmetic",
    "priority": 68,
    "title_en": "Face-shape haircut framing",
    "title_fr": "Coupe adaptée à la forme du visage",
    "summary_en": "A haircut can visually rebalance forehead, cheek and jaw width hierarchy without changing the underlying structure.",
    "summary_fr": "Une coupe peut rééquilibrer visuellement la hiérarchie front-pommettes-mâchoire sans modifier la structure.",
    "steps": [
      { "en": "Choose volume where your face is visually narrow, and remove volume where it is wide.", "fr": "Ajoute du volume là où le visage paraît étroit, retire-en là où il paraît large." },
      { "en": "Bring a straight-on photo to your barber and ask for width balancing.", "fr": "Apporte une photo de face au coiffeur et demande un équilibrage des largeurs." }
    ],
    "duration_value": 1,
    "duration_unit": "session",
    "cost_min": 20,
    "cost_max": 80,
    "cost_currency": "EUR",
    "risk": "low",
    "evidence": "community",
    "targets": ["face_shape.forehead_vs_jaw_ratio", "face_shape.face_length_vs_width_ratio", "proportions.horizontal_fifths_balance"],
    "conditions": { "or": [
      { "score_lte": { "key": "face_shape.forehead_vs_jaw_ratio", "value": 7 } },
      { "score_lte": { "key": "face_shape.face_length_vs_width_ratio", "value": 7 } }
    ] },
    "source_url": null,
    "protocol_slots": ["weekly"],
    "enabled": true
  },
  {
    "id": "bodyfat.sodium_water_retention_control",
    "worker": "bodyfat",
    "type": "soft",
    "category": "nutrition",
    "priority": 80,
    "title_en": "Sodium and water retention control",
    "title_fr": "Contrôle sodium et rétention d'eau",
    "summary_en": "Even without fat loss, controlling sodium, hydration and late meals can sharpen the jaw and reduce morning puffiness.",
    "summary_fr": "Même sans perte de gras, contrôler sodium, hydratation et repas tardifs peut affiner la mâchoire et réduire le visage gonflé le matin.",
    "steps": [
      { "en": "Keep salty meals earlier in the day and drink water consistently.", "fr": "Garde les repas salés plus tôt dans la journée et bois régulièrement." },
      { "en": "Track morning face puffiness for 14 days after changing dinner timing.", "fr": "Suis le gonflement du matin pendant 14 jours après avoir avancé le dîner." }
    ],
    "duration_value": 2,
    "duration_unit": "weeks",
    "cost_min": 0,
    "cost_max": 20,
    "cost_currency": "EUR",
    "risk": "none",
    "evidence": "community",
    "targets": ["water_retention_flag.level", "lower_face_neck.jawline_definition", "upper_face_skin.periocular_leanness"],
    "conditions": { "or": [
      { "enum_in": { "key": "water_retention_flag.level", "values": ["mild", "moderate", "elevated", "high"] } },
      { "score_lte": { "key": "upper_face_skin.periocular_leanness", "value": 6 } }
    ] },
    "source_url": null,
    "protocol_slots": ["general", "evening"],
    "enabled": true
  },
  {
    "id": "bodyfat.calorie_steps_leanness_plan",
    "worker": "bodyfat",
    "type": "soft",
    "category": "exercise",
    "priority": 78,
    "title_en": "Leanness plan: steps + deficit",
    "title_fr": "Plan sèche : pas + déficit léger",
    "summary_en": "A sustainable step target and mild calorie deficit improve facial angularity without crashing energy or skin quality.",
    "summary_fr": "Un objectif de pas et un déficit léger améliorent l'angularité faciale sans casser énergie ni qualité de peau.",
    "steps": [
      { "en": "Add 2,000 daily steps above your current baseline.", "fr": "Ajoute 2 000 pas quotidiens à ta base actuelle." },
      { "en": "Use a small deficit and keep protein high to preserve structure.", "fr": "Garde un déficit léger et des protéines hautes pour préserver la structure." }
    ],
    "duration_value": 8,
    "duration_unit": "weeks",
    "cost_min": 0,
    "cost_max": 0,
    "cost_currency": "EUR",
    "risk": "low",
    "evidence": "studies",
    "targets": ["global_estimation.facial_leanness_score", "lower_face_neck.jawline_definition", "upper_face_skin.facial_angularity"],
    "conditions": { "or": [
      { "score_lte": { "key": "global_estimation.facial_leanness_score", "value": 6 } },
      { "score_lte": { "key": "upper_face_skin.facial_angularity", "value": 6 } }
    ] },
    "source_url": null,
    "protocol_slots": ["general", "weekly"],
    "enabled": true
  },
  {
    "id": "eyes.screen_break_blink_hygiene",
    "worker": "eyes",
    "type": "soft",
    "category": "habit",
    "priority": 64,
    "title_en": "Screen breaks and blink hygiene",
    "title_fr": "Pauses écran et hygiène du clignement",
    "summary_en": "Screen fatigue dries the eyes and dulls sclera clarity; intentional breaks keep the gaze fresher.",
    "summary_fr": "La fatigue écran assèche les yeux et ternit la sclère ; des pauses volontaires gardent un regard plus frais.",
    "steps": [
      { "en": "Use a 20-second distance focus break every 20 minutes.", "fr": "Fais une pause de focalisation lointaine 20 secondes toutes les 20 minutes." },
      { "en": "Blink deliberately 10 times during each break.", "fr": "Cligne volontairement 10 fois pendant chaque pause." }
    ],
    "duration_value": 4,
    "duration_unit": "weeks",
    "cost_min": 0,
    "cost_max": 0,
    "cost_currency": "EUR",
    "risk": "none",
    "evidence": "studies",
    "targets": ["iris_sclera_and_lashes.sclera_clarity", "under_eye_health.under_eye_pigmentation"],
    "conditions": { "score_lte": { "key": "iris_sclera_and_lashes.sclera_clarity", "value": 7 } },
    "source_url": null,
    "protocol_slots": ["general", "midday"],
    "enabled": true
  },
  {
    "id": "eyes.allergy_puffiness_control",
    "worker": "eyes",
    "type": "soft",
    "category": "habit",
    "priority": 66,
    "title_en": "Allergy and puffiness control",
    "title_fr": "Contrôle allergies et poches",
    "summary_en": "Reducing itch and rubbing protects the eyelids, sclera and under-eye support from chronic irritation.",
    "summary_fr": "Réduire démangeaisons et frottements protège paupières, sclère et support sous-œil de l'irritation chronique.",
    "steps": [
      { "en": "Rinse face and lashes after pollen, dust or gym exposure.", "fr": "Rince visage et cils après pollen, poussière ou sport." },
      { "en": "Keep a cold compress routine for high-puffiness mornings.", "fr": "Garde une routine compresse froide pour les matins gonflés." }
    ],
    "duration_value": 4,
    "duration_unit": "weeks",
    "cost_min": 0,
    "cost_max": 25,
    "cost_currency": "EUR",
    "risk": "low",
    "evidence": "community",
    "targets": ["under_eye_health.under_eye_support", "iris_sclera_and_lashes.sclera_clarity"],
    "conditions": { "or": [
      { "score_lte": { "key": "under_eye_health.under_eye_support", "value": 7 } },
      { "score_lte": { "key": "iris_sclera_and_lashes.sclera_clarity", "value": 7 } }
    ] },
    "source_url": null,
    "protocol_slots": ["morning", "general"],
    "enabled": true
  },
  {
    "id": "cheeks.lymphatic_de_puff_massage",
    "worker": "cheeks",
    "type": "soft",
    "category": "exercise",
    "priority": 70,
    "title_en": "Cheek lymphatic de-puff massage",
    "title_fr": "Massage lymphatique des joues",
    "summary_en": "Light lymphatic strokes can reduce cheek puffiness and make cheekbone structure read cleaner.",
    "summary_fr": "Des gestes lymphatiques légers peuvent réduire les joues gonflées et rendre les pommettes plus lisibles.",
    "steps": [
      { "en": "Use light pressure from nose side toward ears, then down the neck.", "fr": "Pression légère du nez vers les oreilles, puis vers le cou." },
      { "en": "Do it 60 seconds in the morning, always with clean hands.", "fr": "Fais-le 60 secondes le matin, toujours mains propres." }
    ],
    "duration_value": 4,
    "duration_unit": "weeks",
    "cost_min": 0,
    "cost_max": 15,
    "cost_currency": "EUR",
    "risk": "none",
    "evidence": "community",
    "targets": ["profile_structure.ogee_curve", "frontal_structure.malar_eminence_prominence", "harmony.midface_dominance"],
    "conditions": { "or": [
      { "score_lte": { "key": "profile_structure.ogee_curve", "value": 6 } },
      { "score_lte": { "key": "frontal_structure.malar_eminence_prominence", "value": 6 } }
    ] },
    "source_url": null,
    "protocol_slots": ["morning"],
    "enabled": true
  },
  {
    "id": "cheeks.cheekbone_lighting_grooming",
    "worker": "cheeks",
    "type": "soft",
    "category": "cosmetic",
    "priority": 58,
    "title_en": "Cheekbone-enhancing grooming",
    "title_fr": "Grooming qui révèle les pommettes",
    "summary_en": "Haircut, beard fade or subtle grooming can create contrast under the cheekbone and make malar structure more visible.",
    "summary_fr": "Coupe, dégradé de barbe ou grooming subtil créent du contraste sous la pommette et rendent la structure malaire plus visible.",
    "steps": [
      { "en": "Keep volume away from the mid-cheek if cheeks look soft.", "fr": "Évite le volume au milieu des joues si elles paraissent molles." },
      { "en": "Use a cleaner sideburn or beard fade to reveal the cheek plane.", "fr": "Utilise une patte ou barbe mieux fondue pour révéler le plan de la joue." }
    ],
    "duration_value": 1,
    "duration_unit": "session",
    "cost_min": 20,
    "cost_max": 80,
    "cost_currency": "EUR",
    "risk": "none",
    "evidence": "community",
    "targets": ["frontal_structure.bizygomatic_width", "profile_structure.cheekbone_height_peak"],
    "conditions": { "score_lte": { "key": "profile_structure.cheekbone_height_peak", "value": 7 } },
    "source_url": null,
    "protocol_slots": ["weekly"],
    "enabled": true
  },
  {
    "id": "chin.posture_labiomental_reset",
    "worker": "chin",
    "type": "soft",
    "category": "exercise",
    "priority": 70,
    "title_en": "Chin posture reset",
    "title_fr": "Reset posture du menton",
    "summary_en": "Neck and jaw posture can make chin projection and lower-face integration read sharper in everyday photos.",
    "summary_fr": "La posture cou/mâchoire peut rendre projection du menton et intégration du bas du visage plus nettes au quotidien.",
    "steps": [
      { "en": "Do 10 chin tucks twice per day with a long neck.", "fr": "Fais 10 chin tucks deux fois par jour avec le cou long." },
      { "en": "Keep lips sealed and jaw relaxed at rest.", "fr": "Garde les lèvres fermées et la mâchoire détendue au repos." }
    ],
    "duration_value": 6,
    "duration_unit": "weeks",
    "cost_min": 0,
    "cost_max": 0,
    "cost_currency": "EUR",
    "risk": "none",
    "evidence": "community",
    "targets": ["projection_and_profile.chin_projection", "width_and_integration.lower_face_integration"],
    "conditions": { "or": [
      { "score_lte": { "key": "projection_and_profile.chin_projection", "value": 6 } },
      { "score_lte": { "key": "width_and_integration.lower_face_integration", "value": 6 } }
    ] },
    "source_url": null,
    "protocol_slots": ["weekly", "general"],
    "enabled": true
  },
  {
    "id": "chin.beard_shadow_chin_width",
    "worker": "chin",
    "type": "soft",
    "category": "cosmetic",
    "priority": 58,
    "title_en": "Beard-shadow chin shaping",
    "title_fr": "Sculpture du menton par barbe/ombre",
    "summary_en": "For users with facial hair, strategic trimming can visually widen, square or lengthen the chin.",
    "summary_fr": "Avec pilosité faciale, une taille stratégique peut élargir, carréifier ou allonger visuellement le menton.",
    "steps": [
      { "en": "Keep the strongest density at the area you want to project.", "fr": "Garde la densité la plus forte sur la zone à projeter." },
      { "en": "Clean the neck line so the chin edge stays readable.", "fr": "Nettoie la ligne du cou pour garder le bord du menton lisible." }
    ],
    "duration_value": 1,
    "duration_unit": "session",
    "cost_min": 0,
    "cost_max": 35,
    "cost_currency": "EUR",
    "risk": "none",
    "evidence": "community",
    "targets": ["width_and_integration.chin_width", "shape_and_contour.chin_contour"],
    "conditions": { "or": [
      { "score_lte": { "key": "width_and_integration.chin_width", "value": 7 } },
      { "score_lte": { "key": "shape_and_contour.chin_contour", "value": 7 } }
    ] },
    "source_url": null,
    "protocol_slots": ["weekly"],
    "enabled": true
  },
  {
    "id": "coloring.personal_palette_calibration",
    "worker": "coloring",
    "type": "soft",
    "category": "cosmetic",
    "priority": 72,
    "title_en": "Personal color palette calibration",
    "title_fr": "Calibration palette personnelle",
    "summary_en": "Clothing colors near the face can boost skin clarity, eye contrast and overall facial coloring immediately.",
    "summary_fr": "Les couleurs portées près du visage peuvent booster immédiatement clarté de peau, contraste des yeux et colorimétrie globale.",
    "steps": [
      { "en": "Test white, cream, navy, black, olive and burgundy near your face in daylight.", "fr": "Teste blanc, crème, marine, noir, olive et bordeaux près du visage en lumière du jour." },
      { "en": "Keep the colors that make the eyes and skin look clearer, not just brighter.", "fr": "Garde les couleurs qui rendent yeux et peau plus nets, pas seulement plus lumineux." }
    ],
    "duration_value": 1,
    "duration_unit": "session",
    "cost_min": 0,
    "cost_max": 0,
    "cost_currency": "EUR",
    "risk": "none",
    "evidence": "community",
    "targets": ["contrast.overall_contrast_score", "skin.clarity", "eyes.whites_clarity"],
    "conditions": { "or": [
      { "score_lte": { "key": "contrast.overall_contrast_score", "value": 7 } },
      { "score_lte": { "key": "skin.clarity", "value": 7 } }
    ] },
    "source_url": null,
    "protocol_slots": ["general"],
    "enabled": true
  },
  {
    "id": "coloring.brow_lip_contrast_grooming",
    "worker": "coloring",
    "type": "soft",
    "category": "cosmetic",
    "priority": 68,
    "title_en": "Brow and lip contrast grooming",
    "title_fr": "Contraste sourcils et lèvres",
    "summary_en": "Small changes to brow depth and lip saturation can restore facial contrast without changing facial structure.",
    "summary_fr": "De petits ajustements sur la profondeur des sourcils et la saturation des lèvres peuvent restaurer le contraste sans changer la structure.",
    "steps": [
      { "en": "Brush brows and use a shade only one level deeper than natural.", "fr": "Brosse les sourcils et utilise une teinte seulement un ton plus profonde que le naturel." },
      { "en": "Use a tinted balm close to natural lip color for saturation.", "fr": "Utilise un baume teinté proche de la couleur naturelle pour saturer les lèvres." }
    ],
    "duration_value": 4,
    "duration_unit": "weeks",
    "cost_min": 10,
    "cost_max": 50,
    "cost_currency": "EUR",
    "risk": "low",
    "evidence": "community",
    "targets": ["eyebrows.contrast_vs_skin", "lips.saturation", "contrast.brows_vs_skin", "contrast.lips_vs_skin"],
    "conditions": { "or": [
      { "score_lte": { "key": "eyebrows.contrast_vs_skin", "value": 6 } },
      { "score_lte": { "key": "lips.saturation", "value": 6 } }
    ] },
    "source_url": null,
    "protocol_slots": ["morning"],
    "enabled": true
  },
  {
    "id": "neck.posture_mobility_stack",
    "worker": "neck",
    "type": "soft",
    "category": "exercise",
    "priority": 76,
    "title_en": "Neck posture mobility stack",
    "title_fr": "Stack mobilité posture du cou",
    "summary_en": "Daily neck mobility and deep-neck activation improve neck posture, length impression and jaw-neck transition.",
    "summary_fr": "Mobilité cervicale et activation profonde améliorent posture du cou, impression de longueur et transition mâchoire-cou.",
    "steps": [
      { "en": "Do 5 slow chin tucks, 5 side bends and 5 rotations morning and evening.", "fr": "Fais 5 chin tucks lents, 5 inclinaisons et 5 rotations matin et soir." },
      { "en": "Raise your phone and laptop to reduce forward-head posture.", "fr": "Remonte téléphone et ordinateur pour réduire la tête projetée." }
    ],
    "duration_value": 6,
    "duration_unit": "weeks",
    "cost_min": 0,
    "cost_max": 30,
    "cost_currency": "EUR",
    "risk": "none",
    "evidence": "community",
    "targets": ["posture_and_alignment.neck_posture", "dimensions_and_proportions.neck_length"],
    "conditions": { "or": [
      { "score_lte": { "key": "posture_and_alignment.neck_posture", "value": 7 } },
      { "score_lte": { "key": "dimensions_and_proportions.neck_length", "value": 6 } }
    ] },
    "source_url": null,
    "protocol_slots": ["morning", "evening"],
    "enabled": true
  },
  {
    "id": "neck.neck_skin_spf_barrier",
    "worker": "neck",
    "type": "soft",
    "category": "topical",
    "priority": 66,
    "title_en": "Neck SPF and barrier care",
    "title_fr": "SPF et barrière cutanée du cou",
    "summary_en": "The neck ages quickly when ignored; SPF and moisturiser preserve firmness and taper appearance.",
    "summary_fr": "Le cou vieillit vite quand il est oublié ; SPF et hydratation préservent fermeté et effet affiné.",
    "steps": [
      { "en": "Apply face SPF down to the collarbone every morning.", "fr": "Descends le SPF visage jusqu'aux clavicules chaque matin." },
      { "en": "Use a simple moisturiser at night if neck skin looks dry.", "fr": "Utilise un hydratant simple le soir si la peau du cou paraît sèche." }
    ],
    "duration_value": 12,
    "duration_unit": "weeks",
    "cost_min": 15,
    "cost_max": 50,
    "cost_currency": "EUR",
    "risk": "none",
    "evidence": "studies",
    "targets": ["musculature_and_soft_tissue.neck_firmness", "dimensions_and_proportions.neck_shape_and_taper"],
    "conditions": { "score_lte": { "key": "musculature_and_soft_tissue.neck_firmness", "value": 7 } },
    "source_url": null,
    "protocol_slots": ["morning", "night"],
    "enabled": true
  },
  {
    "id": "nose.nasal_surface_skincare",
    "worker": "nose",
    "type": "soft",
    "category": "topical",
    "priority": 70,
    "title_en": "Nasal surface refinement routine",
    "title_fr": "Routine refinement de surface nasale",
    "summary_en": "Controlling oil, blackheads and texture on the nose makes the bridge and tip look cleaner without structural intervention.",
    "summary_fr": "Contrôler sébum, points noirs et texture du nez rend arête et pointe plus propres sans intervention structurelle.",
    "steps": [
      { "en": "Use a BHA product on the nose 2 to 3 nights per week.", "fr": "Utilise un BHA sur le nez 2 à 3 soirs par semaine." },
      { "en": "Do not squeeze pores; use cleansing and patience.", "fr": "Ne presse pas les pores ; nettoyage et régularité." }
    ],
    "duration_value": 8,
    "duration_unit": "weeks",
    "cost_min": 12,
    "cost_max": 40,
    "cost_currency": "EUR",
    "risk": "low",
    "evidence": "studies",
    "targets": ["base_nostrils_and_surface.nasal_skin_surface", "tip_morphology.tip_definition"],
    "conditions": { "or": [
      { "score_lte": { "key": "tip_morphology.tip_definition", "value": 7 } },
      { "enum_in": { "key": "base_nostrils_and_surface.nasal_skin_surface", "values": ["textured", "oily", "rough", "congested"] } }
    ] },
    "source_url": null,
    "protocol_slots": ["evening"],
    "enabled": true
  },
  {
    "id": "nose.balance_with_glasses_hair",
    "worker": "nose",
    "type": "soft",
    "category": "cosmetic",
    "priority": 56,
    "title_en": "Nose balance with glasses and hair",
    "title_fr": "Équilibrer le nez avec lunettes et coupe",
    "summary_en": "Frame choice, brow volume and haircut can reduce nose dominance and improve midline harmony.",
    "summary_fr": "Choix de monture, volume sourcils et coupe peuvent réduire la dominance du nez et améliorer l'harmonie médiane.",
    "steps": [
      { "en": "Avoid frames narrower than the widest part of the nose.", "fr": "Évite les montures plus étroites que la partie la plus large du nez." },
      { "en": "Keep brow and hair volume balanced so the nose is not the only focal point.", "fr": "Garde sourcils et cheveux équilibrés pour que le nez ne soit pas le seul point focal." }
    ],
    "duration_value": 1,
    "duration_unit": "session",
    "cost_min": 0,
    "cost_max": 120,
    "cost_currency": "EUR",
    "risk": "none",
    "evidence": "community",
    "targets": ["frontal_symmetry_and_width.overall_alar_width", "profile_dorsum_and_angles.nasofrontal_angle"],
    "conditions": { "or": [
      { "score_lte": { "key": "frontal_symmetry_and_width.overall_alar_width", "value": 6 } },
      { "score_lte": { "key": "profile_dorsum_and_angles.nasofrontal_angle", "value": 6 } }
    ] },
    "source_url": null,
    "protocol_slots": ["general"],
    "enabled": true
  },
  {
    "id": "skin.barrier_repair_cleanser_moisturizer",
    "worker": "skin",
    "type": "soft",
    "category": "topical",
    "priority": 82,
    "title_en": "Barrier repair baseline",
    "title_fr": "Base réparation de barrière",
    "summary_en": "A gentle cleanser, moisturiser and SPF baseline often improves redness, hydration balance and surface smoothness before stronger actives.",
    "summary_fr": "Un nettoyant doux, hydratant et SPF améliorent souvent rougeurs, équilibre hydratation/sébum et lissage avant les actifs forts.",
    "steps": [
      { "en": "Use gentle cleanser at night; rinse with water in the morning if skin is dry.", "fr": "Nettoyant doux le soir ; eau le matin si la peau est sèche." },
      { "en": "Moisturise twice daily and apply SPF every morning.", "fr": "Hydrate matin/soir et applique SPF chaque matin." }
    ],
    "duration_value": 4,
    "duration_unit": "weeks",
    "cost_min": 20,
    "cost_max": 70,
    "cost_currency": "EUR",
    "risk": "none",
    "evidence": "studies",
    "targets": ["hydration_and_vitality.sebum_hydration_balance", "pigmentation_tone_and_redness.redness_and_erythema", "texture_pores_and_congestion.surface_smoothness"],
    "conditions": { "or": [
      { "score_lte": { "key": "hydration_and_vitality.sebum_hydration_balance", "value": 7 } },
      { "score_lte": { "key": "pigmentation_tone_and_redness.redness_and_erythema", "value": 7 } }
    ] },
    "source_url": null,
    "protocol_slots": ["morning", "evening"],
    "enabled": true
  },
  {
    "id": "skin.bha_niacinamide_congestion",
    "worker": "skin",
    "type": "soft",
    "category": "topical",
    "priority": 78,
    "title_en": "BHA + niacinamide congestion routine",
    "title_fr": "Routine BHA + niacinamide anti-congestion",
    "summary_en": "BHA helps blackheads and pore congestion; niacinamide supports oil balance and calmer tone.",
    "summary_fr": "Le BHA aide points noirs et congestion ; la niacinamide soutient équilibre sébum et teint plus calme.",
    "steps": [
      { "en": "Use BHA 2 nights per week, then increase only if skin stays calm.", "fr": "BHA 2 soirs par semaine, puis augmente seulement si la peau reste calme." },
      { "en": "Use niacinamide on non-irritated skin, before moisturiser.", "fr": "Niacinamide sur peau non irritée, avant hydratant." }
    ],
    "duration_value": 8,
    "duration_unit": "weeks",
    "cost_min": 20,
    "cost_max": 70,
    "cost_currency": "EUR",
    "risk": "low",
    "evidence": "studies",
    "targets": ["texture_pores_and_congestion.blackheads_and_congestion", "texture_pores_and_congestion.pore_size_and_visibility", "acne_and_scarring.active_acne"],
    "conditions": { "or": [
      { "score_lte": { "key": "texture_pores_and_congestion.blackheads_and_congestion", "value": 7 } },
      { "score_lte": { "key": "texture_pores_and_congestion.pore_size_and_visibility", "value": 7 } }
    ] },
    "source_url": null,
    "protocol_slots": ["evening"],
    "enabled": true
  },
  {
    "id": "smile.whitening_hygiene_stack",
    "worker": "smile",
    "type": "soft",
    "category": "habit",
    "priority": 78,
    "title_en": "Whitening hygiene stack",
    "title_fr": "Stack hygiène blancheur",
    "summary_en": "Consistent brushing, flossing and stain control improve tooth whiteness and surface integrity without cosmetic dentistry.",
    "summary_fr": "Brossage, fil dentaire et contrôle des taches améliorent blancheur et surface sans dentisterie esthétique.",
    "steps": [
      { "en": "Brush 2 minutes morning and night with an electric brush if possible.", "fr": "Brosse 2 minutes matin et soir, idéalement avec brosse électrique." },
      { "en": "Floss at night and rinse after coffee or dark drinks.", "fr": "Fil dentaire le soir et rinçage après café ou boissons foncées." }
    ],
    "duration_value": 6,
    "duration_unit": "weeks",
    "cost_min": 5,
    "cost_max": 80,
    "cost_currency": "EUR",
    "risk": "none",
    "evidence": "medical",
    "targets": ["dental_quality.shade_and_whiteness", "dental_quality.surface_integrity"],
    "conditions": { "or": [
      { "score_lte": { "key": "dental_quality.shade_and_whiteness", "value": 7 } },
      { "score_lte": { "key": "dental_quality.surface_integrity", "value": 7 } }
    ] },
    "source_url": null,
    "protocol_slots": ["morning", "night"],
    "enabled": true
  },
  {
    "id": "smile.smile_symmetry_practice",
    "worker": "smile",
    "type": "soft",
    "category": "exercise",
    "priority": 60,
    "title_en": "Smile symmetry practice",
    "title_fr": "Entraînement symétrie du sourire",
    "summary_en": "Short mirror practice can improve smile control, Duchenne activation and photo consistency.",
    "summary_fr": "Un entraînement court au miroir peut améliorer contrôle du sourire, activation Duchenne et constance en photo.",
    "steps": [
      { "en": "Practice 5 relaxed smiles and 5 full smiles in front of a mirror.", "fr": "Pratique 5 sourires détendus et 5 sourires complets devant miroir." },
      { "en": "Focus on equal corner lift and relaxed eyes.", "fr": "Concentre-toi sur une montée égale des commissures et des yeux détendus." }
    ],
    "duration_value": 4,
    "duration_unit": "weeks",
    "cost_min": 0,
    "cost_max": 0,
    "cost_currency": "EUR",
    "risk": "none",
    "evidence": "community",
    "targets": ["smile_dynamics.smile_symmetry", "facial_impact.duchenne_activation"],
    "conditions": { "score_lte": { "key": "smile_dynamics.smile_symmetry", "value": 7 } },
    "source_url": null,
    "protocol_slots": ["weekly"],
    "enabled": true
  },
  {
    "id": "skin_tint.spf_antioxidant_glow",
    "worker": "skin_tint",
    "type": "soft",
    "category": "topical",
    "priority": 80,
    "title_en": "SPF + antioxidant glow routine",
    "title_fr": "Routine glow SPF + antioxydant",
    "summary_en": "Daily SPF plus antioxidant support protects radiance, reduces uneven pigment and keeps tone consistent.",
    "summary_fr": "SPF quotidien et antioxydant protègent l'éclat, réduisent les pigments irréguliers et stabilisent le teint.",
    "steps": [
      { "en": "Apply SPF every morning and reapply when outdoors.", "fr": "Applique SPF chaque matin et renouvelle en extérieur." },
      { "en": "Use a vitamin C or antioxidant serum if your skin tolerates it.", "fr": "Utilise vitamine C ou sérum antioxydant si ta peau le tolère." }
    ],
    "duration_value": 12,
    "duration_unit": "weeks",
    "cost_min": 25,
    "cost_max": 90,
    "cost_currency": "EUR",
    "risk": "low",
    "evidence": "studies",
    "targets": ["vitality_and_radiance.color_radiance_glow", "pigment_distribution.melanin_uniformity", "sun_exposure_aesthetic.tan_uniformity"],
    "conditions": { "or": [
      { "score_lte": { "key": "vitality_and_radiance.color_radiance_glow", "value": 7 } },
      { "score_lte": { "key": "pigment_distribution.melanin_uniformity", "value": 7 } }
    ] },
    "source_url": null,
    "protocol_slots": ["morning", "midday"],
    "enabled": true
  },
  {
    "id": "skin_tint.controlled_tan_strategy",
    "worker": "skin_tint",
    "type": "soft",
    "category": "cosmetic",
    "priority": 62,
    "title_en": "Controlled tan and tone strategy",
    "title_fr": "Stratégie bronzage contrôlé et teint",
    "summary_en": "A controlled self-tan or bronzing strategy can improve tone harmony without uneven UV exposure.",
    "summary_fr": "Un autobronzant ou bronzing contrôlé peut améliorer l'harmonie du teint sans exposition UV irrégulière.",
    "steps": [
      { "en": "Patch-test self-tan and build color gradually.", "fr": "Teste l'autobronzant et construis la couleur progressivement." },
      { "en": "Blend into neck and ears so the face does not look isolated.", "fr": "Dégrade dans le cou et les oreilles pour éviter un visage isolé." }
    ],
    "duration_value": 4,
    "duration_unit": "weeks",
    "cost_min": 10,
    "cost_max": 45,
    "cost_currency": "EUR",
    "risk": "low",
    "evidence": "community",
    "targets": ["sun_exposure_aesthetic.tan_phototype_harmony", "sun_exposure_aesthetic.tan_uniformity", "global_score.overall_colorimetry_score"],
    "conditions": { "or": [
      { "score_lte": { "key": "sun_exposure_aesthetic.tan_phototype_harmony", "value": 7 } },
      { "score_lte": { "key": "sun_exposure_aesthetic.tan_uniformity", "value": 7 } }
    ] },
    "source_url": null,
    "protocol_slots": ["weekly"],
    "enabled": true
  },
  {
    "id": "eye_brows.shape_mapping_grooming",
    "worker": "eye_brows",
    "type": "soft",
    "category": "cosmetic",
    "priority": 78,
    "title_en": "Brow shape mapping and grooming",
    "title_fr": "Mapping et grooming des sourcils",
    "summary_en": "Mapping the start, arch and tail cleans brow symmetry and improves eye framing immediately.",
    "summary_fr": "Mapper départ, arche et queue nettoie la symétrie des sourcils et améliore immédiatement le cadre du regard.",
    "steps": [
      { "en": "Brush brows upward and remove only clear outliers below the line.", "fr": "Brosse vers le haut et retire seulement les poils clairement hors ligne." },
      { "en": "Keep the tail long enough to frame the outer eye.", "fr": "Garde une queue assez longue pour cadrer l'extérieur de l'œil." }
    ],
    "duration_value": 1,
    "duration_unit": "session",
    "cost_min": 0,
    "cost_max": 30,
    "cost_currency": "EUR",
    "risk": "low",
    "evidence": "community",
    "targets": ["placement_and_symmetry.eyebrow_symmetry", "geometry_and_shape.tail_length_and_direction", "density_grooming_and_glabella.grooming_quality"],
    "conditions": { "or": [
      { "score_lte": { "key": "placement_and_symmetry.eyebrow_symmetry", "value": 7 } },
      { "score_lte": { "key": "geometry_and_shape.tail_length_and_direction", "value": 7 } }
    ] },
    "source_url": null,
    "protocol_slots": ["weekly"],
    "enabled": true
  },
  {
    "id": "eye_brows.tint_depth_boost",
    "worker": "eye_brows",
    "type": "soft",
    "category": "cosmetic",
    "priority": 66,
    "title_en": "Brow tint depth boost",
    "title_fr": "Teinture légère des sourcils",
    "summary_en": "A subtle brow tint increases density and contrast when brows look sparse or too light.",
    "summary_fr": "Une teinture subtile augmente densité et contraste quand les sourcils paraissent clairsemés ou trop clairs.",
    "steps": [
      { "en": "Choose one shade deeper than natural, not black by default.", "fr": "Choisis un ton plus profond que le naturel, pas noir par défaut." },
      { "en": "Patch-test and refresh every 3 to 5 weeks.", "fr": "Fais un test cutané et renouvelle toutes les 3 à 5 semaines." }
    ],
    "duration_value": 4,
    "duration_unit": "weeks",
    "cost_min": 10,
    "cost_max": 40,
    "cost_currency": "EUR",
    "risk": "low",
    "evidence": "community",
    "targets": ["density_grooming_and_glabella.eyebrow_density", "density_grooming_and_glabella.eyebrow_thickness", "density_grooming_and_glabella.brow_color"],
    "conditions": { "or": [
      { "score_lte": { "key": "density_grooming_and_glabella.eyebrow_density", "value": 6 } },
      { "score_lte": { "key": "density_grooming_and_glabella.eyebrow_thickness", "value": 6 } }
    ] },
    "source_url": null,
    "protocol_slots": ["weekly"],
    "enabled": true
  },
  {
    "id": "hair.haircut_control_consult",
    "worker": "hair",
    "type": "soft",
    "category": "cosmetic",
    "priority": 80,
    "title_en": "Haircut control consultation",
    "title_fr": "Consultation maîtrise de coupe",
    "summary_en": "A face-aware haircut can improve grooming quality, frame shape and perceived hair density faster than any product.",
    "summary_fr": "Une coupe adaptée au visage améliore grooming, cadrage et densité perçue plus vite que n'importe quel produit.",
    "steps": [
      { "en": "Bring front and side photos; ask for a cut that supports your face shape.", "fr": "Apporte photos face/profil ; demande une coupe qui soutient ta forme de visage." },
      { "en": "Set a repeat schedule before the cut loses shape.", "fr": "Fixe une fréquence de retouche avant que la coupe perde sa forme." }
    ],
    "duration_value": 1,
    "duration_unit": "session",
    "cost_min": 20,
    "cost_max": 80,
    "cost_currency": "EUR",
    "risk": "none",
    "evidence": "community",
    "targets": ["grooming_and_haircut.haircut_control", "grooming_and_haircut.grooming_quality", "hairline.symmetry"],
    "conditions": { "or": [
      { "score_lte": { "key": "grooming_and_haircut.haircut_control", "value": 7 } },
      { "score_lte": { "key": "grooming_and_haircut.grooming_quality", "value": 7 } }
    ] },
    "source_url": null,
    "protocol_slots": ["weekly"],
    "enabled": true
  },
  {
    "id": "hair.scalp_health_wash_condition",
    "worker": "hair",
    "type": "soft",
    "category": "habit",
    "priority": 72,
    "title_en": "Scalp and hair health routine",
    "title_fr": "Routine santé cuir chevelu et cheveux",
    "summary_en": "A consistent wash, condition and scalp-care cadence improves shine, dryness and health appearance.",
    "summary_fr": "Une cadence lavage, soin et cuir chevelu améliore brillance, sécheresse et apparence de santé capillaire.",
    "steps": [
      { "en": "Wash based on scalp oil, not a random fixed rule.", "fr": "Lave selon le sébum du cuir chevelu, pas une règle arbitraire." },
      { "en": "Condition lengths and use low heat when drying.", "fr": "Après-shampoing sur les longueurs et chaleur basse au séchage." }
    ],
    "duration_value": 6,
    "duration_unit": "weeks",
    "cost_min": 15,
    "cost_max": 60,
    "cost_currency": "EUR",
    "risk": "none",
    "evidence": "community",
    "targets": ["hair_quality_and_health.shine_and_dryness", "hair_quality_and_health.health_appearance", "hair_quality_and_health.uniformity"],
    "conditions": { "or": [
      { "score_lte": { "key": "hair_quality_and_health.shine_and_dryness", "value": 7 } },
      { "score_lte": { "key": "hair_quality_and_health.health_appearance", "value": 7 } }
    ] },
    "source_url": null,
    "protocol_slots": ["weekly", "general"],
    "enabled": true
  },
  {
    "id": "jaw.posture_leanness_jawline",
    "worker": "jaw",
    "type": "soft",
    "category": "exercise",
    "priority": 74,
    "title_en": "Jawline posture and leanness stack",
    "title_fr": "Stack posture et sèche jawline",
    "summary_en": "Neck posture, lower-face leanness and relaxed jaw position make jaw width and length read cleaner.",
    "summary_fr": "Posture du cou, sèche du bas du visage et mâchoire détendue rendent largeur et longueur mandibulaire plus nettes.",
    "steps": [
      { "en": "Do chin tucks and keep tongue resting high without clenching.", "fr": "Fais des chin tucks et garde la langue haute sans serrer les dents." },
      { "en": "Pair with daily steps and sodium control if the jawline looks soft.", "fr": "Associe pas quotidiens et contrôle sodium si la jawline paraît douce." }
    ],
    "duration_value": 8,
    "duration_unit": "weeks",
    "cost_min": 0,
    "cost_max": 0,
    "cost_currency": "EUR",
    "risk": "none",
    "evidence": "community",
    "targets": ["frontal_geometry.jaw_width", "profile_architecture.jawline_length", "frontal_geometry.jaw_to_face_proportion"],
    "conditions": { "or": [
      { "score_lte": { "key": "profile_architecture.jawline_length", "value": 6 } },
      { "score_lte": { "key": "frontal_geometry.jaw_to_face_proportion", "value": 6 } }
    ] },
    "source_url": null,
    "protocol_slots": ["weekly", "general"],
    "enabled": true
  },
  {
    "id": "jaw.beard_fade_gonial_shadow",
    "worker": "jaw",
    "type": "soft",
    "category": "cosmetic",
    "priority": 66,
    "title_en": "Beard fade for gonial shadow",
    "title_fr": "Dégradé de barbe pour ombre goniale",
    "summary_en": "A controlled beard fade can create a sharper mandibular border and improve perceived gonial symmetry.",
    "summary_fr": "Un dégradé de barbe contrôlé peut créer un bord mandibulaire plus net et améliorer la symétrie goniale perçue.",
    "steps": [
      { "en": "Keep density under the mandibular angle and clean the neck line.", "fr": "Garde la densité sous l'angle mandibulaire et nettoie la ligne du cou." },
      { "en": "Avoid rounding the jaw corner with too high a fade.", "fr": "Évite d'arrondir l'angle avec un dégradé trop haut." }
    ],
    "duration_value": 1,
    "duration_unit": "session",
    "cost_min": 0,
    "cost_max": 40,
    "cost_currency": "EUR",
    "risk": "none",
    "evidence": "community",
    "targets": ["symmetry_and_flare.gonial_flare_symmetry", "symmetry_and_flare.jaw_symmetry", "frontal_geometry.jaw_width"],
    "conditions": { "or": [
      { "score_lte": { "key": "symmetry_and_flare.gonial_flare_symmetry", "value": 7 } },
      { "score_lte": { "key": "symmetry_and_flare.jaw_symmetry", "value": 7 } }
    ] },
    "source_url": null,
    "protocol_slots": ["weekly"],
    "enabled": true
  },
  {
    "id": "lips.barrier_hydration_spf",
    "worker": "lips",
    "type": "soft",
    "category": "topical",
    "priority": 78,
    "title_en": "Lip barrier hydration + SPF",
    "title_fr": "Hydratation barrière lèvres + SPF",
    "summary_en": "Consistent occlusive balm and SPF improve lip smoothness, color contrast and youthful perioral texture.",
    "summary_fr": "Baume occlusif et SPF réguliers améliorent lissage, contraste de couleur et jeunesse du contour des lèvres.",
    "steps": [
      { "en": "Apply balm after brushing and before sleep.", "fr": "Applique un baume après brossage et avant de dormir." },
      { "en": "Use SPF lip balm outdoors, especially in summer.", "fr": "Utilise un baume lèvres SPF dehors, surtout en été." }
    ],
    "duration_value": 4,
    "duration_unit": "weeks",
    "cost_min": 5,
    "cost_max": 25,
    "cost_currency": "EUR",
    "risk": "none",
    "evidence": "studies",
    "targets": ["texture_and_color.smoothness_hydration", "texture_and_color.color_contrast", "texture_and_color.perioral_youthfulness"],
    "conditions": { "or": [
      { "score_lte": { "key": "texture_and_color.smoothness_hydration", "value": 7 } },
      { "score_lte": { "key": "texture_and_color.color_contrast", "value": 7 } }
    ] },
    "source_url": null,
    "protocol_slots": ["morning", "night"],
    "enabled": true
  },
  {
    "id": "lips.tinted_balm_definition",
    "worker": "lips",
    "type": "soft",
    "category": "cosmetic",
    "priority": 62,
    "title_en": "Tinted balm and border definition",
    "title_fr": "Baume teinté et définition du bord",
    "summary_en": "Subtle lip tint and clean border grooming improve fullness perception without adding volume.",
    "summary_fr": "Une teinte subtile et un bord propre améliorent le volume perçu sans ajouter de volume réel.",
    "steps": [
      { "en": "Choose a tint close to your natural lip color, only slightly richer.", "fr": "Choisis une teinte proche du naturel, juste un peu plus riche." },
      { "en": "Keep the vermilion border hydrated and avoid overlining.", "fr": "Garde le bord du vermillon hydraté et évite le surlignage." }
    ],
    "duration_value": 4,
    "duration_unit": "weeks",
    "cost_min": 8,
    "cost_max": 35,
    "cost_currency": "EUR",
    "risk": "low",
    "evidence": "community",
    "targets": ["proportions_and_width.lip_fullness", "upper_lip_architecture.vermilion_border", "texture_and_color.color_contrast"],
    "conditions": { "or": [
      { "score_lte": { "key": "proportions_and_width.lip_fullness", "value": 7 } },
      { "score_lte": { "key": "upper_lip_architecture.vermilion_border", "value": 7 } }
    ] },
    "source_url": null,
    "protocol_slots": ["morning"],
    "enabled": true
  }
]
$scoremax_soft_recs$::jsonb) AS x (
    id text,
    worker text,
    type text,
    category text,
    priority int,
    title_en text,
    title_fr text,
    summary_en text,
    summary_fr text,
    steps jsonb,
    duration_value int,
    duration_unit text,
    cost_min int,
    cost_max int,
    cost_currency text,
    risk text,
    evidence text,
    targets jsonb,
    conditions jsonb,
    source_url text,
    protocol_slots jsonb,
    enabled boolean
  )
),
recs AS (
  SELECT
    id,
    worker,
    type,
    category,
    priority,
    title_en,
    title_fr,
    summary_en,
    summary_fr,
    steps,
    duration_value,
    duration_unit,
    cost_min,
    cost_max,
    cost_currency,
    risk,
    evidence,
    COALESCE(ARRAY(SELECT jsonb_array_elements_text(targets)), ARRAY[]::text[]) AS targets,
    conditions,
    source_url,
    COALESCE(ARRAY(SELECT jsonb_array_elements_text(protocol_slots)), ARRAY[]::text[]) AS protocol_slots,
    enabled
  FROM raw
)
INSERT INTO public.scoremax_recommendations (
  id,
  worker,
  type,
  category,
  priority,
  title_en,
  title_fr,
  summary_en,
  summary_fr,
  steps,
  duration_value,
  duration_unit,
  cost_min,
  cost_max,
  cost_currency,
  risk,
  evidence,
  targets,
  conditions,
  source_url,
  protocol_slots,
  enabled
)
SELECT
  id,
  worker,
  type,
  category,
  priority,
  title_en,
  title_fr,
  summary_en,
  summary_fr,
  steps,
  duration_value,
  duration_unit,
  cost_min,
  cost_max,
  cost_currency,
  risk,
  evidence,
  targets,
  conditions,
  source_url,
  protocol_slots,
  enabled
FROM recs
ON CONFLICT (id) DO UPDATE SET
  worker         = EXCLUDED.worker,
  type           = EXCLUDED.type,
  category       = EXCLUDED.category,
  priority       = EXCLUDED.priority,
  title_en       = EXCLUDED.title_en,
  title_fr       = EXCLUDED.title_fr,
  summary_en     = EXCLUDED.summary_en,
  summary_fr     = EXCLUDED.summary_fr,
  steps          = EXCLUDED.steps,
  duration_value = EXCLUDED.duration_value,
  duration_unit  = EXCLUDED.duration_unit,
  cost_min       = EXCLUDED.cost_min,
  cost_max       = EXCLUDED.cost_max,
  cost_currency  = EXCLUDED.cost_currency,
  risk           = EXCLUDED.risk,
  evidence       = EXCLUDED.evidence,
  targets        = EXCLUDED.targets,
  conditions     = EXCLUDED.conditions,
  source_url     = EXCLUDED.source_url,
  protocol_slots = EXCLUDED.protocol_slots,
  enabled        = EXCLUDED.enabled,
  updated_at     = NOW();
