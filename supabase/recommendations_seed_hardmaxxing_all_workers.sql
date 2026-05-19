-- ============================================================================
-- ScoreMax — Hardmaxxing recommendations seed for all face workers
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
  FROM jsonb_to_recordset($scoremax_hard_recs$
[
  {
    "id": "age.biostimulator_collagen_injectables",
    "worker": "age",
    "type": "hard",
    "category": "injectable",
    "priority": 82,
    "title_en": "Collagen biostimulator injectables",
    "title_fr": "Injectables biostimulateurs de collagène",
    "summary_en": "Sculptra, Radiesse, PRP or clinician-led regenerative injectables can restore dermal thickness and reduce the aged, hollow signal when soft-tissue depletion is visible.",
    "summary_fr": "Sculptra, Radiesse, PRP ou injectables régénératifs encadrés peuvent restaurer l'épaisseur dermique et réduire le signal vieilli/creusé quand la perte de tissu est visible.",
    "steps": [
      { "en": "Book an aesthetic doctor or plastic surgeon consult with frontal and profile photos.", "fr": "Prends un avis auprès d'un médecin esthétique ou chirurgien avec photos de face et profil." },
      { "en": "Ask for a conservative plan focused on global collagen support, not instant overfilling.", "fr": "Demande un plan conservateur orienté soutien du collagène, pas remplissage immédiat excessif." },
      { "en": "Review asymmetry, nodules and overcorrection risk before committing.", "fr": "Passe en revue asymétrie, nodules et risque de surcorrection avant de décider." }
    ],
    "duration_value": 2,
    "duration_unit": "session",
    "cost_min": 600,
    "cost_max": 1800,
    "cost_currency": "EUR",
    "risk": "medium",
    "evidence": "medical",
    "targets": ["facial_neoteny_and_fat.lower_face_softness", "skin_quality_and_plumpness.epidermal_plumpness_baby_skin", "skin_quality_and_plumpness.periorbital_freshness"],
    "conditions": { "or": [
      { "score_lte": { "key": "facial_neoteny_and_fat.lower_face_softness", "value": 5 } },
      { "score_lte": { "key": "skin_quality_and_plumpness.epidermal_plumpness_baby_skin", "value": 5 } }
    ] },
    "source_url": null,
    "protocol_slots": [],
    "enabled": true
  },
  {
    "id": "age.deep_plane_lift_consult",
    "worker": "age",
    "type": "hard",
    "category": "surgery",
    "priority": 70,
    "title_en": "Deep-plane lift consultation",
    "title_fr": "Consultation lifting deep-plane",
    "summary_en": "For clear lower-face laxity, a deep-plane facelift or mini-lift can reposition descended tissue instead of just tightening skin.",
    "summary_fr": "En cas de relâchement net du bas du visage, un lifting deep-plane ou mini-lift peut repositionner les tissus descendus plutôt que seulement tendre la peau.",
    "steps": [
      { "en": "Consult two board-certified facial plastic surgeons before deciding.", "fr": "Consulte deux chirurgiens faciaux certifiés avant de décider." },
      { "en": "Ask specifically about vector, scar placement and natural expression preservation.", "fr": "Demande précisément le vecteur, le placement des cicatrices et la conservation des expressions naturelles." },
      { "en": "Use this only when non-surgical options cannot address visible tissue descent.", "fr": "À réserver aux cas où les options non chirurgicales ne corrigent pas la descente visible des tissus." }
    ],
    "duration_value": 1,
    "duration_unit": "session",
    "cost_min": 7000,
    "cost_max": 18000,
    "cost_currency": "EUR",
    "risk": "high",
    "evidence": "medical",
    "targets": ["facial_neoteny_and_fat.lower_face_softness", "skin_quality_and_plumpness.epidermal_plumpness_baby_skin", "skin_quality_and_plumpness.periorbital_freshness"],
    "conditions": { "or": [
      { "score_lte": { "key": "facial_neoteny_and_fat.lower_face_softness", "value": 5 } },
      { "score_lte": { "key": "skin_quality_and_plumpness.epidermal_plumpness_baby_skin", "value": 5 } }
    ] },
    "source_url": null,
    "protocol_slots": [],
    "enabled": true
  },
  {
    "id": "symmetry_shape.custom_implant_planning",
    "worker": "symmetry_shape",
    "type": "hard",
    "category": "surgery",
    "priority": 82,
    "title_en": "Custom facial implant planning",
    "title_fr": "Planification d'implants faciaux sur mesure",
    "summary_en": "CT-planned custom implants can rebalance cheek, jaw or chin projection when the issue is structural rather than soft tissue.",
    "summary_fr": "Des implants sur mesure planifiés au scanner peuvent rééquilibrer pommettes, mâchoire ou menton quand le problème est structurel et non cutané.",
    "steps": [
      { "en": "Request CT-based planning and before/after simulations.", "fr": "Demande une planification basée sur scanner et des simulations avant/après." },
      { "en": "Prioritise conservative projection and symmetry over maximum size.", "fr": "Priorise une projection conservatrice et symétrique plutôt que la taille maximale." },
      { "en": "Compare implant, filler and orthognathic options before choosing.", "fr": "Compare implant, filler et options orthognathiques avant de choisir." }
    ],
    "duration_value": 1,
    "duration_unit": "session",
    "cost_min": 8000,
    "cost_max": 22000,
    "cost_currency": "EUR",
    "risk": "high",
    "evidence": "medical",
    "targets": ["symmetry.cheekbone_balance", "symmetry.jaw_chin_midline", "proportions.horizontal_fifths_balance"],
    "conditions": { "or": [
      { "score_lte": { "key": "symmetry.cheekbone_balance", "value": 5 } },
      { "score_lte": { "key": "symmetry.jaw_chin_midline", "value": 5 } },
      { "score_lte": { "key": "proportions.horizontal_fifths_balance", "value": 5 } }
    ] },
    "source_url": null,
    "protocol_slots": [],
    "enabled": true
  },
  {
    "id": "symmetry_shape.orthognathic_assessment",
    "worker": "symmetry_shape",
    "type": "hard",
    "category": "surgery",
    "priority": 78,
    "title_en": "Orthognathic symmetry assessment",
    "title_fr": "Bilan orthognathique de symétrie",
    "summary_en": "When asymmetry comes from jaw position or bite, an orthodontist/maxillofacial assessment is the cleanest path before cosmetic camouflage.",
    "summary_fr": "Quand l'asymétrie vient de la position des mâchoires ou de l'occlusion, un bilan ortho-maxillo est la voie la plus propre avant tout camouflage esthétique.",
    "steps": [
      { "en": "Book orthodontic records: bite, cephalometry and 3D imaging if available.", "fr": "Fais un dossier orthodontique : occlusion, céphalométrie et imagerie 3D si disponible." },
      { "en": "Ask whether the imbalance is skeletal, dental or soft-tissue dominant.", "fr": "Demande si le déséquilibre est surtout osseux, dentaire ou tissulaire." },
      { "en": "Do not add fillers first if surgery may be indicated; it can confuse planning.", "fr": "N'ajoute pas de filler avant si une chirurgie est possible ; cela peut brouiller la planification." }
    ],
    "duration_value": 1,
    "duration_unit": "session",
    "cost_min": 120,
    "cost_max": 350,
    "cost_currency": "EUR",
    "risk": "medium",
    "evidence": "medical",
    "targets": ["symmetry.jaw_chin_midline", "symmetry.mouth_symmetry", "proportions.vertical_thirds_balance"],
    "conditions": { "or": [
      { "score_lte": { "key": "symmetry.jaw_chin_midline", "value": 5 } },
      { "score_lte": { "key": "symmetry.mouth_symmetry", "value": 5 } }
    ] },
    "source_url": null,
    "protocol_slots": [],
    "enabled": true
  },
  {
    "id": "bodyfat.reta_medical_pathway",
    "worker": "bodyfat",
    "type": "hard",
    "category": "injectable",
    "priority": 86,
    "title_en": "Reta / incretin fat-loss pathway review",
    "title_fr": "Bilan voie reta / incrétines pour perte de gras",
    "summary_en": "A physician-led review of incretin therapy, including retatrutide where legally available, can address facial softness when excess adiposity is the main driver.",
    "summary_fr": "Un bilan médical autour des incrétines, incluant retatrutide lorsque légalement disponible, peut aider quand l'excès adipeux est le principal facteur du visage plus doux.",
    "steps": [
      { "en": "Check eligibility with an endocrinologist or obesity-medicine physician.", "fr": "Vérifie l'éligibilité avec un endocrinologue ou médecin spécialisé." },
      { "en": "Track face leanness, waist and weight trend every 4 weeks.", "fr": "Suis minceur du visage, tour de taille et poids toutes les 4 semaines." },
      { "en": "Plan protein intake and resistance training to protect facial and body structure.", "fr": "Planifie protéines et musculation pour protéger la structure du visage et du corps." }
    ],
    "duration_value": 6,
    "duration_unit": "months",
    "cost_min": 150,
    "cost_max": 600,
    "cost_currency": "EUR",
    "risk": "high",
    "evidence": "medical",
    "targets": ["global_estimation.facial_leanness_score", "lower_face_neck.jawline_definition", "upper_face_skin.facial_angularity"],
    "conditions": { "or": [
      { "score_lte": { "key": "global_estimation.facial_leanness_score", "value": 5 } },
      { "score_lte": { "key": "upper_face_skin.facial_angularity", "value": 5 } }
    ] },
    "source_url": "https://www.lilly.com/news/stories/what-to-know-about-retatrutide",
    "protocol_slots": [],
    "enabled": true
  },
  {
    "id": "bodyfat.submental_liposuction",
    "worker": "bodyfat",
    "type": "hard",
    "category": "surgery",
    "priority": 80,
    "title_en": "Submental liposuction",
    "title_fr": "Liposuccion sous-mentonnière",
    "summary_en": "Targeted submental fat removal can sharpen the cervicomental angle and jawline when the under-chin area is the bottleneck.",
    "summary_fr": "La liposuccion sous-mentonnière peut affiner l'angle cervico-mentonnier et la jawline quand la zone sous le menton est le point faible.",
    "steps": [
      { "en": "Ask whether liposuction alone is enough or if skin tightening is needed.", "fr": "Demande si la liposuccion seule suffit ou si un raffermissement cutané est nécessaire." },
      { "en": "Plan compression garment downtime before booking.", "fr": "Prévois la période avec vêtement compressif avant de réserver." },
      { "en": "Avoid if the main problem is loose skin rather than fat.", "fr": "Évite si le problème principal est la peau relâchée plutôt que le gras." }
    ],
    "duration_value": 1,
    "duration_unit": "session",
    "cost_min": 1800,
    "cost_max": 4500,
    "cost_currency": "EUR",
    "risk": "medium",
    "evidence": "medical",
    "targets": ["lower_face_neck.submental_fat_tightness", "lower_face_neck.jawline_definition"],
    "conditions": { "score_lte": { "key": "lower_face_neck.submental_fat_tightness", "value": 5 } },
    "source_url": null,
    "protocol_slots": [],
    "enabled": true
  },
  {
    "id": "eyes.regenerative_periocular_injectables",
    "worker": "eyes",
    "type": "hard",
    "category": "injectable",
    "priority": 72,
    "title_en": "Periocular regenerative injectables",
    "title_fr": "Injectables régénératifs péri-oculaires",
    "summary_en": "PRP, polynucleotides or clinician-led peptide/skinbooster options can improve thin under-eye skin quality without adding heavy filler volume.",
    "summary_fr": "PRP, polynucléotides ou options peptides/skinbooster encadrées peuvent améliorer la qualité de peau sous les yeux sans ajouter un volume lourd de filler.",
    "steps": [
      { "en": "Use an oculoplastic or injector experienced with the tear-trough zone.", "fr": "Passe par un oculoplasticien ou injecteur expérimenté dans la vallée des larmes." },
      { "en": "Prioritise skin quality if pigmentation and thin skin are stronger than hollowing.", "fr": "Priorise la qualité de peau si pigmentation et peau fine dominent plus que le creux." },
      { "en": "Photograph before each session under the same light.", "fr": "Photographie avant chaque séance avec la même lumière." }
    ],
    "duration_value": 3,
    "duration_unit": "session",
    "cost_min": 300,
    "cost_max": 1200,
    "cost_currency": "EUR",
    "risk": "medium",
    "evidence": "medical",
    "targets": ["under_eye_health.under_eye_pigmentation", "under_eye_health.under_eye_support"],
    "conditions": { "or": [
      { "score_lte": { "key": "under_eye_health.under_eye_pigmentation", "value": 6 } },
      { "score_lte": { "key": "under_eye_health.under_eye_support", "value": 6 } }
    ] },
    "source_url": null,
    "protocol_slots": [],
    "enabled": true
  },
  {
    "id": "cheeks.malar_filler_or_biostimulator",
    "worker": "cheeks",
    "type": "hard",
    "category": "injectable",
    "priority": 82,
    "title_en": "Malar filler or biostimulator",
    "title_fr": "Filler malaire ou biostimulateur",
    "summary_en": "Strategic malar HA filler, Sculptra or Radiesse can restore cheekbone highlight and ogee curve without making the midface look puffy.",
    "summary_fr": "Un filler HA malaire, Sculptra ou Radiesse bien placé peut restaurer le highlight des pommettes et la courbe ogee sans gonfler le midface.",
    "steps": [
      { "en": "Ask for deep structural placement, not superficial puffiness.", "fr": "Demande un placement profond et structurel, pas du volume superficiel gonflé." },
      { "en": "Start low; reassess after swelling has fully settled.", "fr": "Commence léger ; réévalue une fois l'œdème complètement résorbé." },
      { "en": "Check smile dynamics so added volume does not bunch under the eyes.", "fr": "Vérifie la dynamique du sourire pour éviter un amas sous les yeux." }
    ],
    "duration_value": 1,
    "duration_unit": "session",
    "cost_min": 500,
    "cost_max": 1600,
    "cost_currency": "EUR",
    "risk": "medium",
    "evidence": "medical",
    "targets": ["frontal_structure.malar_eminence_prominence", "profile_structure.ogee_curve", "profile_structure.zygomatic_projection_and_arch"],
    "conditions": { "or": [
      { "score_lte": { "key": "frontal_structure.malar_eminence_prominence", "value": 5 } },
      { "score_lte": { "key": "profile_structure.ogee_curve", "value": 5 } }
    ] },
    "source_url": null,
    "protocol_slots": [],
    "enabled": true
  },
  {
    "id": "cheeks.zygomatic_implants_or_fat_graft",
    "worker": "cheeks",
    "type": "hard",
    "category": "surgery",
    "priority": 76,
    "title_en": "Zygomatic implants or fat grafting",
    "title_fr": "Implants zygomatiques ou lipofilling",
    "summary_en": "When cheek projection is structurally weak, implants or fat grafting can create permanent malar support and a stronger midface frame.",
    "summary_fr": "Quand la projection des pommettes est structurellement faible, implants ou lipofilling peuvent créer un support malaire durable et un midface plus fort.",
    "steps": [
      { "en": "Compare custom implant, standard implant and fat grafting plans.", "fr": "Compare plans implant sur mesure, implant standard et lipofilling." },
      { "en": "Prioritise harmony with nose, under-eye and jaw width.", "fr": "Priorise l'harmonie avec nez, sous-œil et largeur de mâchoire." },
      { "en": "Review long-term revision risk and asymmetry management.", "fr": "Passe en revue risque de retouche long terme et gestion d'asymétrie." }
    ],
    "duration_value": 1,
    "duration_unit": "session",
    "cost_min": 4000,
    "cost_max": 12000,
    "cost_currency": "EUR",
    "risk": "high",
    "evidence": "medical",
    "targets": ["frontal_structure.bizygomatic_width", "profile_structure.zygomatic_projection_and_arch", "harmony.midface_dominance"],
    "conditions": { "score_lte": { "key": "profile_structure.zygomatic_projection_and_arch", "value": 4 } },
    "source_url": null,
    "protocol_slots": [],
    "enabled": true
  },
  {
    "id": "chin.ha_chin_projection",
    "worker": "chin",
    "type": "hard",
    "category": "injectable",
    "priority": 78,
    "title_en": "Chin projection filler",
    "title_fr": "Filler de projection du menton",
    "summary_en": "High-G-prime HA filler can test added chin projection and width before committing to implant or sliding genioplasty.",
    "summary_fr": "Un HA ferme peut tester une projection et largeur de menton avant implant ou génioplastie d'avancement.",
    "steps": [
      { "en": "Ask for profile-first planning: projection, height and labiomental fold.", "fr": "Demande une planification de profil : projection, hauteur et sillon labio-mentonnier." },
      { "en": "Use it as a reversible preview if you are considering surgery.", "fr": "Utilise-le comme aperçu réversible si tu envisages une chirurgie." },
      { "en": "Avoid over-projecting if the lower face already dominates.", "fr": "Évite de trop projeter si le bas du visage domine déjà." }
    ],
    "duration_value": 1,
    "duration_unit": "session",
    "cost_min": 350,
    "cost_max": 900,
    "cost_currency": "EUR",
    "risk": "medium",
    "evidence": "medical",
    "targets": ["projection_and_profile.chin_projection", "width_and_integration.lower_face_integration"],
    "conditions": { "score_lte": { "key": "projection_and_profile.chin_projection", "value": 5 } },
    "source_url": null,
    "protocol_slots": [],
    "enabled": true
  },
  {
    "id": "chin.sliding_genioplasty_or_implant",
    "worker": "chin",
    "type": "hard",
    "category": "surgery",
    "priority": 84,
    "title_en": "Sliding genioplasty or chin implant",
    "title_fr": "Génioplastie ou implant de menton",
    "summary_en": "A sliding genioplasty or implant can permanently improve chin projection, height and lower-face integration when filler is only a temporary camouflage.",
    "summary_fr": "Une génioplastie ou un implant peut améliorer durablement projection, hauteur et intégration du menton quand le filler ne serait qu'un camouflage.",
    "steps": [
      { "en": "Request cephalometric planning and side-profile simulation.", "fr": "Demande une planification céphalométrique et simulation de profil." },
      { "en": "Discuss airway, bite and mandibular relationship before isolated chin surgery.", "fr": "Discute voies aériennes, occlusion et relation mandibulaire avant chirurgie isolée." },
      { "en": "Compare implant versus bone movement for your anatomy.", "fr": "Compare implant versus déplacement osseux selon ton anatomie." }
    ],
    "duration_value": 1,
    "duration_unit": "session",
    "cost_min": 3500,
    "cost_max": 9000,
    "cost_currency": "EUR",
    "risk": "high",
    "evidence": "medical",
    "targets": ["projection_and_profile.chin_projection", "projection_and_profile.chin_height", "width_and_integration.lower_face_integration"],
    "conditions": { "or": [
      { "score_lte": { "key": "projection_and_profile.chin_projection", "value": 4 } },
      { "score_lte": { "key": "width_and_integration.lower_face_integration", "value": 5 } }
    ] },
    "source_url": null,
    "protocol_slots": [],
    "enabled": true
  },
  {
    "id": "coloring.laser_toning_for_contrast",
    "worker": "coloring",
    "type": "hard",
    "category": "device_clinical",
    "priority": 66,
    "title_en": "Clinical laser toning for color evenness",
    "title_fr": "Laser toning médical pour uniformité couleur",
    "summary_en": "A dermatologist-led laser toning plan can improve skin clarity and evenness when contrast is reduced by diffuse discoloration.",
    "summary_fr": "Un plan de laser toning encadré par dermatologue peut améliorer clarté et uniformité quand le contraste est diminué par une dyschromie diffuse.",
    "steps": [
      { "en": "Confirm the pigment type before treating: melasma, PIH and redness need different settings.", "fr": "Confirme le type de pigment avant traitement : mélasma, PIH et rougeurs exigent des réglages différents." },
      { "en": "Use conservative settings on darker phototypes.", "fr": "Utilise des réglages conservateurs sur phototypes foncés." },
      { "en": "Pair with strict SPF or results relapse quickly.", "fr": "Associe à un SPF strict sinon les résultats rechutent vite." }
    ],
    "duration_value": 3,
    "duration_unit": "session",
    "cost_min": 300,
    "cost_max": 1200,
    "cost_currency": "EUR",
    "risk": "medium",
    "evidence": "medical",
    "targets": ["skin.clarity", "skin.evenness", "contrast.overall_contrast_score"],
    "conditions": { "or": [
      { "score_lte": { "key": "skin.clarity", "value": 6 } },
      { "score_lte": { "key": "skin.evenness", "value": 6 } }
    ] },
    "source_url": null,
    "protocol_slots": [],
    "enabled": true
  },
  {
    "id": "coloring.medical_micropigmentation",
    "worker": "coloring",
    "type": "hard",
    "category": "cosmetic",
    "priority": 58,
    "title_en": "Medical micropigmentation planning",
    "title_fr": "Planification micropigmentation médicale",
    "summary_en": "Brows, lips or scalp micropigmentation can restore contrast when natural pigment density is weak or uneven.",
    "summary_fr": "La micropigmentation sourcils, lèvres ou cuir chevelu peut restaurer le contraste quand la densité pigmentaire naturelle est faible ou inégale.",
    "steps": [
      { "en": "Patch-test pigment and choose a conservative shade.", "fr": "Teste le pigment et choisis une teinte conservatrice." },
      { "en": "Avoid dense tattoo effects; aim for soft optical contrast.", "fr": "Évite l'effet tatouage dense ; vise un contraste optique doux." },
      { "en": "Plan maintenance because color shifts over time.", "fr": "Prévois l'entretien car la couleur évolue avec le temps." }
    ],
    "duration_value": 1,
    "duration_unit": "session",
    "cost_min": 250,
    "cost_max": 900,
    "cost_currency": "EUR",
    "risk": "medium",
    "evidence": "community",
    "targets": ["eyebrows.contrast_vs_skin", "lips.saturation", "contrast.brows_vs_skin"],
    "conditions": { "or": [
      { "score_lte": { "key": "eyebrows.contrast_vs_skin", "value": 5 } },
      { "score_lte": { "key": "lips.saturation", "value": 5 } }
    ] },
    "source_url": null,
    "protocol_slots": [],
    "enabled": true
  },
  {
    "id": "neck.platysma_botox_nefertiti",
    "worker": "neck",
    "type": "hard",
    "category": "injectable",
    "priority": 72,
    "title_en": "Platysma Botox / Nefertiti lift",
    "title_fr": "Botox platysma / Nefertiti lift",
    "summary_en": "Neuromodulator along the platysma and jaw border can soften neck bands and subtly sharpen the jaw-neck transition.",
    "summary_fr": "Un neuromodulateur sur le platysma et le bord mandibulaire peut adoucir les bandes du cou et affiner la transition mâchoire-cou.",
    "steps": [
      { "en": "Use an injector who routinely treats platysmal bands.", "fr": "Passe par un injecteur habitué aux bandes platysmales." },
      { "en": "Ask for conservative dosing and smile/swallow safety review.", "fr": "Demande une approche conservatrice et une revue des risques sourire/déglutition." },
      { "en": "Assess result at 2 weeks before any touch-up.", "fr": "Évalue à 2 semaines avant toute retouche." }
    ],
    "duration_value": 1,
    "duration_unit": "session",
    "cost_min": 250,
    "cost_max": 700,
    "cost_currency": "EUR",
    "risk": "medium",
    "evidence": "medical",
    "targets": ["musculature_and_soft_tissue.neck_firmness", "dimensions_and_proportions.neck_shape_and_taper"],
    "conditions": { "or": [
      { "score_lte": { "key": "musculature_and_soft_tissue.neck_firmness", "value": 6 } },
      { "score_lte": { "key": "dimensions_and_proportions.neck_shape_and_taper", "value": 6 } }
    ] },
    "source_url": null,
    "protocol_slots": [],
    "enabled": true
  },
  {
    "id": "neck.neck_lift_or_lipo",
    "worker": "neck",
    "type": "hard",
    "category": "surgery",
    "priority": 82,
    "title_en": "Neck lift or neck liposuction",
    "title_fr": "Lifting du cou ou liposuccion cervicale",
    "summary_en": "For loose neck tissue, poor taper or submental fullness, surgical neck contouring can redefine the cervicomental angle.",
    "summary_fr": "En cas de relâchement, manque de taper ou plénitude sous-mentonnière, le contouring chirurgical du cou peut redéfinir l'angle cervico-mentonnier.",
    "steps": [
      { "en": "Clarify whether fat, skin laxity or platysma bands are the main issue.", "fr": "Clarifie si le problème principal est gras, peau relâchée ou bandes platysmales." },
      { "en": "Ask for jawline and neck to be planned together.", "fr": "Demande une planification commune jawline + cou." },
      { "en": "Review scar position and compression downtime.", "fr": "Passe en revue la position des cicatrices et le temps de compression." }
    ],
    "duration_value": 1,
    "duration_unit": "session",
    "cost_min": 3500,
    "cost_max": 12000,
    "cost_currency": "EUR",
    "risk": "high",
    "evidence": "medical",
    "targets": ["dimensions_and_proportions.neck_shape_and_taper", "musculature_and_soft_tissue.neck_firmness"],
    "conditions": { "score_lte": { "key": "dimensions_and_proportions.neck_shape_and_taper", "value": 5 } },
    "source_url": null,
    "protocol_slots": [],
    "enabled": true
  },
  {
    "id": "nose.rhinoplasty_structural",
    "worker": "nose",
    "type": "hard",
    "category": "surgery",
    "priority": 88,
    "title_en": "Structural rhinoplasty",
    "title_fr": "Rhinoplastie structurelle",
    "summary_en": "A structural rhinoplasty can improve bridge shape, tip definition, projection, length and symmetry in one coordinated surgical plan.",
    "summary_fr": "Une rhinoplastie structurelle peut améliorer arête, définition/projection de pointe, longueur et symétrie dans un plan chirurgical cohérent.",
    "steps": [
      { "en": "Bring front, side and three-quarter goals; avoid one-angle planning.", "fr": "Apporte objectifs face, profil et trois-quarts ; évite une planification sur un seul angle." },
      { "en": "Ask how breathing, septum and aesthetics interact.", "fr": "Demande comment respiration, septum et esthétique interagissent." },
      { "en": "Wait for full swelling resolution before judging final tip definition.", "fr": "Attends la résolution complète de l'œdème avant de juger la pointe finale." }
    ],
    "duration_value": 1,
    "duration_unit": "session",
    "cost_min": 5000,
    "cost_max": 14000,
    "cost_currency": "EUR",
    "risk": "high",
    "evidence": "medical",
    "targets": ["profile_dorsum_and_angles.nasofrontal_angle", "tip_morphology.tip_definition", "frontal_symmetry_and_width.nose_symmetry"],
    "conditions": { "or": [
      { "score_lte": { "key": "global_score.overall_nose_score", "value": 5 } },
      { "score_lte": { "key": "tip_morphology.tip_definition", "value": 5 } },
      { "score_lte": { "key": "frontal_symmetry_and_width.nose_symmetry", "value": 5 } }
    ] },
    "source_url": null,
    "protocol_slots": [],
    "enabled": true
  },
  {
    "id": "nose.alar_base_or_tip_refinement",
    "worker": "nose",
    "type": "hard",
    "category": "surgery",
    "priority": 74,
    "title_en": "Alar base or tip refinement",
    "title_fr": "Réduction alaire ou refinement de pointe",
    "summary_en": "Focused alar base reduction or tip refinement can address nose width, nostril flare and poor tip definition without changing the whole nose.",
    "summary_fr": "Une réduction alaire ou un refinement de pointe peut traiter largeur, narines évasées et pointe peu définie sans changer tout le nez.",
    "steps": [
      { "en": "Ask whether a limited procedure is enough versus full rhinoplasty.", "fr": "Demande si un geste limité suffit ou si une rhinoplastie complète est préférable." },
      { "en": "Check nostril shape from below and from frontal smile view.", "fr": "Vérifie la forme des narines par dessous et au sourire de face." },
      { "en": "Prioritise preserving ethnic and facial harmony.", "fr": "Priorise la conservation de l'harmonie ethnique et faciale." }
    ],
    "duration_value": 1,
    "duration_unit": "session",
    "cost_min": 1800,
    "cost_max": 6500,
    "cost_currency": "EUR",
    "risk": "high",
    "evidence": "medical",
    "targets": ["frontal_symmetry_and_width.overall_alar_width", "tip_morphology.tip_definition", "base_nostrils_and_surface.nostril_shape"],
    "conditions": { "or": [
      { "score_lte": { "key": "frontal_symmetry_and_width.overall_alar_width", "value": 5 } },
      { "score_lte": { "key": "tip_morphology.tip_definition", "value": 5 } }
    ] },
    "source_url": null,
    "protocol_slots": [],
    "enabled": true
  },
  {
    "id": "skin.fractional_laser_resurfacing",
    "worker": "skin",
    "type": "hard",
    "category": "energy",
    "priority": 84,
    "title_en": "Fractional laser resurfacing",
    "title_fr": "Resurfacing laser fractionné",
    "summary_en": "Fractional CO2 or Er:YAG resurfacing can improve pores, texture, acne marks and surface smoothness with a strong collagen remodeling effect.",
    "summary_fr": "Le CO2 fractionné ou Er:YAG peut améliorer pores, texture, marques d'acné et lissage cutané avec un fort remodelage collagénique.",
    "steps": [
      { "en": "Match laser type and settings to phototype and downtime tolerance.", "fr": "Adapte le type de laser et les réglages au phototype et au downtime accepté." },
      { "en": "Plan strict sun avoidance before and after treatment.", "fr": "Prévois éviction solaire stricte avant et après." },
      { "en": "Do not combine aggressively with actives during healing.", "fr": "Ne combine pas avec des actifs agressifs pendant la cicatrisation." }
    ],
    "duration_value": 1,
    "duration_unit": "session",
    "cost_min": 500,
    "cost_max": 2500,
    "cost_currency": "EUR",
    "risk": "medium",
    "evidence": "medical",
    "targets": ["texture_pores_and_congestion.surface_smoothness", "texture_pores_and_congestion.pore_size_and_visibility", "acne_and_scarring.post_inflammatory_marks"],
    "conditions": { "or": [
      { "score_lte": { "key": "texture_pores_and_congestion.surface_smoothness", "value": 6 } },
      { "score_lte": { "key": "acne_and_scarring.post_inflammatory_marks", "value": 6 } }
    ] },
    "source_url": null,
    "protocol_slots": [],
    "enabled": true
  },
  {
    "id": "skin.acne_scar_subcision_rf",
    "worker": "skin",
    "type": "hard",
    "category": "device_clinical",
    "priority": 86,
    "title_en": "Subcision + RF microneedling for scars",
    "title_fr": "Subcision + radiofréquence microneedling pour cicatrices",
    "summary_en": "Atrophic acne scars often need mechanical release plus collagen stimulation: subcision, RF microneedling and sometimes biostimulator.",
    "summary_fr": "Les cicatrices atrophiques nécessitent souvent libération mécanique + stimulation collagénique : subcision, RF microneedling et parfois biostimulateur.",
    "steps": [
      { "en": "Map scar type first: ice-pick, rolling and boxcar need different tools.", "fr": "Cartographie d'abord les cicatrices : ice-pick, rolling et boxcar ne se traitent pas pareil." },
      { "en": "Plan multiple sessions rather than one aggressive session.", "fr": "Planifie plusieurs séances plutôt qu'une séance trop agressive." },
      { "en": "Ask about pigment risk if you tan easily.", "fr": "Demande le risque pigmentaire si tu bronzes facilement." }
    ],
    "duration_value": 3,
    "duration_unit": "session",
    "cost_min": 600,
    "cost_max": 2400,
    "cost_currency": "EUR",
    "risk": "medium",
    "evidence": "medical",
    "targets": ["acne_and_scarring.atrophic_scarring", "texture_pores_and_congestion.surface_smoothness"],
    "conditions": { "score_lte": { "key": "acne_and_scarring.atrophic_scarring", "value": 6 } },
    "source_url": null,
    "protocol_slots": [],
    "enabled": true
  },
  {
    "id": "smile.orthodontic_aligners_or_braces",
    "worker": "smile",
    "type": "hard",
    "category": "device_clinical",
    "priority": 86,
    "title_en": "Orthodontic aligners or braces",
    "title_fr": "Aligneurs orthodontiques ou bagues",
    "summary_en": "Clear aligners or braces can correct dental alignment, midline and smile architecture when tooth position is the main limiter.",
    "summary_fr": "Aligneurs transparents ou bagues peuvent corriger alignement, ligne médiane et architecture du sourire quand la position dentaire limite le résultat.",
    "steps": [
      { "en": "Get orthodontic scans and ask about bite, not just straight teeth.", "fr": "Fais des scans orthodontiques et parle occlusion, pas seulement dents droites." },
      { "en": "Ask if expansion or IPR is needed for buccal corridors.", "fr": "Demande si expansion ou stripping est utile pour les corridors buccaux." },
      { "en": "Plan retainers from day one.", "fr": "Prévois les contentions dès le départ." }
    ],
    "duration_value": 12,
    "duration_unit": "months",
    "cost_min": 1800,
    "cost_max": 6500,
    "cost_currency": "EUR",
    "risk": "medium",
    "evidence": "medical",
    "targets": ["smile_architecture.dental_alignment", "smile_architecture.midline_alignment", "smile_dynamics.buccal_corridors"],
    "conditions": { "or": [
      { "score_lte": { "key": "smile_architecture.dental_alignment", "value": 6 } },
      { "score_lte": { "key": "smile_architecture.midline_alignment", "value": 6 } }
    ] },
    "source_url": null,
    "protocol_slots": [],
    "enabled": true
  },
  {
    "id": "smile.veneers_whitening_gum_contouring",
    "worker": "smile",
    "type": "hard",
    "category": "cosmetic",
    "priority": 78,
    "title_en": "Veneers, whitening or gum contouring",
    "title_fr": "Facettes, blanchiment ou gingivoplastie",
    "summary_en": "A cosmetic dentist can combine whitening, bonding, veneers or gum contouring to improve tooth color, proportions and gingival display.",
    "summary_fr": "Un dentiste esthétique peut combiner blanchiment, bonding, facettes ou gingivoplastie pour améliorer couleur, proportions et exposition gingivale.",
    "steps": [
      { "en": "Start with conservative whitening/bonding before irreversible veneers.", "fr": "Commence par blanchiment/bonding conservateur avant des facettes irréversibles." },
      { "en": "Ask for smile design mockup in natural light.", "fr": "Demande un mockup de smile design en lumière naturelle." },
      { "en": "Keep tooth shape masculine/feminine according to your face, not template-white.", "fr": "Garde une forme dentaire cohérente avec ton visage, pas un blanc-template artificiel." }
    ],
    "duration_value": 1,
    "duration_unit": "session",
    "cost_min": 300,
    "cost_max": 8000,
    "cost_currency": "EUR",
    "risk": "medium",
    "evidence": "medical",
    "targets": ["dental_quality.shade_and_whiteness", "dental_quality.tooth_proportions", "smile_dynamics.gingival_display"],
    "conditions": { "or": [
      { "score_lte": { "key": "dental_quality.shade_and_whiteness", "value": 6 } },
      { "score_lte": { "key": "dental_quality.tooth_proportions", "value": 6 } },
      { "score_lte": { "key": "smile_dynamics.gingival_display", "value": 6 } }
    ] },
    "source_url": null,
    "protocol_slots": [],
    "enabled": true
  },
  {
    "id": "skin_tint.ipl_bbl_pigment_vascular",
    "worker": "skin_tint",
    "type": "hard",
    "category": "energy",
    "priority": 76,
    "title_en": "IPL / BBL pigment and redness protocol",
    "title_fr": "Protocole IPL / BBL pigments et rougeurs",
    "summary_en": "IPL or BBL can improve radiance, redness, uneven melanin and dull tone when settings match phototype.",
    "summary_fr": "IPL ou BBL peuvent améliorer éclat, rougeurs, mélanine inégale et teint terne quand les réglages respectent le phototype.",
    "steps": [
      { "en": "Confirm phototype and pigment type before first pulse.", "fr": "Confirme phototype et type de pigment avant le premier tir." },
      { "en": "Use test spots for darker or reactive skin.", "fr": "Utilise des spots test sur peau foncée ou réactive." },
      { "en": "Schedule maintenance only after the first full series is evaluated.", "fr": "Ne planifie l'entretien qu'après évaluation de la série initiale." }
    ],
    "duration_value": 3,
    "duration_unit": "session",
    "cost_min": 300,
    "cost_max": 1500,
    "cost_currency": "EUR",
    "risk": "medium",
    "evidence": "medical",
    "targets": ["vitality_and_radiance.color_radiance_glow", "pigment_distribution.melanin_uniformity", "vitality_and_radiance.sallowness_absence"],
    "conditions": { "or": [
      { "score_lte": { "key": "vitality_and_radiance.color_radiance_glow", "value": 6 } },
      { "score_lte": { "key": "pigment_distribution.melanin_uniformity", "value": 6 } }
    ] },
    "source_url": null,
    "protocol_slots": [],
    "enabled": true
  },
  {
    "id": "skin_tint.medical_peel_program",
    "worker": "skin_tint",
    "type": "hard",
    "category": "device_clinical",
    "priority": 66,
    "title_en": "Medical peel program",
    "title_fr": "Programme de peelings médicaux",
    "summary_en": "A supervised peel series can reset dull tone, mild hyperpigmentation and uneven surface when topical care is too slow.",
    "summary_fr": "Une série de peelings supervisés peut corriger teint terne, hyperpigmentation légère et surface inégale quand les topiques sont trop lents.",
    "steps": [
      { "en": "Choose peel depth based on phototype and pigment risk.", "fr": "Choisis la profondeur du peeling selon phototype et risque pigmentaire." },
      { "en": "Stop retinoids/acids before the session as instructed.", "fr": "Arrête rétinoïdes/acides avant la séance selon consignes." },
      { "en": "Use barrier repair and SPF during the full peel series.", "fr": "Utilise réparation de barrière et SPF pendant toute la série." }
    ],
    "duration_value": 3,
    "duration_unit": "session",
    "cost_min": 180,
    "cost_max": 900,
    "cost_currency": "EUR",
    "risk": "medium",
    "evidence": "medical",
    "targets": ["vitality_and_radiance.sallowness_absence", "pigment_distribution.periorbital_perioral_match", "sun_exposure_aesthetic.tan_uniformity"],
    "conditions": { "or": [
      { "score_lte": { "key": "vitality_and_radiance.sallowness_absence", "value": 6 } },
      { "score_lte": { "key": "pigment_distribution.periorbital_perioral_match", "value": 6 } }
    ] },
    "source_url": null,
    "protocol_slots": [],
    "enabled": true
  },
  {
    "id": "eye_brows.brow_transplant",
    "worker": "eye_brows",
    "type": "hard",
    "category": "surgery",
    "priority": 78,
    "title_en": "Eyebrow transplant",
    "title_fr": "Greffe de sourcils",
    "summary_en": "A brow transplant can permanently restore density, tail length and shape when follicles are sparse or over-plucked.",
    "summary_fr": "Une greffe de sourcils peut restaurer durablement densité, longueur de queue et forme quand les follicules sont clairsemés ou trop épilés.",
    "steps": [
      { "en": "Bring old photos to reconstruct your natural brow pattern.", "fr": "Apporte d'anciennes photos pour reconstruire ton pattern naturel." },
      { "en": "Ask about hair angle, trimming needs and donor hair behavior.", "fr": "Demande l'angle des poils, l'entretien et le comportement des cheveux donneurs." },
      { "en": "Avoid over-dense designs; brows should frame, not dominate.", "fr": "Évite un design trop dense ; les sourcils doivent cadrer, pas dominer." }
    ],
    "duration_value": 1,
    "duration_unit": "session",
    "cost_min": 2500,
    "cost_max": 7000,
    "cost_currency": "EUR",
    "risk": "medium",
    "evidence": "medical",
    "targets": ["density_grooming_and_glabella.eyebrow_density", "geometry_and_shape.tail_length_and_direction", "global_score.overall_brow_score"],
    "conditions": { "or": [
      { "score_lte": { "key": "density_grooming_and_glabella.eyebrow_density", "value": 5 } },
      { "score_lte": { "key": "geometry_and_shape.tail_length_and_direction", "value": 5 } }
    ] },
    "source_url": null,
    "protocol_slots": [],
    "enabled": true
  },
  {
    "id": "eye_brows.botox_brow_lift",
    "worker": "eye_brows",
    "type": "hard",
    "category": "injectable",
    "priority": 70,
    "title_en": "Botox brow lift",
    "title_fr": "Brow lift au Botox",
    "summary_en": "Strategic neuromodulator placement can subtly lift the lateral brow and improve tired or downward brow geometry.",
    "summary_fr": "Un neuromodulateur placé stratégiquement peut relever légèrement la queue du sourcil et améliorer une géométrie tombante ou fatiguée.",
    "steps": [
      { "en": "Ask for a subtle lateral lift, not a surprised look.", "fr": "Demande un lift latéral subtil, pas un air surpris." },
      { "en": "Photograph at rest and with expression before treatment.", "fr": "Photographie au repos et en expression avant traitement." },
      { "en": "Reassess at 14 days before adding more units.", "fr": "Réévalue à 14 jours avant d'ajouter." }
    ],
    "duration_value": 1,
    "duration_unit": "session",
    "cost_min": 180,
    "cost_max": 450,
    "cost_currency": "EUR",
    "risk": "medium",
    "evidence": "medical",
    "targets": ["placement_and_symmetry.eyebrow_elevation", "geometry_and_shape.tail_length_and_direction", "placement_and_symmetry.eyebrow_symmetry"],
    "conditions": { "or": [
      { "score_lte": { "key": "placement_and_symmetry.eyebrow_elevation", "value": 5 } },
      { "score_lte": { "key": "geometry_and_shape.tail_length_and_direction", "value": 5 } }
    ] },
    "source_url": null,
    "protocol_slots": [],
    "enabled": true
  },
  {
    "id": "hair.hair_transplant_hairline",
    "worker": "hair",
    "type": "hard",
    "category": "surgery",
    "priority": 88,
    "title_en": "Hairline transplant",
    "title_fr": "Greffe de ligne frontale",
    "summary_en": "FUE/FUT transplantation can rebuild hairline density, symmetry and recession when the donor area is suitable.",
    "summary_fr": "La greffe FUE/FUT peut reconstruire densité, symétrie et recul de la ligne frontale si la zone donneuse est adaptée.",
    "steps": [
      { "en": "Stabilise hair loss medically before surgical planning.", "fr": "Stabilise la chute médicalement avant plan chirurgical." },
      { "en": "Prioritise natural irregularity and age-appropriate height.", "fr": "Priorise une irrégularité naturelle et une hauteur adaptée à l'âge." },
      { "en": "Ask for donor management, not just graft count.", "fr": "Demande la gestion de la zone donneuse, pas seulement le nombre de greffons." }
    ],
    "duration_value": 1,
    "duration_unit": "session",
    "cost_min": 3000,
    "cost_max": 12000,
    "cost_currency": "EUR",
    "risk": "medium",
    "evidence": "medical",
    "targets": ["hairline.recession_level", "hairline.density", "hairline.symmetry"],
    "conditions": { "or": [
      { "score_lte": { "key": "hairline.density", "value": 5 } },
      { "score_lte": { "key": "hairline.recession_level", "value": 5 } }
    ] },
    "source_url": null,
    "protocol_slots": [],
    "enabled": true
  },
  {
    "id": "hair.prp_ghk_mesotherapy",
    "worker": "hair",
    "type": "hard",
    "category": "injectable",
    "priority": 72,
    "title_en": "PRP / GHK-Cu mesotherapy review",
    "title_fr": "Bilan mésothérapie PRP / GHK-Cu",
    "summary_en": "Clinician-delivered PRP, mesotherapy or peptide options such as GHK-Cu may support scalp quality and density when paired with a real hair-loss diagnosis.",
    "summary_fr": "PRP, mésothérapie ou options peptides comme GHK-Cu encadrées peuvent soutenir qualité du cuir chevelu et densité si elles sont associées à un vrai diagnostic de chute.",
    "steps": [
      { "en": "Get a scalp diagnosis first: androgenetic, inflammatory, traction or shedding.", "fr": "Obtiens d'abord un diagnostic : androgénétique, inflammatoire, traction ou effluvium." },
      { "en": "Track standardized hairline and crown photos monthly.", "fr": "Suis des photos standardisées ligne frontale/couronne chaque mois." },
      { "en": "Use injectables as adjuncts, not substitutes for diagnosis-led treatment.", "fr": "Utilise les injectables comme adjuvants, pas comme substituts au traitement guidé par diagnostic." }
    ],
    "duration_value": 3,
    "duration_unit": "session",
    "cost_min": 300,
    "cost_max": 1500,
    "cost_currency": "EUR",
    "risk": "medium",
    "evidence": "medical",
    "targets": ["hair_quality_and_health.density", "hair_quality_and_health.health_appearance", "hairline.density"],
    "conditions": { "or": [
      { "score_lte": { "key": "hair_quality_and_health.density", "value": 6 } },
      { "score_lte": { "key": "hairline.density", "value": 6 } }
    ] },
    "source_url": null,
    "protocol_slots": [],
    "enabled": true
  },
  {
    "id": "jaw.ha_jawline_contouring",
    "worker": "jaw",
    "type": "hard",
    "category": "injectable",
    "priority": 80,
    "title_en": "Jawline contouring filler",
    "title_fr": "Contouring jawline au filler",
    "summary_en": "High-G-prime HA or CaHA can sharpen jaw width, angle definition and lower-face frame when bone structure is moderate but not surgical.",
    "summary_fr": "HA ferme ou CaHA peuvent renforcer largeur, angle et cadre du bas du visage quand la structure est modérée mais pas chirurgicale.",
    "steps": [
      { "en": "Plan from frontal and three-quarter view, not just side profile.", "fr": "Planifie depuis face et trois-quarts, pas seulement profil." },
      { "en": "Keep gonial width balanced with cheeks and chin.", "fr": "Garde la largeur goniale cohérente avec pommettes et menton." },
      { "en": "Start conservative; jaw filler gets obvious quickly.", "fr": "Commence conservateur ; le filler jawline devient vite évident." }
    ],
    "duration_value": 1,
    "duration_unit": "session",
    "cost_min": 600,
    "cost_max": 2000,
    "cost_currency": "EUR",
    "risk": "medium",
    "evidence": "medical",
    "targets": ["frontal_geometry.jaw_width", "profile_architecture.jawline_length", "symmetry_and_flare.gonial_flare_symmetry"],
    "conditions": { "or": [
      { "score_lte": { "key": "frontal_geometry.jaw_width", "value": 5 } },
      { "score_lte": { "key": "profile_architecture.jawline_length", "value": 5 } }
    ] },
    "source_url": null,
    "protocol_slots": [],
    "enabled": true
  },
  {
    "id": "jaw.mandibular_angle_implants",
    "worker": "jaw",
    "type": "hard",
    "category": "surgery",
    "priority": 86,
    "title_en": "Mandibular angle implants",
    "title_fr": "Implants d'angle mandibulaire",
    "summary_en": "Custom or standard mandibular angle implants can permanently increase ramus height, jaw width and angularity.",
    "summary_fr": "Des implants d'angle mandibulaire standard ou sur mesure peuvent augmenter durablement hauteur du ramus, largeur et angularité mandibulaire.",
    "steps": [
      { "en": "Request CT planning and evaluate nerve position.", "fr": "Demande une planification scanner et l'évaluation du trajet nerveux." },
      { "en": "Choose shape based on ramus height and gonial angle, not maximum mass.", "fr": "Choisis la forme selon hauteur du ramus et angle gonial, pas la masse maximale." },
      { "en": "Review infection, asymmetry and removal risk.", "fr": "Passe en revue infection, asymétrie et risque de retrait." }
    ],
    "duration_value": 1,
    "duration_unit": "session",
    "cost_min": 7000,
    "cost_max": 18000,
    "cost_currency": "EUR",
    "risk": "high",
    "evidence": "medical",
    "targets": ["profile_architecture.jaw_height_ramus", "frontal_geometry.jaw_width", "frontal_geometry.jaw_to_face_proportion"],
    "conditions": { "or": [
      { "score_lte": { "key": "profile_architecture.jaw_height_ramus", "value": 5 } },
      { "score_lte": { "key": "frontal_geometry.jaw_to_face_proportion", "value": 5 } }
    ] },
    "source_url": null,
    "protocol_slots": [],
    "enabled": true
  },
  {
    "id": "lips.ha_lip_filler",
    "worker": "lips",
    "type": "hard",
    "category": "injectable",
    "priority": 78,
    "title_en": "Hyaluronic acid lip filler",
    "title_fr": "Filler lèvres à l'acide hyaluronique",
    "summary_en": "HA filler can improve lip fullness, border, projection and upper/lower ratio when done conservatively.",
    "summary_fr": "Le filler HA peut améliorer volume, bord du vermillon, projection et ratio haut/bas si réalisé de façon conservatrice.",
    "steps": [
      { "en": "Plan ratio and projection before volume.", "fr": "Planifie ratio et projection avant le volume." },
      { "en": "Avoid migration by starting small and respecting anatomy.", "fr": "Évite la migration en commençant petit et en respectant l'anatomie." },
      { "en": "Reassess at 4 weeks, not while swollen.", "fr": "Réévalue à 4 semaines, pas pendant l'œdème." }
    ],
    "duration_value": 1,
    "duration_unit": "session",
    "cost_min": 250,
    "cost_max": 700,
    "cost_currency": "EUR",
    "risk": "medium",
    "evidence": "medical",
    "targets": ["proportions_and_width.lip_fullness", "upper_lip_architecture.vermilion_border", "projection_and_dynamics.lip_projection"],
    "conditions": { "or": [
      { "score_lte": { "key": "proportions_and_width.lip_fullness", "value": 5 } },
      { "score_lte": { "key": "projection_and_dynamics.lip_projection", "value": 5 } }
    ] },
    "source_url": null,
    "protocol_slots": [],
    "enabled": true
  },
  {
    "id": "lips.surgical_lip_lift",
    "worker": "lips",
    "type": "hard",
    "category": "surgery",
    "priority": 74,
    "title_en": "Surgical lip lift",
    "title_fr": "Lip lift chirurgical",
    "summary_en": "A subnasal lip lift shortens a long philtrum, increases upper-lip show and can improve tooth display at rest.",
    "summary_fr": "Un lip lift sous-nasal raccourcit un philtrum long, augmente la lèvre supérieure visible et peut améliorer la visibilité dentaire au repos.",
    "steps": [
      { "en": "Measure philtrum and tooth show before considering surgery.", "fr": "Mesure philtrum et exposition dentaire avant d'envisager la chirurgie." },
      { "en": "Review scar quality and nostril base aesthetics carefully.", "fr": "Analyse soigneusement cicatrice et esthétique de la base nasale." },
      { "en": "Do not combine with aggressive filler before planning.", "fr": "Ne combine pas avec du filler agressif avant planification." }
    ],
    "duration_value": 1,
    "duration_unit": "session",
    "cost_min": 2500,
    "cost_max": 6500,
    "cost_currency": "EUR",
    "risk": "high",
    "evidence": "medical",
    "targets": ["upper_lip_architecture.philtrum_length", "proportions_and_width.upper_lower_ratio", "texture_and_color.perioral_youthfulness"],
    "conditions": { "or": [
      { "score_lte": { "key": "upper_lip_architecture.philtrum_length", "value": 5 } },
      { "score_lte": { "key": "proportions_and_width.upper_lower_ratio", "value": 5 } }
    ] },
    "source_url": null,
    "protocol_slots": [],
    "enabled": true
  }
]
$scoremax_hard_recs$::jsonb) AS x (
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
