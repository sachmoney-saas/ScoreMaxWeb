-- ===========================================================================
-- Fix 42501 après 20260517180000_billing_hardening_and_stripe_drop.
--
-- Le REVOKE global de la migration de durcissement a coupé l'EXECUTE pour
-- `authenticated` sur deux familles de fonctions qui *doivent* rester
-- accessibles au rôle authentifié :
--
-- 1. SECURITY DEFINER appelées DANS LES POLICIES RLS
--    `scoremax_is_admin(uuid)` est référencée dans 12 policies (profiles,
--    analysis_jobs, analysis_results, analysis_job_assets, scan_sessions,
--    scan_assets, scan_asset_types, scoremax_recommendations,
--    subscription_events, user_subscriptions). Sans EXECUTE pour
--    `authenticated`, toute requête côté client sur ces tables échoue
--    avec "permission denied for function scoremax_is_admin".
--    `scoremax_is_subscriber` et `scoremax_has_premium_access` ne sont
--    actuellement utilisées que côté serveur, mais on rétablit leur GRANT
--    par symétrie : si un jour on les ajoute à une policy RLS, il faut
--    qu'elles soient exécutables. Le risque est nul puisqu'elles font
--    juste des lookups en lecture sur les tables `profiles` /
--    `user_subscriptions` déjà protégées.
--
-- 2. RPC SECURITY DEFINER appelée DIRECTEMENT par le front
--    `get_recent_scan_status(integer)` est invoquée via
--    `supabase.rpc("get_recent_scan_status", ...)` dans
--    `client/src/lib/face-analysis.ts` (page Nouvelle analyse). Le REVOKE
--    a cassé ce chemin.
--
-- Ne sont volontairement PAS restaurées :
--   - les triggers (`set_updated_at`, `scoremax_*_trigger`, ...) :
--     exécutés via le owner de la table, pas besoin de GRANT.
--   - les helpers strictement serveur appelés via service_role
--     (`scoremax_sync_is_subscriber`, `scoremax_mark_has_ever_subscribed`,
--     `scoremax_refresh_scan_session_progress`,
--     `scoremax_purge_client_error_reports`,
--     `scoremax_purge_dodo_webhook_events`, `scoremax_handle_new_user`,
--     `rls_auto_enable`). Le service_role bypass tous les GRANTs.
-- ===========================================================================

BEGIN;

GRANT EXECUTE ON FUNCTION public.scoremax_is_admin(uuid)             TO authenticated;
GRANT EXECUTE ON FUNCTION public.scoremax_is_subscriber(uuid)        TO authenticated;
GRANT EXECUTE ON FUNCTION public.scoremax_has_premium_access(uuid)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_recent_scan_status(integer)     TO authenticated;

COMMIT;
