-- Phase 12: assistant language and voice preferences per authenticated user.
-- Additive only.

CREATE TABLE IF NOT EXISTS assistant_preferences (
  user_id INTEGER PRIMARY KEY,
  language TEXT NOT NULL DEFAULT 'auto',   -- auto | english | pidgin
  voice_engine TEXT NOT NULL DEFAULT 'neural', -- neural | device
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
