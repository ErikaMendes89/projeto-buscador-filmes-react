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
    const db = { query: vi.fn(async () => ({ rows: [] })) } as unknown as Pool;
    const repository = new PgSocialRepository(db);

    await repository.follow('viewer-id', 'target-id');
    await repository.unfollow('viewer-id', 'target-id');

    expect(String(vi.mocked(db.query).mock.calls[0]![0])).toContain('ON CONFLICT DO NOTHING');
    expect(vi.mocked(db.query).mock.calls[0]![1]).toEqual(['viewer-id', 'target-id']);
    expect(String(vi.mocked(db.query).mock.calls[1]![0])).toContain('WHERE follower_id = $1 AND followed_id = $2');
    expect(vi.mocked(db.query).mock.calls[1]![1]).toEqual(['viewer-id', 'target-id']);
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
    expect(String(itemsSql)).toContain('ORDER BY r.created_at DESC, r.id DESC LIMIT $2 OFFSET $3');
    expect(itemsParams).toEqual(['viewer-id', 20, 20]);
    expect(String(countSql)).toContain('FROM reviews r');
    expect(String(countSql)).toContain('f.follower_id = $1 AND f.followed_id = r.user_id');
    expect(String(countSql)).toContain('r.user_id = $1 OR u.list_is_public = true');
    expect(countParams).toEqual(['viewer-id']);
  });
});
