import type { Pool } from 'pg';

export interface SocialRepository {
  follow(followerId: string, followedId: string): Promise<void>;
  unfollow(followerId: string, followedId: string): Promise<void>;
  getFeed(userId: string): Promise<unknown[]>;
}

export class PgSocialRepository implements SocialRepository {
  constructor(private readonly db: Pool) {}

  async follow(followerId: string, followedId: string): Promise<void> {
    await this.db.query(
      'INSERT INTO follows (follower_id, followed_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [followerId, followedId],
    );
  }

  async unfollow(followerId: string, followedId: string): Promise<void> {
    await this.db.query('DELETE FROM follows WHERE follower_id = $1 AND followed_id = $2', [followerId, followedId]);
  }

  async getFeed(userId: string): Promise<unknown[]> {
    const result = await this.db.query(
      `SELECT r.id, r.movie_id AS "movieId", r.title, r.poster_path AS "posterPath",
              r.rating::float, r.body, r.created_at AS "createdAt",
              json_build_object('username', u.username, 'displayName', u.display_name) AS author
       FROM reviews r
       JOIN users u ON u.id = r.user_id
       WHERE r.user_id = $1 OR r.user_id IN (SELECT followed_id FROM follows WHERE follower_id = $1)
       ORDER BY r.created_at DESC LIMIT 50`,
      [userId],
    );
    return result.rows;
  }
}
