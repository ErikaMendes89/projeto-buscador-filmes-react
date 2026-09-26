ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash text;

CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash char(64) PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auth_sessions_user_idx ON auth_sessions (user_id, expires_at DESC);
CREATE INDEX IF NOT EXISTS auth_sessions_expiry_idx ON auth_sessions (expires_at);
