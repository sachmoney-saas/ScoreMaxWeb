-- Retire le worker `ear` des résultats persistés et des payloads de requête historiques.
-- À appliquer une fois sur l'environnement cible (déjà exécuté sur ScoreMaxApp via Supabase).

DELETE FROM public.analysis_results WHERE worker = 'ear';

UPDATE public.analysis_jobs
SET request_payload = jsonb_set(
  request_payload,
  '{analyses}',
  COALESCE(
    (
      SELECT jsonb_agg(elem)
      FROM jsonb_array_elements(request_payload->'analyses') AS elem
      WHERE elem->>'worker' IS DISTINCT FROM 'ear'
    ),
    '[]'::jsonb
  )
)
WHERE request_payload IS NOT NULL
  AND jsonb_typeof(request_payload->'analyses') = 'array'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(request_payload->'analyses') AS e
    WHERE e->>'worker' = 'ear'
  );
