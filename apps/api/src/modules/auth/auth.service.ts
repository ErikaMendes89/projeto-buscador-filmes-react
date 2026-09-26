import { createHash, randomBytes, scrypt as nodeScrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { AppError, NotFoundError } from '../../shared/errors.js';
import type { AuthRepository } from './auth.repository.js';
import type { UsersRepository } from '../users/users.repository.js';
import type { PasswordResetMailer } from './password-reset-mailer.js';

const scrypt = promisify(nodeScrypt);
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000;

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const key = await scrypt(password, salt, 64) as Buffer;
  return `scrypt$${salt}$${key.toString('hex')}`;
}

async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [algorithm, salt, expectedHex] = encoded.split('$');
  if (algorithm !== 'scrypt' || !salt || !expectedHex || expectedHex.length !== 128) return false;
  const expected = Buffer.from(expectedHex, 'hex');
  if (expected.length !== 64) return false;
  const actual = await scrypt(password, salt, expected.length) as Buffer;
  return timingSafeEqual(actual, expected);
}

function tokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export class AuthService {
  constructor(
    private readonly users: UsersRepository,
    private readonly auth: AuthRepository,
    private readonly passwordResetMailer: PasswordResetMailer,
    private readonly webOrigin: string,
  ) {}

  async register(input: { email: string; username: string; displayName: string; password: string }): Promise<void> {
    const passwordHash = await hashPassword(input.password);
    try {
      await this.users.createAccount({
        email: input.email,
        username: input.username,
        displayName: input.displayName,
        passwordHash,
      });
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        return;
      }
      throw error;
    }
  }

  async login(email: string, password: string) {
    const account = await this.users.findAccountByEmail(email);
    if (!account?.passwordHash) {
      await hashPassword(password);
      throw new AppError('E-mail ou senha inválidos', 401, 'invalid_credentials');
    }
    if (!(await verifyPassword(password, account.passwordHash))) {
      throw new AppError('E-mail ou senha inválidos', 401, 'invalid_credentials');
    }
    return { user: { id: account.id, username: account.username, displayName: account.displayName, bio: account.bio, createdAt: account.createdAt }, ...(await this.startSession(account.id)) };
  }

  async resolveSession(token: string): Promise<string | null> {
    return this.auth.findSessionUser(tokenHash(token));
  }

  async revokeSession(token: string) {
    await this.auth.revokeSession(tokenHash(token));
  }

  async requestPasswordReset(email: string): Promise<void> {
    const account = await this.users.findAccountByEmail(email);
    await hashPassword(email);
    if (!account?.passwordHash) {
      return;
    }

    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);
    const resetUrl = new URL('/reset-password', this.webOrigin);
    resetUrl.hash = `token=${encodeURIComponent(token)}`;

    try {
      await this.auth.createPasswordResetToken(account.id, tokenHash(token), expiresAt);
    } catch {
      // Keep the public response identical for existing and unknown accounts.
      console.error('Password reset request could not be completed.');
      return;
    }

    void Promise.resolve()
      .then(() => this.passwordResetMailer.sendPasswordReset(account.email, resetUrl.toString()))
      .catch(() => console.error('Password reset request could not be completed.'));
  }

  async resetPassword(token: string, password: string): Promise<void> {
    const passwordHash = await hashPassword(password);
    const wasReset = await this.auth.resetPassword(tokenHash(token), passwordHash);
    if (!wasReset) throw new AppError('Link de recuperação inválido ou expirado', 400, 'invalid_reset_token');
  }

  private async startSession(userId: string) {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    await this.auth.createSession(userId, tokenHash(token), expiresAt);
    return { token, expiresAt };
  }

  async getSession(userId: string) {
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundError('Usuário da sessão não encontrado');
    return { user };
  }
}
