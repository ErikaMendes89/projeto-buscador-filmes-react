import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { requireSameOrigin, SESSION_COOKIE } from '../auth/auth.middleware.js';
import type { AuthService } from '../auth/auth.service.js';
import { errorHandler } from '../../shared/error-handler.js';
import { createUsersRouter } from './users.routes.js';
import type { UsersService } from './users.service.js';

const owner = { id: 'owner-1', username: 'alice', displayName: 'Alice', bio: null, createdAt: new Date('2026-01-01T00:00:00Z') };

function makeApp() {
  const users = {
    getProfile: vi.fn(async () => ({ ...owner, email: 'private@example.com', passwordHash: 'never-public' })),
    updateProfile: vi.fn(async (_userId: string, input: { username: string; displayName: string; bio: string | null }) => ({ ...owner, ...input })),
  } as unknown as UsersService;
  const auth = { resolveSession: vi.fn(async (token: string) => token === 'valid-session' ? owner.id : null) } as unknown as AuthService;
  const app = express();
  app.set('webOrigin', 'http://localhost:5173');
  app.use(express.json());
  app.use('/api', requireSameOrigin);
  app.use('/api/users', createUsersRouter(users, auth));
  app.use(errorHandler);
  return { app, users, auth };
}

describe('users routes', () => {
  it('returns only public profile fields', async () => {
    const { app } = makeApp();
    const response = await request(app).get('/api/users/alice');
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ username: 'alice', displayName: 'Alice', bio: null, createdAt: '2026-01-01T00:00:00.000Z' });
    expect(response.body.data).not.toHaveProperty('id');
    expect(response.body.data).not.toHaveProperty('email');
    expect(response.body.data).not.toHaveProperty('passwordHash');
    expect(response.body.data).not.toHaveProperty('session');
  });

  it('requires the current session and updates only its own profile', async () => {
    const { app, users } = makeApp();
    const body = { username: ' Alice_2 ', displayName: ' Alice Example ', bio: '  Filmes favoritos  ' };
    const unauthorized = await request(app).put('/api/users/me').set('Origin', 'http://localhost:5173').send(body);
    expect(unauthorized.status).toBe(401);

    const response = await request(app)
      .put('/api/users/me')
      .set('Origin', 'http://localhost:5173')
      .set('Cookie', `${SESSION_COOKIE}=valid-session`)
      .send(body);

    expect(response.status).toBe(200);
    expect(users.updateProfile).toHaveBeenCalledWith(owner.id, { username: 'alice_2', displayName: 'Alice Example', bio: 'Filmes favoritos' });
    expect(response.body.data.user).toEqual({ username: 'alice_2', displayName: 'Alice Example', bio: 'Filmes favoritos', createdAt: '2026-01-01T00:00:00.000Z' });
  });

  it('rejects profile fields that could target another account or expose private data', async () => {
    const { app, users } = makeApp();
    const response = await request(app)
      .put('/api/users/me')
      .set('Origin', 'http://localhost:5173')
      .set('Cookie', `${SESSION_COOKIE}=valid-session`)
      .send({ username: 'alice_2', displayName: 'Alice', bio: null, id: 'another-user', email: 'attacker@example.com' });
    expect(response.status).toBe(400);
    expect(users.updateProfile).not.toHaveBeenCalled();
  });
});
