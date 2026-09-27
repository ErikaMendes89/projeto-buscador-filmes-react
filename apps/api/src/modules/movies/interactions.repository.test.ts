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
    expect(publicListSql).toContain('u.password_hash IS NOT NULL');
    const commonSql = String(vi.mocked(db.query).mock.calls[2]![0]);
    expect(commonSql).toContain('target.list_is_public');
    expect(commonSql).toContain('password_hash IS NOT NULL');
    expect(commonSql).toContain('mine.user_id = $1');
  });

  it('reads the same persisted rows from a fresh repository context and isolates accounts', async () => {
    const rows = new Map<string, Record<string, unknown>>();
    const db = {
      query: vi.fn(async (sql: string, parameters: unknown[] = []) => {
        if (sql.includes('INSERT INTO movie_interactions')) {
          const [userId, movieId, title, posterPath, status, isFavorite] = parameters as [string, number, string, string | null, string, boolean | null];
          const rowKey = `${userId}:${movieId}`;
          const previous = rows.get(rowKey);
          const row = {
            movieId,
            title,
            posterPath,
            status,
            isFavorite: isFavorite ?? previous?.isFavorite ?? false,
            rating: null,
          };
          rows.set(rowKey, row);
          return { rows: [row] };
        }
        if (sql.includes('FROM movie_interactions WHERE user_id = $1')) {
          return { rows: [...rows.entries()].filter(([key]) => key.startsWith(`${parameters[0]}:`)).map(([, row]) => row) };
        }
        return { rows: [] };
      }),
    } as unknown as Pool;
    const firstSessionRepository = new PgInteractionsRepository(db);
    await firstSessionRepository.upsert('user-1', { movieId: 10, title: 'Interestelar', posterPath: null, status: 'watched', isFavorite: true });

    const repositoryAfterNewLogin = new PgInteractionsRepository(db);
    await expect(repositoryAfterNewLogin.listByUser('user-1')).resolves.toMatchObject([
      { movieId: 10, title: 'Interestelar', status: 'watched', isFavorite: true },
    ]);
    await expect(repositoryAfterNewLogin.listByUser('user-2')).resolves.toEqual([]);
  });

  it('uses one conflict-safe row for concurrent changes to the same account and movie', async () => {
    const rows = new Map<string, Record<string, unknown>>();
    const db = {
      query: vi.fn(async (sql: string, parameters: unknown[] = []) => {
        const [userId, movieId, title, posterPath, status, isFavorite] = parameters as [string, number, string, string | null, string, boolean | null];
        const rowKey = `${userId}:${movieId}`;
        const previous = rows.get(rowKey);
        const row = {
          movieId,
          title,
          posterPath,
          status,
          isFavorite: isFavorite ?? previous?.isFavorite ?? false,
          rating: null,
        };
        rows.set(rowKey, row);
        return { rows: [row] };
      }),
    } as unknown as Pool;
    const repository = new PgInteractionsRepository(db);

    await Promise.all([
      repository.upsert('user-1', { movieId: 10, title: 'Interestelar', posterPath: null, status: 'watching', isFavorite: true }),
      repository.upsert('user-1', { movieId: 10, title: 'Interestelar', posterPath: null, status: 'watched' }),
    ]);

    expect(rows.size).toBe(1);
    expect(rows.get('user-1:10')).toMatchObject({ status: 'watched', isFavorite: true });
    expect(db.query).toHaveBeenCalledTimes(2);
    for (const [sql] of vi.mocked(db.query).mock.calls) {
      expect(String(sql)).toContain('ON CONFLICT (user_id, movie_id) DO UPDATE');
      expect(String(sql)).toContain('COALESCE($6, movie_interactions.is_favorite)');
    }
  });
});
