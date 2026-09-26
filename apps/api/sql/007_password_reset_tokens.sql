CREATE TABLE IF NOT EXISTS password_reset_tokens (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  token_hash char(64) UNIQUE NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS password_reset_tokens_expiry_idx ON password_reset_tokens (expires_at);
