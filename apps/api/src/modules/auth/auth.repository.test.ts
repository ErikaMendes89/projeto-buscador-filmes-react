import type { Pool } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { PgAuthRepository } from './auth.repository.js';

function makeRepository(resetUserId: string | null) {
  const client = {
    query: vi.fn(async (sql: string, _values?: unknown[]) => sql.includes('RETURNING user_id AS "userId"') && resetUserId
      ? { rows: [{ userId: resetUserId }] }
      : { rows: [] }),
    release: vi.fn(),
  };
  const db = {
    query: vi.fn(async () => ({ rows: [] })),
    connect: vi.fn(async () => client),
  } as unknown as Pool;
  return { repository: new PgAuthRepository(db), client, db };
}

describe('PgAuthRepository password reset', () => {
  it('consumes an unexpired token and atomically changes the password and revokes sessions', async () => {
    const { repository, client } = makeRepository('user-1');
    await expect(repository.resetPassword('hashed-reset-token', 'scrypt-hash')).resolves.toBe(true);
    const statements = client.query.mock.calls.map(([sql]) => sql.trim().split(/\s+/).slice(0, 3).join(' '));
    expect(statements).toEqual([
      'BEGIN',
      'DELETE FROM password_reset_tokens',
      'UPDATE users SET',
      'DELETE FROM auth_sessions',
      'COMMIT',
    ]);
    expect(client.query.mock.calls[1]?.[0]).toContain('expires_at > now()');
    expect(client.query.mock.calls[1]?.[1]).toEqual(['hashed-reset-token']);
    expect(client.query.mock.calls[2]?.[1]).toEqual(['user-1', 'scrypt-hash']);
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('rejects a missing or expired token without changing a password', async () => {
    const { repository, client } = makeRepository(null);
    await expect(repository.resetPassword('expired-token-hash', 'scrypt-hash')).resolves.toBe(false);
    expect(client.query.mock.calls.map(([sql]) => sql.trim())).toEqual([
      'BEGIN',
      expect.stringContaining('expires_at > now()'),
      'ROLLBACK',
    ]);
    expect(client.release).toHaveBeenCalledOnce();
  });
});

describe('PgAuthRepository sessions', () => {
  it('does not resolve sessions for passwordless demo accounts', async () => {
    const db = { query: vi.fn(async () => ({ rows: [{ userId: 'user-1' }] })) } as unknown as Pool;
    const repository = new PgAuthRepository(db);
    await expect(repository.findSessionUser('session-hash')).resolves.toBe('user-1');
    const [sql, values] = vi.mocked(db.query).mock.calls[0]!;
    expect(String(sql)).toContain('JOIN users u ON u.id = s.user_id');
    expect(String(sql)).toContain('s.expires_at > now()');
    expect(String(sql)).toContain('u.password_hash IS NOT NULL');
    expect(values).toEqual(['session-hash']);
  });
});
