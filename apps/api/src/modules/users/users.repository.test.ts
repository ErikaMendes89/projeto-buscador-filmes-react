import type { Pool } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { PgUsersRepository } from './users.repository.js';

describe('PgUsersRepository', () => {
  it('does not expose passwordless demo accounts as public profiles', async () => {
    const db = { query: vi.fn(async () => ({ rows: [] })) } as unknown as Pool;
    const repository = new PgUsersRepository(db);

    await expect(repository.findByUsername('erika')).resolves.toBeNull();
    const [sql] = vi.mocked(db.query).mock.calls[0]!;
    expect(String(sql)).toContain('password_hash IS NOT NULL');
    expect(String(sql)).not.toContain('email');
    expect(String(sql)).not.toContain('session');
    expect(String(sql)).toContain('followersCount');
    expect(String(sql)).toContain('followingCount');
  });

  it('calculates follower and following totals from follow rows for public profiles', async () => {
    const db = { query: vi.fn(async () => ({ rows: [{ id: 'user-1', username: 'alice', followersCount: 3, followingCount: 2 }] })) } as unknown as Pool;
    const repository = new PgUsersRepository(db);

    await expect(repository.findByUsername('alice')).resolves.toMatchObject({ followersCount: 3, followingCount: 2 });
    expect(String(vi.mocked(db.query).mock.calls[0]![0])).toContain('FROM follows f WHERE f.followed_id = users.id');
    expect(String(vi.mocked(db.query).mock.calls[0]![0])).toContain('FROM follows f WHERE f.follower_id = users.id');
  });

  it('paginates case-insensitive username matches and counts only public accounts', async () => {
    const user = { id: 'user-1', username: 'alice', displayName: 'Alice', bio: null, createdAt: new Date('2026-01-01') };
    const db = { query: vi.fn()
      .mockResolvedValueOnce({ rows: [user] })
      .mockResolvedValueOnce({ rows: [{ totalResults: 41 }] }) } as unknown as Pool;
    const repository = new PgUsersRepository(db);

    await expect(repository.searchByUsername('ali', 2, 20)).resolves.toEqual({ items: [user], totalResults: 41 });
    const [listSql, listParameters] = vi.mocked(db.query).mock.calls[0]!;
    const [countSql, countParameters] = vi.mocked(db.query).mock.calls[1]!;
    expect(String(listSql)).toContain('position(lower($1) in lower(username)) > 0');
    expect(String(listSql)).toContain('password_hash IS NOT NULL');
    expect(String(listSql)).toContain('ORDER BY username LIMIT $2 OFFSET $3');
    expect(listParameters).toEqual(['ali', 20, 20]);
    expect(String(countSql)).toContain('password_hash IS NOT NULL');
    expect(countParameters).toEqual(['ali']);
  });
});
