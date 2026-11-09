import { randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg, { type Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PgConversationsRepository } from './conversations.repository.js';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const schema = 'moviematch_conversations_test';
const sqlDirectory = join(dirname(fileURLToPath(import.meta.url)), '../../../sql');
let pool: Pool | undefined;
let adminPool: Pool | undefined;
let conversations: PgConversationsRepository;

async function prepareTestDatabase() {
  if (!testDatabaseUrl) throw new Error('TEST_DATABASE_URL não configurada');
  const databaseUrl = new URL(testDatabaseUrl);
  const databaseName = decodeURIComponent(databaseUrl.pathname.slice(1));
  if (!/(^|[_-])test($|[_-])/i.test(databaseName)) {
    throw new Error('TEST_DATABASE_URL deve apontar para um banco dedicado cujo nome contenha "test"');
  }

  adminPool = new pg.Pool({ connectionString: testDatabaseUrl, max: 2 });
  await adminPool.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
  pool = new pg.Pool({
    connectionString: testDatabaseUrl,
    max: 4,
    options: `-c search_path=${schema},public`,
  });
  const client = await pool.connect();
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      filename text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    const migrations = (await readdir(sqlDirectory)).filter((file) => file.endsWith('.sql')).sort();
    for (const filename of migrations) {
      const alreadyApplied = await client.query('SELECT 1 FROM schema_migrations WHERE filename = $1', [filename]);
      if (alreadyApplied.rowCount) continue;
      await client.query('BEGIN');
      try {
        await client.query(await readFile(join(sqlDirectory, filename), 'utf8'));
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [filename]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  } finally {
    client.release();
  }
  conversations = new PgConversationsRepository(pool);
}

async function createConversationPair() {
  const firstId = randomUUID();
  const secondId = randomUUID();
  await pool!.query(
    `INSERT INTO users (id, username, display_name, email, password_hash)
     VALUES ($1, $2, 'Primeira pessoa', $3, 'test-hash'), ($4, $5, 'Segunda pessoa', $6, 'test-hash')`,
    [firstId, `first_${firstId.slice(0, 8)}`, `${firstId}@test.local`, secondId, `second_${secondId.slice(0, 8)}`, `${secondId}@test.local`],
  );
  await pool!.query('INSERT INTO follows (follower_id, followed_id) VALUES ($1, $2), ($2, $1)', [firstId, secondId]);
  const conversation = await conversations.createIndividual(firstId, secondId);
  if (!conversation) throw new Error('Não foi possível criar a conversa de teste');
  return { firstId, secondId, conversationId: conversation.id };
}

async function insertMessages(conversationId: string, senderId: string) {
  const messageIds = [randomUUID(), randomUUID(), randomUUID()];
  await pool!.query(
    `INSERT INTO messages (id, conversation_id, sender_id, client_message_id, body, created_at)
     VALUES ($1, $4, $5, $6, 'mensagem 1', '2026-01-01T00:00:01Z'),
            ($2, $4, $5, $7, 'mensagem 2', '2026-01-01T00:00:02Z'),
            ($3, $4, $5, $8, 'mensagem 3', '2026-01-01T00:00:03Z')`,
    [messageIds[0], messageIds[1], messageIds[2], conversationId, senderId, randomUUID(), randomUUID(), randomUUID()],
  );
  return messageIds;
}

describe.skipIf(!testDatabaseUrl)('PgConversationsRepository PostgreSQL integration', () => {
  beforeAll(prepareTestDatabase);
  afterAll(async () => {
    await pool?.end();
    await adminPool?.end();
  });

  it('returns page and total from one snapshot, including an empty page', async () => {
    const { firstId, secondId, conversationId } = await createConversationPair();
    const messageIds = await insertMessages(conversationId, firstId);

    const page = await conversations.listMessages(conversationId, firstId, 2, 2);
    expect(page.status).toBe('ok');
    if (page.status === 'ok') {
      expect(page.totalResults).toBe(3);
      expect(page.items).toHaveLength(1);
      expect(page.items[0]?.id).toBe(messageIds[0]);
    }

    const emptyPage = await conversations.listMessages(conversationId, firstId, 5, 2);
    expect(emptyPage).toMatchObject({ status: 'ok', items: [], totalResults: 3 });
    await expect(conversations.listMessages(conversationId, randomUUID(), 1, 20)).resolves.toEqual({ status: 'not_participant' });
    await expect(conversations.markMessagesRead(conversationId, randomUUID())).resolves.toEqual({ status: 'not_participant' });
    const readBySecond = await pool!.query('SELECT count(*)::int AS count FROM message_reads WHERE conversation_id = $1 AND user_id = $2', [conversationId, secondId]);
    expect(readBySecond.rows[0]?.count).toBe(0);
  });

  it('denies page, cursor recovery, and read receipts for blocks in either direction', async () => {
    for (const blockerIsFirst of [true, false]) {
      const { firstId, secondId, conversationId } = await createConversationPair();
      await insertMessages(conversationId, firstId);
      const blockerId = blockerIsFirst ? firstId : secondId;
      const blockedId = blockerIsFirst ? secondId : firstId;
      await pool!.query('INSERT INTO user_blocks (blocker_id, blocked_id) VALUES ($1, $2)', [blockerId, blockedId]);

      await expect(conversations.listMessages(conversationId, secondId, 1, 20)).resolves.toEqual({ status: 'blocked' });
      await expect(conversations.listMessagesAfter(conversationId, secondId, randomUUID(), 20)).resolves.toEqual({ status: 'blocked' });
      await expect(conversations.markMessagesRead(conversationId, secondId)).resolves.toEqual({ status: 'blocked' });
      const receipts = await pool!.query('SELECT count(*)::int AS count FROM message_reads WHERE conversation_id = $1', [conversationId]);
      expect(receipts.rows[0]?.count).toBe(0);
    }
  });

  it('recovers cursor batches and marks received messages read for an authorized participant', async () => {
    const { firstId, secondId, conversationId } = await createConversationPair();
    const [firstMessageId] = await insertMessages(conversationId, firstId);

    await expect(conversations.listMessagesAfter(conversationId, secondId, firstMessageId!, 1)).resolves.toMatchObject({ status: 'ok', hasMore: true });
    await expect(conversations.markMessagesRead(conversationId, secondId)).resolves.toEqual({ status: 'ok', updatedCount: 3 });
    const receipts = await pool!.query('SELECT count(*)::int AS count FROM message_reads WHERE conversation_id = $1 AND user_id = $2', [conversationId, secondId]);
    expect(receipts.rows[0]?.count).toBe(3);
  });

  it('reports success with zero updated receipts when an authorized conversation has no messages', async () => {
    const { firstId, conversationId } = await createConversationPair();

    await expect(conversations.markMessagesRead(conversationId, firstId)).resolves.toEqual({ status: 'ok', updatedCount: 0 });
  });

  it('uses each READ COMMITTED statement snapshot when a block commits between requests', async () => {
    const { firstId, secondId, conversationId } = await createConversationPair();
    await insertMessages(conversationId, firstId);
    const reader = await pool!.connect();
    try {
      await reader.query('BEGIN ISOLATION LEVEL READ COMMITTED');
      const transactionRepository = new PgConversationsRepository({ query: reader.query.bind(reader) } as unknown as Pool);
      await expect(transactionRepository.listMessages(conversationId, secondId, 1, 20)).resolves.toMatchObject({ status: 'ok', totalResults: 3 });

      await pool!.query('INSERT INTO user_blocks (blocker_id, blocked_id) VALUES ($1, $2)', [firstId, secondId]);
      await expect(transactionRepository.listMessages(conversationId, secondId, 1, 20)).resolves.toEqual({ status: 'blocked' });
      await reader.query('COMMIT');
    } catch (error) {
      await reader.query('ROLLBACK');
      throw error;
    } finally {
      reader.release();
    }
  });
});
