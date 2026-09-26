import type { Pool } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { PgUsersRepository } from './users.repository.js';

describe('PgUsersRepository', () => {
  it('does not expose passwordless demo accounts as public profiles', async () => {
    const db = { query: vi.fn(async () => ({ rows: [] })) } as unknown as Pool;
    const repository = new PgUsersRepository(db);

    await expect(repository.findByUsername('erika')).resolves.toBeNull();
    const [sql] = vi.mocked(db.query).mock.calls[0]!;
    expect(String(sql)).toContain('password_hash IS NOT NULL');
    expect(String(sql)).not.toContain('email');
    expect(String(sql)).not.toContain('session');
  });
});
