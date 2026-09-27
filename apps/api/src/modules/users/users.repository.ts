import type { Pool } from 'pg';
import type { PublicUser } from './users.types.js';

export type AccountUser = PublicUser & { email: string; passwordHash: string | null };

export interface UsersRepository {
  findById(id: string): Promise<PublicUser | null>;
  findByUsername(username: string): Promise<PublicUser | null>;
  searchByUsername(query: string, page: number, pageSize: number): Promise<{ items: PublicUser[]; totalResults: number }>;
  findAccountByEmail(email: string): Promise<AccountUser | null>;
  createAccount(input: { email: string; username: string; displayName: string; passwordHash: string }): Promise<PublicUser>;
  updateProfile(id: string, input: { username: string; displayName: string; bio: string | null }): Promise<PublicUser | null>;
}

export class PgUsersRepository implements UsersRepository {
  constructor(private readonly db: Pool) {}

  async findById(id: string) {
    return this.findOne('id', id);
  }

  async findByUsername(username: string) {
    return this.findOne('username', username);
  }

  async searchByUsername(query: string, page: number, pageSize: number) {
    const [users, count] = await Promise.all([
      this.db.query<PublicUser>(
        `SELECT id, username, display_name AS "displayName", bio, created_at AS "createdAt"
         FROM users WHERE password_hash IS NOT NULL AND position(lower($1) in lower(username)) > 0
         ORDER BY username LIMIT $2 OFFSET $3`,
        [query, pageSize, (page - 1) * pageSize],
      ),
      this.db.query<{ totalResults: number }>(
        `SELECT count(*)::int AS "totalResults"
         FROM users WHERE password_hash IS NOT NULL AND position(lower($1) in lower(username)) > 0`,
        [query],
      ),
    ]);
    return { items: users.rows, totalResults: count.rows[0]?.totalResults ?? 0 };
  }

  async findAccountByEmail(email: string): Promise<AccountUser | null> {
    const result = await this.db.query(
      `SELECT id, username, display_name AS "displayName", bio, created_at AS "createdAt",
              email, password_hash AS "passwordHash"
       FROM users WHERE email = $1`,
      [email],
    );
    return result.rows[0] ?? null;
  }

  async createAccount(input: { email: string; username: string; displayName: string; passwordHash: string }): Promise<PublicUser> {
    const result = await this.db.query<PublicUser>(
      `INSERT INTO users (email, username, display_name, password_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING id, username, display_name AS "displayName", bio, created_at AS "createdAt"`,
      [input.email, input.username, input.displayName, input.passwordHash],
    );
    return result.rows[0]!;
  }

  async updateProfile(id: string, input: { username: string; displayName: string; bio: string | null }): Promise<PublicUser | null> {
    const result = await this.db.query<PublicUser>(
      `UPDATE users
       SET username = $2, display_name = $3, bio = $4
       WHERE id = $1
       RETURNING id, username, display_name AS "displayName", bio, created_at AS "createdAt"`,
      [id, input.username, input.displayName, input.bio],
    );
    return result.rows[0] ?? null;
  }

  private async findOne(field: 'id' | 'username', value: string): Promise<PublicUser | null> {
    const result = await this.db.query(
      `SELECT id, username, display_name AS "displayName", bio, created_at AS "createdAt"
              ${field === 'username' ? ', (SELECT count(*)::int FROM follows f WHERE f.followed_id = users.id) AS "followersCount", (SELECT count(*)::int FROM follows f WHERE f.follower_id = users.id) AS "followingCount"' : ''}
       FROM users WHERE ${field} = $1 AND password_hash IS NOT NULL`,
      [value],
    );
    return result.rows[0] ?? null;
  }
}
