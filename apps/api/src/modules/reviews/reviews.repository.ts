import type { Pool } from 'pg';
import type { CreateReview, Review } from './reviews.types.js';

export interface ReviewsRepository {
  listByMovie(movieId: number): Promise<Review[]>;
  upsert(userId: string, review: CreateReview): Promise<Review>;
}

export class PgReviewsRepository implements ReviewsRepository {
  constructor(private readonly db: Pool) {}

  async listByMovie(movieId: number): Promise<Review[]> {
    const result = await this.db.query(
      `SELECT r.id, r.movie_id AS "movieId", r.title, r.rating::float, r.body,
              json_build_object('username', u.username, 'displayName', u.display_name) AS author,
              r.created_at AS "createdAt"
       FROM reviews r JOIN users u ON u.id = r.user_id
       WHERE r.movie_id = $1 ORDER BY r.created_at DESC`,
      [movieId],
    );
    return result.rows;
  }

  async upsert(userId: string, review: CreateReview): Promise<Review> {
    const result = await this.db.query(
      `INSERT INTO reviews (user_id, movie_id, title, poster_path, rating, body)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id, movie_id) DO UPDATE SET title = EXCLUDED.title,
       poster_path = EXCLUDED.poster_path, rating = EXCLUDED.rating, body = EXCLUDED.body, updated_at = now()
       RETURNING id, movie_id AS "movieId", title, rating::float, body, created_at AS "createdAt"`,
      [userId, review.movieId, review.title, review.posterPath, review.rating, review.body],
    );
    const user = await this.db.query('SELECT username, display_name AS "displayName" FROM users WHERE id = $1', [userId]);
    return { ...result.rows[0], author: user.rows[0] };
  }
}
