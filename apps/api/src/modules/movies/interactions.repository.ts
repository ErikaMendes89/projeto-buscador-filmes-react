import type { Pool } from 'pg';
import type { MovieInteraction, MovieInteractionInput } from './movies.types.js';

export interface InteractionsRepository {
  listByUser(userId: string): Promise<MovieInteraction[]>;
  getListVisibility(userId: string): Promise<boolean>;
  setListVisibility(userId: string, isPublic: boolean): Promise<boolean>;
  listPublicByUsername(username: string): Promise<MovieInteraction[] | null>;
  listCommonWithPublicUser(userId: string, username: string): Promise<{ isPublic: boolean; items: MovieInteraction[] } | null>;
  upsert(userId: string, interaction: MovieInteractionInput): Promise<MovieInteraction>;
  remove(userId: string, movieId: number): Promise<void>;
}

export class PgInteractionsRepository implements InteractionsRepository {
  constructor(private readonly db: Pool) {}

  async listByUser(userId: string): Promise<MovieInteraction[]> {
    const result = await this.db.query(
      `SELECT movie_id::float8 AS "movieId", title, poster_path AS "posterPath", status, is_favorite AS "isFavorite", rating
       FROM movie_interactions WHERE user_id = $1 ORDER BY updated_at DESC`,
      [userId],
    );
    return result.rows;
  }

  async getListVisibility(userId: string): Promise<boolean> {
    const result = await this.db.query<{ isPublic: boolean }>(
      'SELECT list_is_public AS "isPublic" FROM users WHERE id = $1', [userId],
    );
    return result.rows[0]!.isPublic;
  }

  async setListVisibility(userId: string, isPublic: boolean): Promise<boolean> {
    const result = await this.db.query<{ isPublic: boolean }>(
      'UPDATE users SET list_is_public = $2 WHERE id = $1 RETURNING list_is_public AS "isPublic"', [userId, isPublic],
    );
    return result.rows[0]!.isPublic;
  }

  async listPublicByUsername(username: string): Promise<MovieInteraction[] | null> {
    const result = await this.db.query<{ isPublic: boolean; movieId: number | null; title: string | null; posterPath: string | null; status: MovieInteraction['status'] | null; isFavorite: boolean | null }>(
      `SELECT u.list_is_public AS "isPublic", mi.movie_id::float8 AS "movieId", mi.title,
              mi.poster_path AS "posterPath", mi.status, mi.is_favorite AS "isFavorite"
       FROM users u LEFT JOIN movie_interactions mi ON mi.user_id = u.id AND u.list_is_public
       WHERE u.username = $1 AND u.password_hash IS NOT NULL ORDER BY mi.updated_at DESC NULLS LAST`,
      [username],
    );
    if (!result.rows.length || !result.rows[0]!.isPublic) return null;
    return result.rows.filter((item) => item.movieId !== null).map(({ isPublic: _isPublic, ...item }) => item as MovieInteraction);
  }

  async listCommonWithPublicUser(userId: string, username: string): Promise<{ isPublic: boolean; items: MovieInteraction[] } | null> {
    const result = await this.db.query<{ isPublic: boolean; matched: boolean; movieId: number | null; title: string | null; posterPath: string | null; status: MovieInteraction['status'] | null; isFavorite: boolean | null }>(
      `WITH target AS (SELECT id, list_is_public FROM users WHERE username = $2 AND password_hash IS NOT NULL)
       SELECT target.list_is_public AS "isPublic", (mine.movie_id IS NOT NULL) AS matched,
              other.movie_id::float8 AS "movieId", other.title,
              other.poster_path AS "posterPath", other.status, other.is_favorite AS "isFavorite"
       FROM target
       LEFT JOIN movie_interactions other ON other.user_id = target.id AND target.list_is_public
       LEFT JOIN movie_interactions mine ON mine.user_id = $1 AND mine.movie_id = other.movie_id
       ORDER BY other.updated_at DESC NULLS LAST`,
      [userId, username],
    );
    if (!result.rows.length) return null;
    const isPublic = result.rows[0]!.isPublic;
    const items = result.rows.filter((item) => item.matched).map(({ isPublic: _isPublic, matched: _matched, ...item }) => item as MovieInteraction);
    return { isPublic, items };
  }

  async upsert(userId: string, interaction: MovieInteractionInput): Promise<MovieInteraction> {
    const result = await this.db.query(
      `INSERT INTO movie_interactions (user_id, movie_id, title, poster_path, status, is_favorite)
       VALUES ($1, $2, $3, $4, $5, COALESCE($6, false))
       ON CONFLICT (user_id, movie_id) DO UPDATE SET title = EXCLUDED.title,
       poster_path = EXCLUDED.poster_path, status = EXCLUDED.status,
       is_favorite = COALESCE($6, movie_interactions.is_favorite), updated_at = now()
       RETURNING movie_id::float8 AS "movieId", title, poster_path AS "posterPath", status, is_favorite AS "isFavorite", rating`,
      [userId, interaction.movieId, interaction.title, interaction.posterPath, interaction.status, interaction.isFavorite ?? null],
    );
    return result.rows[0];
  }

  async remove(userId: string, movieId: number): Promise<void> {
    await this.db.query('DELETE FROM movie_interactions WHERE user_id = $1 AND movie_id = $2', [userId, movieId]);
  }
}
