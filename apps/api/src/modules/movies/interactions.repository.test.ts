import { describe, expect, it, vi } from 'vitest';
import type { Pool } from 'pg';
import { PgInteractionsRepository } from './interactions.repository.js';

describe('PgInteractionsRepository', () => {
  it('returns favorite separately and preserves it when an update omits isFavorite', async () => {
    const db = { query: vi.fn(async () => ({ rows: [{ movieId: 10, title: 'Filme', posterPath: null, status: 'watched', isFavorite: true, rating: null }] })) } as unknown as Pool;
    const repository = new PgInteractionsRepository(db);

    await expect(repository.listByUser('user-1')).resolves.toMatchObject([{ status: 'watched', isFavorite: true }]);
    await expect(repository.upsert('user-1', { movieId: 10, title: 'Filme', posterPath: null, status: 'watched' }))
      .resolves.toMatchObject({ status: 'watched', isFavorite: true });
    const [, parameters] = vi.mocked(db.query).mock.calls[1]!;
    expect(parameters).toEqual(['user-1', 10, 'Filme', null, 'watched', null]);
    const updateQuery = String(vi.mocked(db.query).mock.calls[1]![0]);
    expect(updateQuery).toContain('COALESCE($6, movie_interactions.is_favorite)');
    expect(updateQuery).toContain('ON CONFLICT (user_id, movie_id)');
    expect(String(vi.mocked(db.query).mock.calls[0]![0])).toContain('WHERE user_id = $1');

    await repository.remove('user-2', 10);
    expect(vi.mocked(db.query).mock.calls[2]![1]).toEqual(['user-2', 10]);
    expect(String(vi.mocked(db.query).mock.calls[2]![0])).toContain('WHERE user_id = $1 AND movie_id = $2');
  });

  it('returns movie lists and common movies only through public visibility queries', async () => {
    const db = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [{ isPublic: false, movieId: null, title: null, posterPath: null, status: null, isFavorite: null }] })
        .mockResolvedValueOnce({ rows: [
          { isPublic: true, movieId: null, title: null, posterPath: null, status: null, isFavorite: null },
          { isPublic: true, movieId: 10, title: 'Filme público', posterPath: null, status: 'watched', isFavorite: false },
        ] })
        .mockResolvedValueOnce({ rows: [{ isPublic: false, matched: false, movieId: null, title: null, posterPath: null, status: null, isFavorite: null }] })
        .mockResolvedValueOnce({ rows: [{ isPublic: true, matched: false, movieId: 10, title: 'Filme sem correspondência', posterPath: null, status: 'watched', isFavorite: false }] }),
    } as unknown as Pool;
    const repository = new PgInteractionsRepository(db);

    await expect(repository.listPublicByUsername('alice')).resolves.toBeNull();
    await expect(repository.listPublicByUsername('alice')).resolves.toMatchObject([{ movieId: 10, title: 'Filme público' }]);
    await expect(repository.listCommonWithPublicUser('viewer-1', 'alice')).resolves.toEqual({ isPublic: false, items: [] });
    await expect(repository.listCommonWithPublicUser('viewer-1', 'alice')).resolves.toEqual({ isPublic: true, items: [] });

    const publicListSql = String(vi.mocked(db.query).mock.calls[1]![0]);
    expect(publicListSql).toContain('u.list_is_public');
    expect(publicListSql).toContain('AND u.list_is_public');
    const commonSql = String(vi.mocked(db.query).mock.calls[2]![0]);
    expect(commonSql).toContain('target.list_is_public');
    expect(commonSql).toContain('mine.user_id = $1');
  });
});
