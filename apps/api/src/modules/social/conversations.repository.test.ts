import type { Pool } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { PgConversationsRepository } from './conversations.repository.js';

describe('PgConversationsRepository', () => {
  it('creates one canonical individual conversation and both participant rows atomically', async () => {
    const client = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 'conversation-1' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] }),
      release: vi.fn(),
    };
    const db = { connect: vi.fn(async () => client) } as unknown as Pool;
    const repository = new PgConversationsRepository(db);

    await expect(repository.createIndividual('z-user', 'a-user')).resolves.toEqual({ id: 'conversation-1', created: true });
    const sql = client.query.mock.calls.map(([statement]) => String(statement));
    expect(sql).toContain('BEGIN');
    expect(sql.some((statement) => statement.includes('pg_advisory_xact_lock'))).toBe(true);
    expect(sql.some((statement) => statement.includes('FROM user_blocks'))).toBe(true);
    expect(sql.some((statement) => statement.includes('INSERT INTO conversation_participants'))).toBe(true);
    expect(sql).toContain('COMMIT');
    expect(client.query.mock.calls[5]?.[1]).toEqual(['conversation-1', 'a-user', 'z-user']);
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('does not create or return a conversation when either participant blocked the other', async () => {
    const client = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ '?column?': 1 }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [] }),
      release: vi.fn(),
    };
    const db = { connect: vi.fn(async () => client) } as unknown as Pool;
    const repository = new PgConversationsRepository(db);

    await expect(repository.createIndividual('viewer-id', 'peer-id')).resolves.toBeNull();
    expect(client.query.mock.calls.map(([statement]) => String(statement))).toContain('ROLLBACK');
    expect(client.query.mock.calls.some(([statement]) => String(statement).includes('INSERT INTO conversations'))).toBe(false);
  });

  it('returns an existing individual conversation without adding duplicate participants', async () => {
    const client = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [{ id: 'existing-conversation' }] })
        .mockResolvedValueOnce({ rows: [] }),
      release: vi.fn(),
    };
    const db = { connect: vi.fn(async () => client) } as unknown as Pool;
    const repository = new PgConversationsRepository(db);

    await expect(repository.createIndividual('viewer-id', 'peer-id')).resolves.toEqual({ id: 'existing-conversation', created: false });
    expect(client.query.mock.calls.some(([statement]) => String(statement).includes('INSERT INTO conversation_participants'))).toBe(false);
    expect(client.query.mock.calls.map(([statement]) => String(statement))).toContain('COMMIT');
  });

  it('authorizes history and calculates paginated rows and total in one SQL statement', async () => {
    const summary = { id: 'conversation-1' };
    const message = {
      isParticipant: true, isBlocked: false, totalResults: 21,
      id: 'message-1', conversationId: 'conversation-1', clientMessageId: 'client-1', body: 'Olá', movie: null,
      sender: { username: 'alice', displayName: 'Alice' }, createdAt: new Date('2026-01-01T00:00:00Z'),
    };
    const db = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [summary] })
        .mockResolvedValueOnce({ rows: [message] }),
    } as unknown as Pool;
    const repository = new PgConversationsRepository(db);

    await expect(repository.listForUser('viewer-id')).resolves.toEqual([summary]);
    await expect(repository.listMessages('conversation-1', 'viewer-id', 2, 20)).resolves.toEqual({ status: 'ok', items: [{
      id: 'message-1', conversationId: 'conversation-1', clientMessageId: 'client-1', body: 'Olá', movie: null,
      sender: { username: 'alice', displayName: 'Alice' }, createdAt: new Date('2026-01-01T00:00:00Z'),
    }], totalResults: 21 });

    const statements = vi.mocked(db.query).mock.calls.map(([statement]) => String(statement));
    expect(statements[0]).toContain('mine.user_id = $1');
    expect(statements[0]).toContain('unreadCount');
    expect(statements[0]).toContain('FROM message_reads read_receipt');
    expect(statements[1]).toContain('user_blocks');
    expect(statements[1]).toContain('total AS MATERIALIZED');
    expect(statements[1]).toContain('LEFT JOIN page ON true');
    expect(statements[1]).toContain('m.client_message_id AS "clientMessageId"');
    expect(vi.mocked(db.query).mock.calls[1]?.[1]).toEqual(['conversation-1', 'viewer-id', 20, 20]);
  });

  it('authorizes cursor recovery and mark-read writes inside their SQL statements', async () => {
    const recovered = {
      isParticipant: true, isBlocked: false,
      id: 'message-2', conversationId: 'conversation-1', clientMessageId: 'client-2', body: 'Novo', movie: null,
      sender: { username: 'alice', displayName: 'Alice' }, createdAt: new Date('2026-01-01T00:00:01Z'),
    };
    const db = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [recovered] })
        .mockResolvedValueOnce({ rows: [{ isParticipant: true, isBlocked: false, updatedCount: 1 }] }),
    } as unknown as Pool;
    const repository = new PgConversationsRepository(db);

    await expect(repository.listMessagesAfter('conversation-1', 'viewer-id', 'message-1', 100)).resolves.toEqual({ status: 'ok', items: [{
      id: 'message-2', conversationId: 'conversation-1', clientMessageId: 'client-2', body: 'Novo', movie: null,
      sender: { username: 'alice', displayName: 'Alice' }, createdAt: new Date('2026-01-01T00:00:01Z'),
    }], hasMore: false });
    await expect(repository.markMessagesRead('conversation-1', 'viewer-id')).resolves.toEqual({ status: 'ok', updatedCount: 1 });
    const statements = vi.mocked(db.query).mock.calls.map(([statement]) => String(statement));
    expect(statements[0]).toContain('user_blocks');
    expect(statements[0]).toContain('cursor_message.id = $3');
    expect(vi.mocked(db.query).mock.calls[0]?.[1]).toEqual(['conversation-1', 'viewer-id', 'message-1', 101]);
    expect(statements[1]).toContain('INSERT INTO message_reads');
    expect(statements[1]).toContain('JOIN authorized a');
    expect(statements[1]).toContain('isParticipant');
    expect(statements[1]).toContain('ON CONFLICT (message_id, user_id) DO UPDATE SET read_at = now()');
    expect(statements[1]).toContain('m.sender_id <> $2');
  });

  it('persists a message only after checking membership, blocks, and mutual follows in one transaction', async () => {
    const client = {
      query: vi.fn(async (statement: unknown) => {
        const sql = String(statement);
        if (sql.includes('SELECT other.user_id')) return { rows: [{ peerId: 'peer-id' }], rowCount: 1 };
        if (sql.includes('FROM user_blocks')) return { rows: [], rowCount: 0 };
        if (sql.includes('WHERE conversation_id = $1 AND sender_id = $2 AND client_message_id = $3')) return { rows: [], rowCount: 0 };
        if (sql.includes('AS mutual')) return { rows: [{ mutual: true }], rowCount: 1 };
        if (sql.includes('INSERT INTO messages')) return { rows: [{ id: 'message-1', body: 'Olá', clientMessageId: 'client-id', createdAt: new Date('2026-01-01T00:00:00Z') }], rowCount: 1 };
        if (sql.includes('SELECT username')) return { rows: [{ username: 'sender', displayName: 'Sender' }], rowCount: 1 };
        return { rows: [], rowCount: 0 };
      }),
      release: vi.fn(),
    };
    const db = { connect: vi.fn(async () => client) } as unknown as Pool;
    const repository = new PgConversationsRepository(db);

    await expect(repository.sendMessage('conversation-1', 'sender-id', 'client-id', 'Olá')).resolves.toEqual({
      status: 'sent',
      created: true,
      recipientId: 'peer-id',
      message: {
        id: 'message-1', conversationId: 'conversation-1', clientMessageId: 'client-id', body: 'Olá', movie: null,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        sender: { username: 'sender', displayName: 'Sender' },
      },
    });
    const statements = client.query.mock.calls.map(([statement]) => String(statement));
    expect(statements).toContain('BEGIN');
    expect(statements.some((statement) => statement.includes('pg_advisory_xact_lock'))).toBe(true);
    expect(statements.some((statement) => statement.includes('FROM user_blocks'))).toBe(true);
    expect(statements.some((statement) => statement.includes('AS mutual'))).toBe(true);
    expect(statements.some((statement) => statement.includes('INSERT INTO messages') && statement.includes('ON CONFLICT'))).toBe(true);
    expect(statements).toContain('COMMIT');
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('rejects blocked or non-mutual conversations without inserting a message', async () => {
    const makeClient = (blocked: boolean, mutual: boolean) => ({
      query: vi.fn(async (statement: unknown) => {
        const sql = String(statement);
        if (sql.includes('SELECT other.user_id')) return { rows: [{ peerId: 'peer-id' }], rowCount: 1 };
        if (sql.includes('FROM user_blocks')) return { rows: blocked ? [{ id: 1 }] : [], rowCount: blocked ? 1 : 0 };
        if (sql.includes('WHERE conversation_id = $1 AND sender_id = $2 AND client_message_id = $3')) return { rows: [], rowCount: 0 };
        if (sql.includes('AS mutual')) return { rows: [{ mutual }], rowCount: 1 };
        return { rows: [], rowCount: 0 };
      }),
      release: vi.fn(),
    });

    for (const [blocked, mutual, status] of [
      [true, true, 'blocked'],
      [false, false, 'mutual_follow_required'],
    ] as const) {
      const client = makeClient(blocked, mutual);
      const repository = new PgConversationsRepository({ connect: vi.fn(async () => client) } as unknown as Pool);
      await expect(repository.sendMessage('conversation-1', 'sender-id', 'client-id', 'Olá')).resolves.toMatchObject({ status });
      expect(client.query.mock.calls.some(([statement]) => String(statement).includes('INSERT INTO messages'))).toBe(false);
      expect(client.query.mock.calls.map(([statement]) => String(statement))).toContain('ROLLBACK');
    }
  });

  it('returns a previously persisted message for the same client id and body without requiring a current follow', async () => {
    const createdAt = new Date('2026-01-01T00:00:00Z');
    const client = {
      query: vi.fn(async (statement: unknown) => {
        const sql = String(statement);
        if (sql.includes('SELECT other.user_id')) return { rows: [{ peerId: 'peer-id' }], rowCount: 1 };
        if (sql.includes('FROM user_blocks')) return { rows: [], rowCount: 0 };
        if (sql.includes('WHERE conversation_id = $1 AND sender_id = $2 AND client_message_id = $3')) {
          return { rows: [{ id: 'message-1', body: 'Olá', createdAt }], rowCount: 1 };
        }
        if (sql.includes('SELECT username')) return { rows: [{ username: 'sender', displayName: 'Sender' }], rowCount: 1 };
        return { rows: [], rowCount: 0 };
      }),
      release: vi.fn(),
    };
    const repository = new PgConversationsRepository({ connect: vi.fn(async () => client) } as unknown as Pool);

    await expect(repository.sendMessage('conversation-1', 'sender-id', 'client-id', 'Olá')).resolves.toEqual({
      status: 'sent', created: false, recipientId: 'peer-id',
      message: {
        id: 'message-1', conversationId: 'conversation-1', clientMessageId: 'client-id', body: 'Olá', movie: null, createdAt,
        sender: { username: 'sender', displayName: 'Sender' },
      },
    });
    const statements = client.query.mock.calls.map(([statement]) => String(statement));
    expect(statements.some((statement) => statement.includes('AS mutual'))).toBe(false);
    expect(statements.some((statement) => statement.includes('INSERT INTO messages'))).toBe(false);
    expect(statements).toContain('COMMIT');
  });

  it('rejects reusing a client id with different content', async () => {
    const client = {
      query: vi.fn(async (statement: unknown) => {
        const sql = String(statement);
        if (sql.includes('SELECT other.user_id')) return { rows: [{ peerId: 'peer-id' }], rowCount: 1 };
        if (sql.includes('FROM user_blocks')) return { rows: [], rowCount: 0 };
        if (sql.includes('WHERE conversation_id = $1 AND sender_id = $2 AND client_message_id = $3')) {
          return { rows: [{ id: 'message-1', body: 'Original', createdAt: new Date() }], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }),
      release: vi.fn(),
    };
    const repository = new PgConversationsRepository({ connect: vi.fn(async () => client) } as unknown as Pool);

    await expect(repository.sendMessage('conversation-1', 'sender-id', 'client-id', 'Alterado')).resolves.toEqual({ status: 'idempotency_conflict' });
    const statements = client.query.mock.calls.map(([statement]) => String(statement));
    expect(statements.some((statement) => statement.includes('AS mutual'))).toBe(false);
    expect(statements.some((statement) => statement.includes('INSERT INTO messages'))).toBe(false);
    expect(statements).toContain('ROLLBACK');
  });
});
