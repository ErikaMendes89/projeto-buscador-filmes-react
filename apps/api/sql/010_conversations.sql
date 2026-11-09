CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('individual', 'group')),
  direct_user_low_id uuid REFERENCES users(id) ON DELETE CASCADE,
  direct_user_high_id uuid REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (kind = 'individual'
      AND direct_user_low_id IS NOT NULL
      AND direct_user_high_id IS NOT NULL
      AND direct_user_low_id < direct_user_high_id)
    OR
    (kind = 'group'
      AND direct_user_low_id IS NULL
      AND direct_user_high_id IS NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS conversations_individual_pair_idx
  ON conversations (direct_user_low_id, direct_user_high_id)
  WHERE kind = 'individual';

CREATE INDEX IF NOT EXISTS conversations_updated_idx ON conversations (updated_at DESC);

CREATE TABLE IF NOT EXISTS conversation_participants (
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS conversation_participants_user_idx
  ON conversation_participants (user_id, joined_at DESC, conversation_id);

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  body text NOT NULL CHECK (length(btrim(body)) > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, id),
  FOREIGN KEY (conversation_id, sender_id)
    REFERENCES conversation_participants (conversation_id, user_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS messages_conversation_created_idx
  ON messages (conversation_id, created_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS message_reads (
  conversation_id uuid NOT NULL,
  message_id uuid NOT NULL,
  user_id uuid NOT NULL,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id),
  FOREIGN KEY (conversation_id, message_id)
    REFERENCES messages (conversation_id, id) ON DELETE CASCADE,
  FOREIGN KEY (conversation_id, user_id)
    REFERENCES conversation_participants (conversation_id, user_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS message_reads_conversation_user_idx
  ON message_reads (conversation_id, user_id, read_at DESC);
