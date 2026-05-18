-- Keep "recent app scan" launchability tied to one manual_rescan session.
-- The previous function could combine the latest asset of each required type
-- across multiple sessions, then return only the newest session id. The web app
-- would see `is_ready = true` and call `/launch` on a session that might not
-- actually contain every required asset.

CREATE OR REPLACE FUNCTION public.get_recent_scan_status(
  p_window_minutes INTEGER DEFAULT 60
) RETURNS TABLE (
  window_minutes INTEGER,
  required_count INTEGER,
  received_count INTEGER,
  missing_asset_types TEXT[],
  received_asset_types TEXT[],
  latest_session_id UUID,
  latest_captured_at TIMESTAMPTZ,
  is_ready BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $body$
DECLARE
  current_user_id UUID;
  effective_window INTEGER;
  window_start TIMESTAMPTZ;
BEGIN
  current_user_id := auth.uid();

  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'auth.uid() is required';
  END IF;

  effective_window := GREATEST(COALESCE(p_window_minutes, 60), 1);
  window_start := NOW() - make_interval(mins => effective_window);

  RETURN QUERY
  WITH required_codes AS (
    SELECT sat.code
    FROM public.scan_asset_types sat
    WHERE sat.is_active = TRUE
      AND sat.is_required_onboarding = TRUE
  ),
  picked_session AS (
    SELECT
      ss.id AS session_id,
      MAX(COALESCE(sa.captured_at, sa.created_at)) AS latest_captured_at
    FROM public.scan_sessions ss
    JOIN public.scan_assets sa
      ON sa.session_id = ss.id
     AND sa.user_id = ss.user_id
    JOIN required_codes rc
      ON rc.code = sa.asset_type_code
    WHERE ss.user_id = current_user_id
      AND ss.source = 'manual_rescan'
      AND ss.status IN ('collecting', 'ready')
      AND sa.created_at >= window_start
      AND sa.upload_status IN ('uploaded', 'validated')
      AND length(btrim(COALESCE(sa.r2_key, ''))) > 0
    GROUP BY ss.id
    ORDER BY latest_captured_at DESC
    LIMIT 1
  ),
  latest_per_type AS (
    SELECT DISTINCT ON (sa.asset_type_code)
      sa.asset_type_code,
      sa.created_at,
      sa.captured_at
    FROM public.scan_assets sa
    JOIN picked_session ps
      ON ps.session_id = sa.session_id
    JOIN required_codes rc
      ON rc.code = sa.asset_type_code
    WHERE sa.user_id = current_user_id
      AND sa.upload_status IN ('uploaded', 'validated')
      AND length(btrim(COALESCE(sa.r2_key, ''))) > 0
    ORDER BY sa.asset_type_code, sa.created_at DESC
  ),
  required_array AS (
    SELECT COALESCE(array_agg(rc.code ORDER BY rc.code), ARRAY[]::TEXT[]) AS codes
    FROM required_codes rc
  ),
  received_array AS (
    SELECT COALESCE(
      array_agg(lpt.asset_type_code ORDER BY lpt.asset_type_code),
      ARRAY[]::TEXT[]
    ) AS codes
    FROM latest_per_type lpt
  )
  SELECT
    effective_window AS window_minutes,
    COALESCE(array_length(ra.codes, 1), 0) AS required_count,
    COALESCE(array_length(rec.codes, 1), 0) AS received_count,
    ARRAY(
      SELECT missing.missing_code
      FROM unnest(ra.codes) AS missing(missing_code)
      WHERE NOT (missing.missing_code = ANY(rec.codes))
    )::TEXT[] AS missing_asset_types,
    rec.codes AS received_asset_types,
    (SELECT session_id FROM picked_session) AS latest_session_id,
    (SELECT latest_captured_at FROM picked_session) AS latest_captured_at,
    (
      COALESCE(array_length(ra.codes, 1), 0) > 0
      AND COALESCE(array_length(rec.codes, 1), 0) >= COALESCE(array_length(ra.codes, 1), 0)
    ) AS is_ready
  FROM required_array ra
  CROSS JOIN received_array rec;
END;
$body$;

GRANT EXECUTE ON FUNCTION public.get_recent_scan_status(INTEGER) TO authenticated;
