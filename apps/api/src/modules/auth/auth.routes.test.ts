import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createAuthRouter } from './auth.routes.js';
import { requireSameOrigin } from './auth.middleware.js';
import type { AuthService } from './auth.service.js';
import { errorHandler } from '../../shared/error-handler.js';
import { AppError } from '../../shared/errors.js';

const user = { id: 'user-1', username: 'alice', displayName: 'Alice', bio: null, createdAt: new Date('2026-01-01T00:00:00Z') };

function makeApp() {
  const service = {
    register: vi.fn(async (input: { email: string; username: string; displayName: string }) => ({ user: { ...user, username: input.username }, token: 'opaque-session-token' })),
    login: vi.fn(async () => ({ user, token: 'opaque-session-token' })),
    requestPasswordReset: vi.fn(async () => undefined),
    resetPassword: vi.fn(async () => undefined),
    getSession: vi.fn(async () => ({ user })),
    resolveSession: vi.fn(async () => user.id),
    revokeSession: vi.fn(async () => undefined),
  } as unknown as AuthService;
  const app = express();
  app.set('webOrigin', 'http://localhost:5173');
  app.use(express.json());
  app.use('/api', requireSameOrigin);
  app.use('/api/auth', createAuthRouter(service, false));
  app.use(errorHandler);
  return { app, service };
}

describe('auth routes', () => {
  it('normalizes signup identifiers and returns a generic response without starting a session', async () => {
    const { app, service } = makeApp();
    const response = await request(app).post('/api/auth/register').set('Origin', 'http://localhost:5173').send({
      email: '  ALICE@example.com ', username: ' Alice_1 ', displayName: 'Alice', password: 'a long secure password',
    });
    expect(response.status).toBe(202);
    expect(service.register).toHaveBeenCalledWith({ email: 'alice@example.com', username: 'alice_1', displayName: 'Alice', password: 'a long secure password' });
    expect(response.headers['set-cookie']).toBeUndefined();
    expect(response.body).toEqual({ message: 'Se os dados permitirem, o cadastro estará disponível para entrar.' });
  });

  it('limits login attempts per IP and returns a generic retry response', async () => {
    const { app, service } = makeApp();
    const payload = { email: 'alice@example.com', password: 'a long secure password' };
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const response = await request(app).post('/api/auth/login').set('Origin', 'http://localhost:5173').send(payload);
      expect(response.status).toBe(200);
    }

    const limited = await request(app).post('/api/auth/login').set('Origin', 'http://localhost:5173').send(payload);
    expect(limited.status).toBe(429);
    expect(limited.body).toEqual({ error: 'Muitas tentativas. Tente novamente mais tarde.', code: 'rate_limited' });
    expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);
    expect(service.login).toHaveBeenCalledTimes(10);
  });

  it('returns the generic invalid-credentials response for an incorrect password', async () => {
    const { app, service } = makeApp();
    vi.mocked(service.login).mockRejectedValueOnce(new AppError('E-mail ou senha inválidos', 401, 'invalid_credentials'));
    const response = await request(app)
      .post('/api/auth/login')
      .set('Origin', 'http://localhost:5173')
      .send({ email: 'alice@example.com', password: 'incorrect-password' });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'E-mail ou senha inválidos', code: 'invalid_credentials' });
    expect(response.headers['set-cookie']).toBeUndefined();
  });

  it('rejects an expired session and clears the cookie on logout', async () => {
    const { app, service } = makeApp();
    vi.mocked(service.resolveSession).mockImplementation(async (token) => token === 'live-session' ? user.id : null);
    const expired = await request(app)
      .get('/api/auth/session')
      .set('Cookie', 'moviematch_session=expired-session');
    expect(expired.status).toBe(401);
    expect(expired.body.code).toBe('unauthorized');

    const logout = await request(app)
      .post('/api/auth/logout')
      .set('Origin', 'http://localhost:5173')
      .set('Cookie', 'moviematch_session=live-session');
    expect(logout.status).toBe(204);
    expect(logout.headers['set-cookie']?.[0]).toContain('moviematch_session=;');
    expect(logout.headers['set-cookie']?.[0]).toContain('Max-Age=0');
    expect(service.revokeSession).toHaveBeenCalledWith('live-session');
  });

  it('limits account creation attempts per IP', async () => {
    const { app, service } = makeApp();
    const payload = { email: 'alice@example.com', username: 'alice_1', displayName: 'Alice', password: 'a long secure password' };
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await request(app).post('/api/auth/register').set('Origin', 'http://localhost:5173').send(payload);
      expect(response.status).toBe(202);
    }

    const limited = await request(app).post('/api/auth/register').set('Origin', 'http://localhost:5173').send(payload);
    expect(limited.status).toBe(429);
    expect(limited.body.code).toBe('rate_limited');
    expect(service.register).toHaveBeenCalledTimes(5);
  });

  it('returns a generic password reset response and accepts a token only in the confirmation body', async () => {
    const { app, service } = makeApp();
    const requested = await request(app)
      .post('/api/auth/password-reset')
      .set('Origin', 'http://localhost:5173')
      .send({ email: ' ALICE@EXAMPLE.COM ' });
    expect(requested.status).toBe(202);
    expect(requested.body).toEqual({ message: 'Se houver uma conta para este e-mail, enviaremos instruções de recuperação.' });
    expect(requested.body).not.toHaveProperty('token');
    expect(service.requestPasswordReset).toHaveBeenCalledWith('alice@example.com');

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const repeated = await request(app)
        .post('/api/auth/password-reset')
        .set('Origin', 'http://localhost:5173')
        .send({ email: 'alice@example.com' });
      expect(repeated.status).toBe(202);
    }
    const throttled = await request(app)
      .post('/api/auth/password-reset')
      .set('Origin', 'http://localhost:5173')
      .send({ email: 'alice@example.com' });
    expect(throttled.status).toBe(429);
    expect(service.requestPasswordReset).toHaveBeenCalledTimes(5);

    const confirmed = await request(app)
      .post('/api/auth/password-reset/confirm')
      .set('Origin', 'http://localhost:5173')
      .send({ token: 'opaque-reset-token-value-long-enough', password: 'a new secure password' });
    expect(confirmed.status).toBe(204);
    expect(service.resetPassword).toHaveBeenCalledWith('opaque-reset-token-value-long-enough', 'a new secure password');
  });

  it('rejects writes from other origins and invalid signup payloads', async () => {
    const { app, service } = makeApp();
    const foreign = await request(app).post('/api/auth/register').set('Origin', 'https://attacker.example').send({});
    expect(foreign.status).toBe(403);
    const invalid = await request(app).post('/api/auth/register').set('Origin', 'http://localhost:5173').send({ email: 'x', username: 'x', displayName: '', password: 'short' });
    expect(invalid.status).toBe(400);
    expect(service.register).not.toHaveBeenCalled();
  });
});
