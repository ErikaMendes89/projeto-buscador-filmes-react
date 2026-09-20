import type { Pool } from 'pg';
import type { MovieInteraction } from './movies.types.js';

export interface InteractionsRepository {
  listByUser(userId: string): Promise<MovieInteraction[]>;
  upsert(userId: string, interaction: MovieInteraction): Promise<MovieInteraction>;
  remove(userId: string, movieId: number): Promise<void>;
}

export class PgInteractionsRepository implements InteractionsRepository {
  constructor(private readonly db: Pool) {}

  async listByUser(userId: string): Promise<MovieInteraction[]> {
    const result = await this.db.query(
      `SELECT movie_id AS "movieId", title, poster_path AS "posterPath", status, rating
       FROM movie_interactions WHERE user_id = $1 ORDER BY updated_at DESC`,
      [userId],
    );
    return result.rows;
  }

  async upsert(userId: string, interaction: MovieInteraction): Promise<MovieInteraction> {
    const result = await this.db.query(
      `INSERT INTO movie_interactions (user_id, movie_id, title, poster_path, status)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, movie_id) DO UPDATE SET title = EXCLUDED.title,
       poster_path = EXCLUDED.poster_path, status = EXCLUDED.status, updated_at = now()
       RETURNING movie_id AS "movieId", title, poster_path AS "posterPath", status, rating`,
      [userId, interaction.movieId, interaction.title, interaction.posterPath, interaction.status],
    );
    return result.rows[0];
  }

  async remove(userId: string, movieId: number): Promise<void> {
    await this.db.query('DELETE FROM movie_interactions WHERE user_id = $1 AND movie_id = $2', [userId, movieId]);
  }
}
