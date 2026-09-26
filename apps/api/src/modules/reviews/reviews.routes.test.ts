import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { requireSameOrigin } from '../auth/auth.middleware.js';
import type { AuthService } from '../auth/auth.service.js';
import { errorHandler } from '../../shared/error-handler.js';
import { createReviewsRouter } from './reviews.routes.js';
import type { ReviewsService } from './reviews.service.js';

const review = { id: 'review-1', movieId: 42, title: 'Filme', rating: 4.5, body: 'Muito bom', author: { username: 'alice', displayName: 'Alice' }, createdAt: new Date() };

function makeApp() {
  const service = {
    listForMovie: vi.fn(async () => [review]),
    findMine: vi.fn(async () => review),
    publish: vi.fn(async (_userId, input) => ({ ...review, ...input })),
    removeMine: vi.fn(async () => undefined),
  } as unknown as ReviewsService;
  const auth = { resolveSession: vi.fn(async () => 'user-1') } as unknown as AuthService;
  const app = express();
  app.set('webOrigin', 'http://localhost:5173');
  app.use(express.json());
  app.use('/api', requireSameOrigin);
  app.use('/api', createReviewsRouter(service, auth));
  app.use(errorHandler);
  return { app, service };
}

describe('review routes', () => {
  it('lists reviews publicly and reads the signed-in user review', async () => {
    const { app, service } = makeApp();
    const listed = await request(app).get('/api/movies/42/reviews');
    const mine = await request(app).get('/api/movies/42/reviews/me').set('Cookie', 'moviematch_session=session');
    expect(listed.status).toBe(200);
    expect(listed.body.data).toHaveLength(1);
    expect(mine.body.data.id).toBe('review-1');
    expect(service.findMine).toHaveBeenCalledWith('user-1', 42);
  });

  it('validates, upserts, and removes only the current user review', async () => {
    const { app, service } = makeApp();
    const saved = await request(app).put('/api/movies/42/reviews/me').set('Origin', 'http://localhost:5173').set('Cookie', 'moviematch_session=session').send({
      title: 'Filme', posterPath: null, rating: 4.5, body: 'Muito bom',
    });
    expect(saved.status).toBe(200);
    expect(service.publish).toHaveBeenCalledWith('user-1', { title: 'Filme', posterPath: null, rating: 4.5, body: 'Muito bom', movieId: 42 });

    const invalid = await request(app).put('/api/movies/42/reviews/me').set('Origin', 'http://localhost:5173').set('Cookie', 'moviematch_session=session').send({
      title: 'Filme', rating: 4.2, body: 'x'.repeat(2001),
    });
    expect(invalid.status).toBe(400);
    const removed = await request(app).delete('/api/movies/42/reviews/me').set('Origin', 'http://localhost:5173').set('Cookie', 'moviematch_session=session');
    expect(removed.status).toBe(204);
    expect(service.removeMine).toHaveBeenCalledWith('user-1', 42);
  });

  it('requires authentication for user review operations', async () => {
    const { app } = makeApp();
    const response = await request(app).get('/api/movies/42/reviews/me');
    expect(response.status).toBe(401);
  });
});
