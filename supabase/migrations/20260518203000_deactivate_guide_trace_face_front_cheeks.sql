-- Repère PNG tutoriel joues frontal : plus généré ni uploadé côté app.
-- Conserver la ligne pour l’historique des `scan_assets` existants ; désactivation catalogue.
UPDATE public.scan_asset_types
SET
  is_active = false,
  label_fr = 'Repère frontal : zones joues (bilatéral) — désactivé',
  updated_at = NOW()
WHERE code = 'GUIDE_TRACE_FACE_FRONT_CHEEKS';
