import type { Pool } from 'pg';

export interface AuthRepository {
  createSession(userId: string, tokenHash: string, expiresAt: Date): Promise<void>;
  findSessionUser(tokenHash: string): Promise<string | null>;
  revokeSession(tokenHash: string): Promise<void>;
  createPasswordResetToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void>;
  resetPassword(tokenHash: string, passwordHash: string): Promise<boolean>;
}

export class PgAuthRepository implements AuthRepository {
  constructor(private readonly db: Pool) {}

  async createSession(userId: string, tokenHash: string, expiresAt: Date) {
    await this.db.query(
      'INSERT INTO auth_sessions (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [userId, tokenHash, expiresAt],
    );
  }

  async findSessionUser(tokenHash: string): Promise<string | null> {
    const result = await this.db.query<{ userId: string }>(
      `SELECT s.user_id AS "userId"
       FROM auth_sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = $1 AND s.expires_at > now() AND u.password_hash IS NOT NULL`,
      [tokenHash],
    );
    return result.rows[0]?.userId ?? null;
  }

  async revokeSession(tokenHash: string) {
    await this.db.query('DELETE FROM auth_sessions WHERE token_hash = $1', [tokenHash]);
  }

  async createPasswordResetToken(userId: string, tokenHash: string, expiresAt: Date) {
    await this.db.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id) DO UPDATE
       SET token_hash = EXCLUDED.token_hash, expires_at = EXCLUDED.expires_at, created_at = now()`,
      [userId, tokenHash, expiresAt],
    );
  }

  async resetPassword(tokenHash: string, passwordHash: string): Promise<boolean> {
    const client = await this.db.connect();
    try {
      await client.query('BEGIN');
      const token = await client.query<{ userId: string }>(
        `DELETE FROM password_reset_tokens
         WHERE token_hash = $1 AND expires_at > now()
         RETURNING user_id AS "userId"`,
        [tokenHash],
      );
      const userId = token.rows[0]?.userId;
      if (!userId) {
        await client.query('ROLLBACK');
        return false;
      }

      await client.query('UPDATE users SET password_hash = $2 WHERE id = $1', [userId, passwordHash]);
      await client.query('DELETE FROM auth_sessions WHERE user_id = $1', [userId]);
      await client.query('COMMIT');
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
