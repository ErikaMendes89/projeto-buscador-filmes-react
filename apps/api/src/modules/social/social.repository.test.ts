import type { Pool } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { PgSocialRepository } from './social.repository.js';

describe('PgSocialRepository', () => {
  it('resolves only real accounts and checks the current follow relationship', async () => {
    const db = { query: vi.fn()
      .mockResolvedValueOnce({ rows: [{ id: 'target-id' }] })
      .mockResolvedValueOnce({ rows: [{ following: true }] }) } as unknown as Pool;
    const repository = new PgSocialRepository(db);

    await expect(repository.findUserIdByUsername('alice')).resolves.toBe('target-id');
    await expect(repository.isFollowing('viewer-id', 'target-id')).resolves.toBe(true);
    expect(String(vi.mocked(db.query).mock.calls[0]![0])).toContain('password_hash IS NOT NULL');
    expect(vi.mocked(db.query).mock.calls[0]![1]).toEqual(['alice']);
    expect(String(vi.mocked(db.query).mock.calls[1]![0])).toContain('SELECT EXISTS');
    expect(vi.mocked(db.query).mock.calls[1]![1]).toEqual(['viewer-id', 'target-id']);
  });

  it('scopes follow changes to the authenticated actor and the resolved target', async () => {
    const client = { query: vi.fn(async (_sql: unknown, _params?: unknown[]) => ({ rows: [], rowCount: 0 })), release: vi.fn() };
    const db = { connect: vi.fn(async () => client), query: vi.fn(async () => ({ rows: [] })) } as unknown as Pool;
    const repository = new PgSocialRepository(db);

    await expect(repository.follow('viewer-id', 'target-id')).resolves.toBe(true);
    await repository.unfollow('viewer-id', 'target-id');

    const statements = client.query.mock.calls.map(([sql]) => String(sql));
    expect(statements).toContain('BEGIN');
    expect(statements.some((sql) => sql.includes('pg_advisory_xact_lock'))).toBe(true);
    expect(statements.some((sql) => sql.includes('INSERT INTO follows') && sql.includes('ON CONFLICT DO NOTHING'))).toBe(true);
    expect(client.query.mock.calls.some(([sql, params]) => String(sql).includes('DELETE FROM follows') && params?.[0] === 'viewer-id' && params?.[1] === 'target-id')).toBe(true);
    expect(client.release).toHaveBeenCalledTimes(2);
  });

  it('blocks atomically, removes follows in both directions, and never restores them on unblock', async () => {
    const client = { query: vi.fn(async (_sql: unknown, _params?: unknown[]) => ({ rows: [], rowCount: 0 })), release: vi.fn() };
    const db = { connect: vi.fn(async () => client), query: vi.fn(async () => ({ rows: [] })) } as unknown as Pool;
    const repository = new PgSocialRepository(db);

    await repository.block('viewer-id', 'target-id');
    await repository.unblock('viewer-id', 'target-id');

    const statements = client.query.mock.calls.map(([sql]) => String(sql));
    expect(statements.some((sql) => sql.includes('INSERT INTO user_blocks'))).toBe(true);
    expect(statements.some((sql) => sql.includes('DELETE FROM follows') && sql.includes('follower_id = $2 AND followed_id = $1'))).toBe(true);
    expect(statements.filter((sql) => sql === 'COMMIT')).toHaveLength(2);
    expect(client.release).toHaveBeenCalledTimes(2);
  });

  it('returns directional block state and denies chat if either account blocked the other', async () => {
    const db = { query: vi.fn()
      .mockResolvedValueOnce({ rows: [{ blockedByMe: true, blockedYou: false }] })
      .mockResolvedValueOnce({ rows: [{ allowed: false }] }) } as unknown as Pool;
    const repository = new PgSocialRepository(db);

    await expect(repository.getBlockStatus('viewer-id', 'target-id')).resolves.toEqual({ blockedByMe: true, blockedYou: false });
    await expect(repository.canChat('viewer-id', 'target-id')).resolves.toBe(false);
    expect(String(vi.mocked(db.query).mock.calls[1]![0])).toContain('user_blocks');
  });

  it('paginates current reviews from followed accounts and counts the same authorized rows', async () => {
    const review = { id: 'review-1', title: 'Filme' };
    const db = { query: vi.fn()
      .mockResolvedValueOnce({ rows: [review] })
      .mockResolvedValueOnce({ rows: [{ totalResults: 21 }] }) } as unknown as Pool;
    const repository = new PgSocialRepository(db);

    await expect(repository.getFeed('viewer-id', 2, 20)).resolves.toEqual({ items: [review], totalResults: 21 });
    const [itemsSql, itemsParams] = vi.mocked(db.query).mock.calls[0]!;
    const [countSql, countParams] = vi.mocked(db.query).mock.calls[1]!;
    expect(String(itemsSql)).toContain('EXISTS (');
    expect(String(itemsSql)).toContain('f.follower_id = $1 AND f.followed_id = r.user_id');
    expect(String(itemsSql)).toContain('u.password_hash IS NOT NULL');
    expect(String(itemsSql)).toContain('r.user_id = $1 OR u.list_is_public = true');
    expect(String(itemsSql)).toContain('NOT EXISTS (SELECT 1 FROM user_blocks');
    expect(String(itemsSql)).toContain('(b.blocker_id = $1 AND b.blocked_id = r.user_id) OR (b.blocker_id = r.user_id AND b.blocked_id = $1)');
    expect(String(itemsSql)).toContain('ORDER BY r.created_at DESC, r.id DESC LIMIT $2 OFFSET $3');
    expect(itemsParams).toEqual(['viewer-id', 20, 20]);
    expect(String(countSql)).toContain('FROM reviews r');
    expect(String(countSql)).toContain('f.follower_id = $1 AND f.followed_id = r.user_id');
    expect(String(countSql)).toContain('r.user_id = $1 OR u.list_is_public = true');
    expect(String(countSql)).toContain('NOT EXISTS (SELECT 1 FROM user_blocks');
    expect(String(countSql)).toContain('(b.blocker_id = $1 AND b.blocked_id = r.user_id) OR (b.blocker_id = r.user_id AND b.blocked_id = $1)');
    expect(countParams).toEqual(['viewer-id']);
  });
});
