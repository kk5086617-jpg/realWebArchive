CREATE TABLE IF NOT EXISTS archive_users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(32) NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS archive_users_username_unique ON archive_users (lower(username));

CREATE TABLE IF NOT EXISTS archive_sessions (
  token_hash CHAR(64) PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES archive_users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS archive_sessions_expiry ON archive_sessions (expires_at);
