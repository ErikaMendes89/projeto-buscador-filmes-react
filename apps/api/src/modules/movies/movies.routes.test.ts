import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { errorHandler } from '../../shared/error-handler.js';
import { createMoviesRouter } from './movies.routes.js';
import type { MoviesService } from './movies.service.js';
import type { AuthService } from '../auth/auth.service.js';

function makeApp() {
  const page = { items: [{ id: 10, title: 'Filme', overview: '', posterPath: null, releaseDate: '2020-01-01', rating: 7, genreIds: [878] }], page: 2, totalPages: 5, totalResults: 82 };
  let listIsPublic = false;
  const service = {
    catalogMode: 'demo',
    discover: vi.fn(async () => page),
    genres: vi.fn(async () => [{ id: 878, name: 'Ficção científica' }]),
    getMovie: vi.fn(async () => ({ ...page.items[0]!, genres: [{ id: 878, name: 'Ficção científica' }] })),
    listInteractions: vi.fn(async (userId) => [{ movieId: 10, title: 'Filme', posterPath: null, status: 'want_to_watch', isFavorite: false, userId }]),
    getListVisibility: vi.fn(async () => listIsPublic),
    setListVisibility: vi.fn(async (_userId, isPublic) => { listIsPublic = isPublic; return isPublic; }),
    getPublicInteractions: vi.fn(async (username) => username === 'alice' && listIsPublic ? [{ movieId: 10, title: 'Filme', posterPath: null, status: 'watched', isFavorite: false }] : null),
    getCommonInteractions: vi.fn(async (_userId, username) => username === 'zero'
      ? { isPublic: true, items: [] }
      : { isPublic: username === 'alice' && listIsPublic, items: [{ movieId: 10, title: 'Filme', posterPath: null, status: 'watched', isFavorite: false }] }),
    saveInteraction: vi.fn(async (userId, input) => ({ ...input, isFavorite: input.isFavorite ?? false, userId })),
    removeInteraction: vi.fn(async () => undefined),
  } as unknown as MoviesService;
  const auth = { resolveSession: vi.fn(async (token: string) => token === 'bob-session' ? 'user-2' : token === 'opaque' ? 'user-1' : null) } as unknown as AuthService;
  const app = express();
  app.use(express.json());
  app.use('/api', createMoviesRouter(service, auth));
  app.use(errorHandler);
  return { app, service };
}

describe('movie routes', () => {
  it('parses discovery filters and returns pagination and catalog mode', async () => {
    const { app, service } = makeApp();
    const response = await request(app).get('/api/movies?page=2&genre=878&year=2020');
    expect(response.status).toBe(200);
    expect(service.discover).toHaveBeenCalledWith(undefined, { page: 2, genreId: 878, year: 2020 });
    expect(response.body).toMatchObject({ data: [{ id: 10 }], pagination: { page: 2, totalPages: 5, totalResults: 82 }, meta: { catalogMode: 'demo' } });
  });

  it('rejects unsupported title plus genre filters and exposes genres and movie details', async () => {
    const { app, service } = makeApp();
    const unsupported = await request(app).get('/api/movies?q=arrival&genre=878');
    expect(unsupported.status).toBe(400);
    expect(service.discover).not.toHaveBeenCalled();

    const genres = await request(app).get('/api/movies/genres');
    expect(genres.body.data).toEqual([{ id: 878, name: 'Ficção científica' }]);
    const details = await request(app).get('/api/movies/10');
    expect(details.body.data).toMatchObject({ id: 10, genres: [{ id: 878, name: 'Ficção científica' }] });
  });

  it('requires a session before saving a movie and scopes the write to that session', async () => {
    const { app, service } = makeApp();
    const body = { movieId: 10, title: 'Filme', posterPath: null, status: 'want_to_watch' };
    const visitor = await request(app).put('/api/me/interactions/10').send(body);
    expect(visitor.status).toBe(401);

    const saved = await request(app).put('/api/me/interactions/10').set('Cookie', 'moviematch_session=opaque').send(body);
    expect(saved.status).toBe(200);
    expect(service.saveInteraction).toHaveBeenCalledWith('user-1', { ...body, posterPath: null });
  });

  it('stores favorite separately from viewing status and rejects the legacy status', async () => {
    const { app, service } = makeApp();
    const body = { movieId: 11, title: 'Filme favorito', status: 'want_to_watch', isFavorite: true };
    const saved = await request(app).put('/api/me/interactions/11').set('Cookie', 'moviematch_session=opaque').send(body);
    expect(saved.status).toBe(200);
    expect(service.saveInteraction).toHaveBeenCalledWith('user-1', { ...body, posterPath: null });

    const legacy = await request(app).put('/api/me/interactions/11').set('Cookie', 'moviematch_session=opaque').send({ ...body, status: 'favorite' });
    expect(legacy.status).toBe(400);
  });

  it('lists only the authenticated user interactions and requires a session for reads and deletes', async () => {
    const { app, service } = makeApp();
    expect((await request(app).get('/api/me/interactions')).status).toBe(401);
    expect((await request(app).delete('/api/me/interactions/10')).status).toBe(401);

    const listed = await request(app).get('/api/me/interactions').set('Cookie', 'moviematch_session=opaque');
    expect(listed.status).toBe(200);
    expect(listed.body.data).toMatchObject([{ movieId: 10, status: 'want_to_watch', isFavorite: false }]);
    expect(service.listInteractions).toHaveBeenCalledWith('user-1');

    const removed = await request(app).delete('/api/me/interactions/10').set('Cookie', 'moviematch_session=opaque');
    expect(removed.status).toBe(204);
    expect(service.removeInteraction).toHaveBeenCalledWith('user-1', 10);
  });

  it('keeps personal movie lists separate between two authenticated accounts', async () => {
    const { app, service } = makeApp();
    const alice = await request(app).get('/api/me/interactions').set('Cookie', 'moviematch_session=opaque');
    const bob = await request(app).get('/api/me/interactions').set('Cookie', 'moviematch_session=bob-session');

    expect(alice.status).toBe(200);
    expect(bob.status).toBe(200);
    expect(alice.body.data[0].userId).toBe('user-1');
    expect(bob.body.data[0].userId).toBe('user-2');
    expect(service.listInteractions).toHaveBeenNthCalledWith(1, 'user-1');
    expect(service.listInteractions).toHaveBeenNthCalledWith(2, 'user-2');
  });

  it('keeps lists private by default and only publishes links when explicitly enabled', async () => {
    const { app, service } = makeApp();
    const privateDefault = await request(app).get('/api/me/list-visibility');
    expect(privateDefault.status).toBe(401);
    const ownSetting = await request(app).get('/api/me/list-visibility').set('Cookie', 'moviematch_session=opaque');
    expect(ownSetting.body.data).toEqual({ isPublic: false });

    const privateList = await request(app).get('/api/users/alice/list');
    expect(privateList.status).toBe(404);
    const published = await request(app).put('/api/me/list-visibility').set('Cookie', 'moviematch_session=opaque').send({ isPublic: true });
    expect(published.body.data).toEqual({ isPublic: true });
    expect(service.setListVisibility).toHaveBeenCalledWith('user-1', true);

    const publicList = await request(app).get('/api/users/alice/list');
    expect(publicList.status).toBe(200);
    expect(publicList.body.data[0]).toMatchObject({ movieId: 10 });

    await request(app).put('/api/me/list-visibility').set('Cookie', 'moviematch_session=opaque').send({ isPublic: false });
    expect((await request(app).get('/api/users/alice/list')).status).toBe(404);
  });

  it('requires a session for common movies and returns no matches from private lists', async () => {
    const { app, service } = makeApp();
    expect((await request(app).get('/api/users/alice/common')).status).toBe(401);

    await request(app).put('/api/me/list-visibility').set('Cookie', 'moviematch_session=opaque').send({ isPublic: true });

    const common = await request(app).get('/api/users/alice/common').set('Cookie', 'moviematch_session=opaque');
    expect(common.status).toBe(200);
    expect(common.body.data).toMatchObject([{ movieId: 10 }]);
    expect(service.getCommonInteractions).toHaveBeenCalledWith('user-1', 'alice');

    const privateCommon = await request(app).get('/api/users/bob/common').set('Cookie', 'moviematch_session=opaque');
    expect(privateCommon.status).toBe(404);

    const noMatches = await request(app).get('/api/users/zero/common').set('Cookie', 'moviematch_session=opaque');
    expect(noMatches.status).toBe(200);
    expect(noMatches.body.data).toEqual([]);
  });
});
