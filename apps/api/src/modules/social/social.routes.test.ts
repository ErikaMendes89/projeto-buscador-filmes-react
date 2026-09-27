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
    getFeed: vi.fn(async (_userId: string, page: number) => ({ items: [], page, totalPages: 1, totalResults: 0 })),
    getFollowStatus: vi.fn(async () => ({ following: false })),
    followByUsername: vi.fn(async () => undefined),
    unfollowByUsername: vi.fn(async () => undefined),
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
  it('requires a session and supports username follow status, follow, and unfollow', async () => {
    const { app, service } = makeApp();
    const path = '/api/users/by-username/Alice/follow';
    expect((await request(app).get(path)).status).toBe(401);

    const cookie = `${SESSION_COOKIE}=valid-session`;
    expect((await request(app).get(path).set('Cookie', cookie)).body).toEqual({ data: { following: false } });
    expect((await request(app).put(path).set('Cookie', cookie)).status).toBe(204);
    expect((await request(app).delete(path).set('Cookie', cookie)).status).toBe(204);
    expect(service.getFollowStatus).toHaveBeenCalledWith('authenticated-user', 'alice');
    expect(service.followByUsername).toHaveBeenCalledWith('authenticated-user', 'alice');
    expect(service.unfollowByUsername).toHaveBeenCalledWith('authenticated-user', 'alice');
  });

  it('requires a session for feed and follows and scopes the actor to that session', async () => {
    const { app, service } = makeApp();
    const targetUserId = '11111111-1111-4111-8111-111111111111';
    expect((await request(app).get('/api/feed')).status).toBe(401);
    expect((await request(app).put(`/api/users/${targetUserId}/follow`)).status).toBe(401);

    const cookie = `${SESSION_COOKIE}=valid-session`;
    const feedResponse = await request(app).get('/api/feed?page=2').set('Cookie', cookie);
    expect(feedResponse.status).toBe(200);
    expect(feedResponse.body).toEqual({ data: [], pagination: { page: 2, totalPages: 1, totalResults: 0 } });
    expect((await request(app).put(`/api/users/${targetUserId}/follow`).set('Cookie', cookie)).status).toBe(204);
    expect(service.getFeed).toHaveBeenCalledWith('authenticated-user', 2);
    expect(service.follow).toHaveBeenCalledWith('authenticated-user', targetUserId);
  });
});
