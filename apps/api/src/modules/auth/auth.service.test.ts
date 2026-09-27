import { describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service.js';
import type { AuthRepository } from './auth.repository.js';
import type { AccountUser, UsersRepository } from '../users/users.repository.js';

function makeAuth() {
  let account: AccountUser | null = null;
  const users: UsersRepository = {
    findById: vi.fn(async () => account),
    findByUsername: vi.fn(async () => account),
    searchByUsername: vi.fn(async () => ({ items: account ? [account] : [], totalResults: account ? 1 : 0 })),
    findAccountByEmail: vi.fn(async () => account),
    updateProfile: vi.fn(async () => account),
    createAccount: vi.fn(async (input) => {
      account = { id: 'user-1', username: input.username, displayName: input.displayName, email: input.email, passwordHash: input.passwordHash, bio: null, createdAt: new Date() };
      const { id, username, displayName, bio, createdAt } = account;
      return { id, username, displayName, bio, createdAt };
    }),
  };
  const sessions = new Map<string, string>();
  const resetTokens = new Map<string, { tokenHash: string; expiresAt: Date }>();
  const auth: AuthRepository = {
    createSession: vi.fn(async (userId, hash) => { sessions.set(hash, userId); }),
    findSessionUser: vi.fn(async (hash) => sessions.get(hash) ?? null),
    revokeSession: vi.fn(async (hash) => { sessions.delete(hash); }),
    createPasswordResetToken: vi.fn(async (userId, tokenHash, expiresAt) => { resetTokens.set(userId, { tokenHash, expiresAt }); }),
    resetPassword: vi.fn(async (tokenHash, passwordHash) => {
      const match = [...resetTokens.entries()].find(([, reset]) => reset.tokenHash === tokenHash && reset.expiresAt > new Date());
      if (!match) return false;
      resetTokens.delete(match[0]);
      if (account) account = { ...account, passwordHash };
      for (const [hash, userId] of sessions) if (userId === match[0]) sessions.delete(hash);
      return true;
    }),
  };
  const mailer = { sendPasswordReset: vi.fn(async (_email: string, _resetUrl: string) => undefined) };
  return { service: new AuthService(users, auth, mailer, 'http://localhost:5173'), users, auth, sessions, resetTokens, mailer, getAccount: () => account };
}

describe('AuthService', () => {
  it('creates an account with a password hash without creating a session', async () => {
    const { service, users, auth, sessions, getAccount } = makeAuth();
    await service.register({ email: 'a@example.com', username: 'alice', displayName: 'Alice', password: 'a long secure password' });
    expect(users.createAccount).toHaveBeenCalledOnce();
    expect(getAccount()?.passwordHash).toMatch(/^scrypt\$/);
    expect(getAccount()?.passwordHash).not.toContain('a long secure password');
    expect(sessions.size).toBe(0);
    expect(auth.createSession).not.toHaveBeenCalled();
  });

  it('returns the same successful registration result when an identifier already exists', async () => {
    const { service, users } = makeAuth();
    vi.mocked(users.createAccount).mockRejectedValueOnce(Object.assign(new Error('duplicate'), { code: '23505' }));
    await expect(service.register({ email: 'a@example.com', username: 'alice', displayName: 'Alice', password: 'a long secure password' })).resolves.toBeUndefined();
    expect(users.createAccount).toHaveBeenCalledOnce();
  });

  it('creates a persisted opaque session after successful login', async () => {
    const { service, auth, sessions } = makeAuth();
    await service.register({ email: 'a@example.com', username: 'alice', displayName: 'Alice', password: 'a long secure password' });
    const result = await service.login('a@example.com', 'a long secure password');
    expect(result.user).not.toHaveProperty('email');
    expect(sessions.size).toBe(1);
    expect(auth.createSession).toHaveBeenCalledWith('user-1', expect.any(String), expect.any(Date));
    expect(sessions.has(result.token)).toBe(false);
    await expect(service.resolveSession(result.token)).resolves.toBe('user-1');
  });

  it('authenticates valid credentials and rejects invalid credentials without revealing account state', async () => {
    const { service } = makeAuth();
    await service.register({ email: 'a@example.com', username: 'alice', displayName: 'Alice', password: 'a long secure password' });
    await expect(service.login('a@example.com', 'wrong password')).rejects.toMatchObject({ statusCode: 401, code: 'invalid_credentials' });
    await expect(service.login('a@example.com', 'a long secure password')).resolves.toMatchObject({ user: { username: 'alice' }, token: expect.any(String) });
    await expect(service.login('missing@example.com', 'wrong password')).rejects.toMatchObject({ statusCode: 401, code: 'invalid_credentials' });
  });

  it('revokes the session on logout', async () => {
    const { service } = makeAuth();
    await service.register({ email: 'a@example.com', username: 'alice', displayName: 'Alice', password: 'a long secure password' });
    const { token } = await service.login('a@example.com', 'a long secure password');
    await service.revokeSession(token);
    await expect(service.resolveSession(token)).resolves.toBeNull();
  });

  it('sends a one-time reset link while storing only a short-lived token hash', async () => {
    const { service, auth, resetTokens, mailer } = makeAuth();
    await service.register({ email: 'a@example.com', username: 'alice', displayName: 'Alice', password: 'a long secure password' });
    const previousSession = await service.login('a@example.com', 'a long secure password');
    expect(await service.resolveSession(previousSession.token)).toBe('user-1');
    const requestedAt = Date.now();
    await service.requestPasswordReset('a@example.com');

    expect(mailer.sendPasswordReset).toHaveBeenCalledOnce();
    const [, resetUrl] = vi.mocked(mailer.sendPasswordReset).mock.calls[0]!;
    const token = new URL(resetUrl).hash.slice('#token='.length);
    const stored = resetTokens.get('user-1');
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(stored?.tokenHash).not.toBe(token);
    expect(stored?.expiresAt.getTime()).toBeGreaterThanOrEqual(requestedAt + 30 * 60 * 1000 - 1000);
    expect(stored?.expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + 30 * 60 * 1000);
    await service.resetPassword(token, 'a new secure password');
    expect(resetTokens.size).toBe(0);
    await expect(service.resolveSession(previousSession.token)).resolves.toBeNull();
    await expect(service.login('a@example.com', 'a long secure password')).rejects.toMatchObject({ code: 'invalid_credentials' });
    await expect(service.login('a@example.com', 'a new secure password')).resolves.toMatchObject({ user: { username: 'alice' } });
    await expect(service.resetPassword(token, 'another new secure password')).rejects.toMatchObject({ code: 'invalid_reset_token' });
    expect(auth.resetPassword).toHaveBeenCalledTimes(2);
  });

  it('returns indistinguishable reset requests for missing accounts and suppresses delivery errors safely', async () => {
    const { service, mailer, auth } = makeAuth();
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await service.requestPasswordReset('missing@example.com');
    expect(mailer.sendPasswordReset).not.toHaveBeenCalled();
    expect(auth.createPasswordResetToken).not.toHaveBeenCalled();

    await service.register({ email: 'a@example.com', username: 'alice', displayName: 'Alice', password: 'a long secure password' });
    vi.mocked(mailer.sendPasswordReset).mockRejectedValueOnce(new Error('provider failure with token-like content'));
    await service.requestPasswordReset('a@example.com');
    await vi.waitFor(() => expect(log).toHaveBeenCalledWith('Password reset request could not be completed.'));
    expect(log).toHaveBeenCalledWith('Password reset request could not be completed.');
    expect(String(log.mock.calls[0]?.[0])).not.toContain('missing@example.com');
    log.mockRestore();
  });
});
