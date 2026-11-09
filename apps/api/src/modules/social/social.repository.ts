import type { Pool, PoolClient } from 'pg';

export interface SocialRepository {
  findUserIdByUsername(username: string): Promise<string | null>;
  isFollowing(followerId: string, followedId: string): Promise<boolean>;
  getBlockStatus(viewerId: string, targetId: string): Promise<{ blockedByMe: boolean; blockedYou: boolean }>;
  follow(followerId: string, followedId: string): Promise<boolean>;
  unfollow(followerId: string, followedId: string): Promise<void>;
  block(blockerId: string, blockedId: string): Promise<void>;
  unblock(blockerId: string, blockedId: string): Promise<void>;
  canChat(firstUserId: string, secondUserId: string): Promise<boolean>;
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
      `SELECT EXISTS (SELECT 1 FROM follows WHERE follower_id = $1 AND followed_id = $2)
              AND NOT EXISTS (SELECT 1 FROM user_blocks WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1)) AS following`,
      [followerId, followedId],
    );
    return result.rows[0]?.following ?? false;
  }

  async getBlockStatus(viewerId: string, targetId: string) {
    const result = await this.db.query<{ blockedByMe: boolean; blockedYou: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM user_blocks WHERE blocker_id = $1 AND blocked_id = $2) AS "blockedByMe",
              EXISTS (SELECT 1 FROM user_blocks WHERE blocker_id = $2 AND blocked_id = $1) AS "blockedYou"`,
      [viewerId, targetId],
    );
    return result.rows[0] ?? { blockedByMe: false, blockedYou: false };
  }

  private async lockPair(client: PoolClient, firstUserId: string, secondUserId: string) {
    await client.query(
      `SELECT pg_advisory_xact_lock(hashtextextended(LEAST($1::text, $2::text) || ':' || GREATEST($1::text, $2::text), 0))`,
      [firstUserId, secondUserId],
    );
  }

  async follow(followerId: string, followedId: string): Promise<boolean> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      await this.lockPair(client, followerId, followedId);
      const blocked = await client.query(
        'SELECT 1 FROM user_blocks WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1) LIMIT 1',
        [followerId, followedId],
      );
      if (blocked.rowCount) {
        await client.query('ROLLBACK');
        return false;
      }
      await client.query('INSERT INTO follows (follower_id, followed_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [followerId, followedId]);
      await client.query('COMMIT');
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async unfollow(followerId: string, followedId: string): Promise<void> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      await this.lockPair(client, followerId, followedId);
      await client.query('DELETE FROM follows WHERE follower_id = $1 AND followed_id = $2', [followerId, followedId]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async block(blockerId: string, blockedId: string): Promise<void> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      await this.lockPair(client, blockerId, blockedId);
      await client.query(
        'INSERT INTO user_blocks (blocker_id, blocked_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [blockerId, blockedId],
      );
      await client.query(
        'DELETE FROM follows WHERE (follower_id = $1 AND followed_id = $2) OR (follower_id = $2 AND followed_id = $1)',
        [blockerId, blockedId],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async unblock(blockerId: string, blockedId: string): Promise<void> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      await this.lockPair(client, blockerId, blockedId);
      await client.query('DELETE FROM user_blocks WHERE blocker_id = $1 AND blocked_id = $2', [blockerId, blockedId]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async canChat(firstUserId: string, secondUserId: string): Promise<boolean> {
    const result = await this.db.query<{ allowed: boolean }>(
      'SELECT NOT EXISTS (SELECT 1 FROM user_blocks WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1)) AS allowed',
      [firstUserId, secondUserId],
    );
    return result.rows[0]?.allowed ?? true;
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
           AND NOT EXISTS (SELECT 1 FROM user_blocks b WHERE (b.blocker_id = $1 AND b.blocked_id = r.user_id) OR (b.blocker_id = r.user_id AND b.blocked_id = $1))
         ORDER BY r.created_at DESC, r.id DESC LIMIT $2 OFFSET $3`,
        [userId, pageSize, (page - 1) * pageSize],
      ),
      this.db.query<{ totalResults: number }>(
        `SELECT count(*)::int AS "totalResults"
         FROM reviews r
         JOIN users u ON u.id = r.user_id AND u.password_hash IS NOT NULL
         WHERE (r.user_id = $1 OR EXISTS (
           SELECT 1 FROM follows f WHERE f.follower_id = $1 AND f.followed_id = r.user_id
         )) AND (r.user_id = $1 OR u.list_is_public = true)
           AND NOT EXISTS (SELECT 1 FROM user_blocks b WHERE (b.blocker_id = $1 AND b.blocked_id = r.user_id) OR (b.blocker_id = r.user_id AND b.blocked_id = $1))`,
        [userId],
      ),
    ]);
    return { items: reviews.rows, totalResults: count.rows[0]?.totalResults ?? 0 };
  }
}
