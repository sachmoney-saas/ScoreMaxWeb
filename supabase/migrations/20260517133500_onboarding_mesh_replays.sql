CREATE TABLE IF NOT EXISTS public.onboarding_mesh_replays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.scan_sessions(id) ON DELETE CASCADE,
  snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  CONSTRAINT onboarding_mesh_replays_user_session_uidx UNIQUE (user_id, session_id),
  CONSTRAINT onboarding_mesh_replays_snapshot_object CHECK (jsonb_typeof(snapshot) = 'object')
);

CREATE INDEX IF NOT EXISTS onboarding_mesh_replays_user_updated_idx
  ON public.onboarding_mesh_replays (user_id, updated_at DESC);

ALTER TABLE public.onboarding_mesh_replays ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own onboarding mesh replays"
  ON public.onboarding_mesh_replays;
CREATE POLICY "Users can read own onboarding mesh replays"
  ON public.onboarding_mesh_replays
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own onboarding mesh replays"
  ON public.onboarding_mesh_replays;
CREATE POLICY "Users can insert own onboarding mesh replays"
  ON public.onboarding_mesh_replays
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.scan_sessions ss
      WHERE ss.id = session_id
        AND ss.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update own onboarding mesh replays"
  ON public.onboarding_mesh_replays;
CREATE POLICY "Users can update own onboarding mesh replays"
  ON public.onboarding_mesh_replays
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.scan_sessions ss
      WHERE ss.id = session_id
        AND ss.user_id = auth.uid()
    )
  );
