import type { Pool } from 'pg';
import type { PublicUser } from './users.types.js';

export interface UsersRepository {
  findById(id: string): Promise<PublicUser | null>;
  findByUsername(username: string): Promise<PublicUser | null>;
}

export class PgUsersRepository implements UsersRepository {
  constructor(private readonly db: Pool) {}

  async findById(id: string) {
    return this.findOne('id', id);
  }

  async findByUsername(username: string) {
    return this.findOne('username', username);
  }

  private async findOne(field: 'id' | 'username', value: string): Promise<PublicUser | null> {
    const result = await this.db.query(
      `SELECT id, username, display_name AS "displayName", bio, created_at AS "createdAt"
       FROM users WHERE ${field} = $1`,
      [value],
    );
    return result.rows[0] ?? null;
  }
}
