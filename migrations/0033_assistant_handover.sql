-- Phase 9: assistant-assisted human handover.
-- Additive only. No existing table or column changes.

CREATE TABLE IF NOT EXISTS staff_presence (
  user_id INTEGER PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'offline', -- offline | available | busy
  last_seen_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS assistant_handovers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_key TEXT,
  user_id INTEGER,
  client_id INTEGER,
  branch_id INTEGER,
  department TEXT,
  persona_key TEXT,
  staff_user_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'requested', -- requested | accepted | declined | expired
  summary TEXT,
  context_json TEXT,
  requested_at TEXT NOT NULL DEFAULT (datetime('now')),
  responded_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL,
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL,
  FOREIGN KEY (staff_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_staff_presence_seen ON staff_presence(last_seen_at);
CREATE INDEX IF NOT EXISTS idx_handovers_staff_status ON assistant_handovers(staff_user_id, status);
CREATE INDEX IF NOT EXISTS idx_handovers_user ON assistant_handovers(user_id);
CREATE INDEX IF NOT EXISTS idx_handovers_requested ON assistant_handovers(requested_at);
