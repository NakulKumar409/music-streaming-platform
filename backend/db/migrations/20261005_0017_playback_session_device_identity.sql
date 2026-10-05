-- Prevent same-device playback leases from leaking across app restarts / force-closes.
-- Existing rows remain compatible; clients that do not send a device id continue
-- to use the legacy concurrency behavior.

ALTER TABLE playback_sessions
  ADD COLUMN IF NOT EXISTS device_id TEXT;

CREATE INDEX IF NOT EXISTS idx_playback_sessions_active_user_device
  ON playback_sessions (user_id, device_id, heartbeat_at DESC)
  WHERE ended_at IS NULL AND device_id IS NOT NULL;
