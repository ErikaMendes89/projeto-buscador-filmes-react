import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { errorHandler } from '../../shared/error-handler.js';
import { SESSION_COOKIE } from '../auth/auth.middleware.js';
import type { AuthService } from '../auth/auth.service.js';
import { createSocialRouter } from './social.routes.js';
import type { SocialService } from './social.service.js';

function makeApp() {
  const service = {
    getFeed: vi.fn(async () => []),
    follow: vi.fn(async () => undefined),
    unfollow: vi.fn(async () => undefined),
  } as unknown as SocialService;
  const auth = {
    resolveSession: vi.fn(async (token: string) => token === 'valid-session' ? 'authenticated-user' : null),
  } as unknown as AuthService;
  const app = express();
  app.use('/api', createSocialRouter(service, auth));
  app.use(errorHandler);
  return { app, service };
}

describe('social routes authentication', () => {
  it('requires a session for feed and follows and scopes the actor to that session', async () => {
    const { app, service } = makeApp();
    const targetUserId = '11111111-1111-4111-8111-111111111111';
    expect((await request(app).get('/api/feed')).status).toBe(401);
    expect((await request(app).put(`/api/users/${targetUserId}/follow`)).status).toBe(401);

    const cookie = `${SESSION_COOKIE}=valid-session`;
    expect((await request(app).get('/api/feed').set('Cookie', cookie)).status).toBe(200);
    expect((await request(app).put(`/api/users/${targetUserId}/follow`).set('Cookie', cookie)).status).toBe(204);
    expect(service.getFeed).toHaveBeenCalledOnce();
    expect(service.follow).toHaveBeenCalledWith('authenticated-user', targetUserId);
  });
});
