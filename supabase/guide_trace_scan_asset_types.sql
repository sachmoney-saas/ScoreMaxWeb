-- Idempotent seeding: PNG « repères tutoriels » (non requis onboarding / workers ScanFace).

-- À exécuter sur tout projet ayant déjà les 8 types JPEG de base.



INSERT INTO public.scan_asset_types (code, label_fr, is_required_onboarding, sort_order, is_active)

VALUES

  ('GUIDE_TRACE_FACE_FRONT_OVAL', 'Repère frontal : ovale', FALSE, 101, TRUE),

  ('GUIDE_TRACE_FACE_FRONT_NOSE_MOUTH', 'Repère frontal : nez–bouche', FALSE, 102, TRUE),

  ('GUIDE_TRACE_FACE_FRONT_VERTICAL_THIRDS', 'Repère frontal : tiers verticaux', FALSE, 103, TRUE),

  ('GUIDE_TRACE_FACE_FRONT_JAW_ANGLE', 'Repère frontal : angle mâchoire', FALSE, 104, TRUE),
  ('GUIDE_TRACE_FACE_FRONT_SHAPE_CONTOUR', 'Repère frontal : contour forme du visage', FALSE, 110, TRUE),

  ('GUIDE_TRACE_PROFILE_LEFT_JAW', 'Repère profil gauche : mâchoire', FALSE, 105, TRUE),

  ('GUIDE_TRACE_PROFILE_RIGHT_JAW', 'Repère profil droit : mâchoire', FALSE, 106, TRUE),

  ('GUIDE_TRACE_PROFILE_LEFT_NOSE', 'Repère profil gauche : silhouette nez (côté visible)', FALSE, 112, TRUE),

  ('GUIDE_TRACE_PROFILE_RIGHT_NOSE', 'Repère profil droit : silhouette nez (côté visible)', FALSE, 113, TRUE),

  ('GUIDE_TRACE_LOOK_UP_JAW_ARC', 'Repère regard haut : arc mâchoire', FALSE, 107, TRUE),

  ('GUIDE_TRACE_LOOK_DOWN_CROWN_MIRROR', 'Repère couronne (miroir)', FALSE, 108, TRUE),

  ('GUIDE_TRACE_SMILE_LIPS', 'Repère sourire : lèvres', FALSE, 109, TRUE),

  ('GUIDE_TRACE_EYE_CLOSEUP_CONTOURS', 'Repère gros plan œil : contours', FALSE, 111, TRUE)

ON CONFLICT (code) DO UPDATE

SET

  label_fr = EXCLUDED.label_fr,

  is_required_onboarding = EXCLUDED.is_required_onboarding,

  sort_order = EXCLUDED.sort_order,

  is_active = EXCLUDED.is_active,

  updated_at = NOW();

