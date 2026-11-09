import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { errorHandler } from '../../shared/error-handler.js';
import { SESSION_COOKIE } from '../auth/auth.middleware.js';
import type { AuthService } from '../auth/auth.service.js';
import { createConversationsRouter } from './conversations.routes.js';
import type { ConversationsService } from './conversations.service.js';

function makeApp() {
  const service = {
    createIndividual: vi.fn(async () => ({ id: 'conversation-1', created: true })),
    listForUser: vi.fn(async () => []),
    listMessages: vi.fn(async (_userId: string, _conversationId: string, page: number) => ({ items: [], page, pageSize: 20, totalPages: 1, totalResults: 0 })),
    listMessagesAfter: vi.fn(async () => ({ items: [], hasMore: false, nextCursor: null })),
    markMessagesRead: vi.fn(async () => undefined),
  } as unknown as ConversationsService;
  const auth = { resolveSession: vi.fn(async (token: string) => token === 'valid-session' ? 'authenticated-user' : null) } as unknown as AuthService;
  const app = express();
  app.use(express.json());
  app.use('/api', createConversationsRouter(service, auth));
  app.use(errorHandler);
  return { app, service };
}

describe('conversation routes', () => {
  it('requires a session and creates an individual conversation for the authenticated user', async () => {
    const { app, service } = makeApp();
    expect((await request(app).post('/api/conversations').send({ username: 'Alice' })).status).toBe(401);

    const response = await request(app).post('/api/conversations').set('Cookie', `${SESSION_COOKIE}=valid-session`).send({ username: 'Alice' });
    expect(response.status).toBe(201);
    expect(response.body).toEqual({ data: { id: 'conversation-1', kind: 'individual' } });
    expect(service.createIndividual).toHaveBeenCalledWith('authenticated-user', 'alice');

    vi.mocked(service.createIndividual).mockResolvedValueOnce({ id: 'conversation-1', created: false });
    const existing = await request(app).post('/api/conversations').set('Cookie', `${SESSION_COOKIE}=valid-session`).send({ username: 'alice' });
    expect(existing.status).toBe(200);
  });

  it('lists only the current user conversations and validates strict creation payloads', async () => {
    const { app, service } = makeApp();
    const cookie = `${SESSION_COOKIE}=valid-session`;
    expect((await request(app).get('/api/conversations')).status).toBe(401);
    expect((await request(app).get('/api/conversations').set('Cookie', cookie)).body).toEqual({ data: [] });
    expect(service.listForUser).toHaveBeenCalledWith('authenticated-user');

    const invalid = await request(app).post('/api/conversations').set('Cookie', cookie).send({ username: 'alice', userId: 'another-user' });
    expect(invalid.status).toBe(400);
    expect(service.createIndividual).not.toHaveBeenCalled();
  });

  it('requires participation through the service and returns paginated message history', async () => {
    const { app, service } = makeApp();
    const cookie = `${SESSION_COOKIE}=valid-session`;
    expect((await request(app).get('/api/conversations/11111111-1111-4111-8111-111111111111/messages')).status).toBe(401);

    const response = await request(app)
      .get('/api/conversations/11111111-1111-4111-8111-111111111111/messages?page=2')
      .set('Cookie', cookie);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: [], pagination: { page: 2, pageSize: 20, totalPages: 1, totalResults: 0 } });
    expect(service.listMessages).toHaveBeenCalledWith('authenticated-user', '11111111-1111-4111-8111-111111111111', 2);

    const invalidPage = await request(app)
      .get('/api/conversations/11111111-1111-4111-8111-111111111111/messages?page=0')
      .set('Cookie', cookie);
    expect(invalidPage.status).toBe(400);
    expect(service.listMessages).toHaveBeenCalledOnce();
  });

  it('exposes authenticated recovery and read receipt endpoints', async () => {
    const { app, service } = makeApp();
    const cookie = `${SESSION_COOKIE}=valid-session`;
    const base = '/api/conversations/11111111-1111-4111-8111-111111111111/messages';

    const recovered = await request(app).get(`${base}/after/22222222-2222-4222-8222-222222222222`).set('Cookie', cookie);
    expect(recovered.status).toBe(200);
    expect(recovered.body).toEqual({ data: [], pagination: { hasMore: false, nextCursor: null } });
    expect(service.listMessagesAfter).toHaveBeenCalledWith('authenticated-user', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222');

    const marked = await request(app).post(`${base}/read`).set('Cookie', cookie);
    expect(marked.status).toBe(204);
    expect(service.markMessagesRead).toHaveBeenCalledWith('authenticated-user', '11111111-1111-4111-8111-111111111111');
    expect((await request(app).post(`${base}/read`)).status).toBe(401);
  });
});
