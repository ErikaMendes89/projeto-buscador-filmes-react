ALTER TABLE messages ADD COLUMN client_message_id uuid;

UPDATE messages
SET client_message_id = gen_random_uuid()
WHERE client_message_id IS NULL;

ALTER TABLE messages
  ALTER COLUMN client_message_id SET NOT NULL;

CREATE UNIQUE INDEX messages_client_message_id_idx
  ON messages (conversation_id, sender_id, client_message_id);
