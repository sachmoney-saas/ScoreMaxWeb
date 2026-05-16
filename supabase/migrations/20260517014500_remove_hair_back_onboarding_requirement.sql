-- Stop requiring/capturing the legacy hair-back onboarding image.
-- Existing HAIR_BACK scan_assets remain for historical analyses.

UPDATE public.scan_asset_types
SET is_required_onboarding = false,
    sort_order = 7,
    updated_at = now()
WHERE code = 'HAIR_BACK';

UPDATE public.scan_asset_types
SET is_required_onboarding = true,
    sort_order = 7,
    updated_at = now()
WHERE code = 'EYE_CLOSEUP';

ALTER TABLE public.scan_sessions
ALTER COLUMN required_asset_count SET DEFAULT 7;

SELECT public.scoremax_refresh_scan_session_progress(id)
FROM public.scan_sessions
WHERE source IN ('onboarding', 'manual_rescan')
  AND status IN ('collecting', 'ready', 'processing');
