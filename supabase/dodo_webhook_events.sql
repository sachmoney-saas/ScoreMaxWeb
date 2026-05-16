-- =============================================================================
-- Dodo Payments webhook idempotency ledger (additive, idempotent)
-- =============================================================================
-- Used by server/lib/dodo/webhook.ts:
--   - INSERT (webhook_id, event_type, payload) on first delivery
--   - UPDATE processed_at / error after handling
--   - UNIQUE on webhook_id → Postgres 23505 for duplicate retries
--
-- Access: service role only (RLS enabled, no policies for anon/authenticated).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.dodo_webhook_events (
  webhook_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  error TEXT
);

ALTER TABLE public.dodo_webhook_events ENABLE ROW LEVEL SECURITY;

-- No policies: only supabase service role bypasses RLS for inserts/updates.
