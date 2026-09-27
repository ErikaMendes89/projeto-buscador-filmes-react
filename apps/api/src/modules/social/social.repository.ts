import type { Pool } from 'pg';

export interface SocialRepository {
  findUserIdByUsername(username: string): Promise<string | null>;
  isFollowing(followerId: string, followedId: string): Promise<boolean>;
  follow(followerId: string, followedId: string): Promise<void>;
  unfollow(followerId: string, followedId: string): Promise<void>;
  getFeed(userId: string, page: number, pageSize: number): Promise<{ items: unknown[]; totalResults: number }>;
}

export class PgSocialRepository implements SocialRepository {
  constructor(private readonly db: Pool) {}

  async findUserIdByUsername(username: string): Promise<string | null> {
    const result = await this.db.query<{ id: string }>(
      'SELECT id FROM users WHERE username = $1 AND password_hash IS NOT NULL',
      [username],
    );
    return result.rows[0]?.id ?? null;
  }

  async isFollowing(followerId: string, followedId: string): Promise<boolean> {
    const result = await this.db.query<{ following: boolean }>(
      'SELECT EXISTS (SELECT 1 FROM follows WHERE follower_id = $1 AND followed_id = $2) AS following',
      [followerId, followedId],
    );
    return result.rows[0]?.following ?? false;
  }

  async follow(followerId: string, followedId: string): Promise<void> {
    await this.db.query(
      'INSERT INTO follows (follower_id, followed_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [followerId, followedId],
    );
  }

  async unfollow(followerId: string, followedId: string): Promise<void> {
    await this.db.query('DELETE FROM follows WHERE follower_id = $1 AND followed_id = $2', [followerId, followedId]);
  }

  async getFeed(userId: string, page: number, pageSize: number): Promise<{ items: unknown[]; totalResults: number }> {
    const [reviews, count] = await Promise.all([
      this.db.query(
        `SELECT r.id, r.movie_id AS "movieId", r.title, r.poster_path AS "posterPath",
                r.rating::float, r.body, r.created_at AS "createdAt",
                json_build_object('username', u.username, 'displayName', u.display_name) AS author
         FROM reviews r
         JOIN users u ON u.id = r.user_id AND u.password_hash IS NOT NULL
         WHERE (r.user_id = $1 OR EXISTS (
           SELECT 1 FROM follows f WHERE f.follower_id = $1 AND f.followed_id = r.user_id
         )) AND (r.user_id = $1 OR u.list_is_public = true)
         ORDER BY r.created_at DESC, r.id DESC LIMIT $2 OFFSET $3`,
        [userId, pageSize, (page - 1) * pageSize],
      ),
      this.db.query<{ totalResults: number }>(
        `SELECT count(*)::int AS "totalResults"
         FROM reviews r
         JOIN users u ON u.id = r.user_id AND u.password_hash IS NOT NULL
         WHERE (r.user_id = $1 OR EXISTS (
           SELECT 1 FROM follows f WHERE f.follower_id = $1 AND f.followed_id = r.user_id
         )) AND (r.user_id = $1 OR u.list_is_public = true)`,
        [userId],
      ),
    ]);
    return { items: reviews.rows, totalResults: count.rows[0]?.totalResults ?? 0 };
  }
}
