-- Phase 32: retention indexes for the scheduled operational cleanup.
-- Additive only. These indexes keep the cleanup queries cheap as auth attempts,
-- sessions and webhook events accumulate.
PRAGMA foreign_keys = ON;

CREATE INDEX IF NOT EXISTS idx_sessions_expires
  ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_password_reset_expires
  ON password_reset_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_client_reset_expires
  ON client_password_reset_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_login_lockouts_last_failure
  ON login_lockouts(last_failure_at);
CREATE INDEX IF NOT EXISTS idx_audit_created_action
  ON audit_logs(created_at, action);
CREATE INDEX IF NOT EXISTS idx_webhook_created
  ON webhook_events(created_at);
CREATE INDEX IF NOT EXISTS idx_notification_dedupe_created
  ON notification_dedupe(created_at);
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_created
  ON notification_deliveries(created_at);
