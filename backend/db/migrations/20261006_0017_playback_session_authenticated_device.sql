-- Bind playback leases to the authenticated device session.
-- Existing active rows cannot be attributed safely, so retire them once during
-- rollout. Clients recover by requesting a fresh protected playback descriptor.

ALTER TABLE playback_sessions
  ADD COLUMN IF NOT EXISTS device_id TEXT;

UPDATE playback_sessions
   SET ended_at = now(), heartbeat_at = now()
 WHERE ended_at IS NULL
   AND device_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_playback_sessions_active_user_device
  ON playback_sessions (user_id, device_id, heartbeat_at DESC)
  WHERE ended_at IS NULL AND device_id IS NOT NULL;
