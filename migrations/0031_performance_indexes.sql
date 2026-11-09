-- Phase 31: performance indexes for hot list, auth-throttle and ledger queries.
-- Additive only. Roll back with the DROP INDEX statements in migrations/rollback
-- if a deployment needs to be reverted.
PRAGMA foreign_keys = ON;

-- Client lists are filtered by is_deleted and sorted by created_at, often
-- within a branch. Without this pair SQLite scans the table and builds a
-- temporary B-tree for every page load.
CREATE INDEX IF NOT EXISTS idx_clients_active_created
  ON clients(is_deleted, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clients_branch_active_created
  ON clients(is_deleted, assigned_branch_id, created_at DESC);

-- Login throttling counts failures by action + identifier in a short window.
CREATE INDEX IF NOT EXISTS idx_audit_rate_limit
  ON audit_logs(action, target_id, created_at);

-- Client statements and defaulting checks filter payments by client + status.
CREATE INDEX IF NOT EXISTS idx_payments_client_status
  ON payments(client_id, status);

-- Commission views filter by recipient and status, then order by created_at.
CREATE INDEX IF NOT EXISTS idx_commission_recipient_status_created
  ON commission_entries(recipient_user_id, status, created_at DESC);

-- Public property listings filter the visibility flags and order by id.
CREATE INDEX IF NOT EXISTS idx_properties_public_listing
  ON properties(is_published, is_archived, is_demo, is_internal_test, id DESC);
