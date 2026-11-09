import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('conversations migration', () => {
  it('models individual and group conversations, participants, messages, and read state', async () => {
    const migration = await readFile(new URL('../../../sql/010_conversations.sql', import.meta.url), 'utf8');

    expect(migration).toContain('CREATE TABLE IF NOT EXISTS conversations');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS conversation_participants');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS messages');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS message_reads');
    expect(migration).toContain('FOREIGN KEY (conversation_id, sender_id)');
    expect(migration).toContain('FOREIGN KEY (conversation_id, user_id)');
  });

  it('stores individual pairs canonically and uniquely, with query indexes', async () => {
    const migration = await readFile(new URL('../../../sql/010_conversations.sql', import.meta.url), 'utf8');

    expect(migration).toContain('direct_user_low_id < direct_user_high_id');
    expect(migration).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS conversations_individual_pair_idx\s+ON conversations \(direct_user_low_id, direct_user_high_id\)\s+WHERE kind = 'individual'/);
    expect(migration).toContain('conversation_participants_user_idx');
    expect(migration).toContain('messages_conversation_created_idx');
    expect(migration).toContain('message_reads_conversation_user_idx');
  });

  it('adds a required per-sender client message id with a unique idempotency index', async () => {
    const migration = await readFile(new URL('../../../sql/011_message_idempotency.sql', import.meta.url), 'utf8');

    expect(migration).toContain('ALTER TABLE messages ADD COLUMN client_message_id uuid');
    expect(migration).toContain('SET client_message_id = gen_random_uuid()');
    expect(migration).toContain('ALTER COLUMN client_message_id SET NOT NULL');
    expect(migration).toMatch(/CREATE UNIQUE INDEX messages_client_message_id_idx\s+ON messages \(conversation_id, sender_id, client_message_id\)/);
  });
});
