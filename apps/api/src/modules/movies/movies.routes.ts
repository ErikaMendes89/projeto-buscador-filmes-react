import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../shared/http.js';
import { AppError } from '../../shared/errors.js';
import { requireSession } from '../auth/auth.middleware.js';
import type { AuthService } from '../auth/auth.service.js';
import type { MoviesService } from './movies.service.js';

const interactionSchema = z.object({
  movieId: z.number().int().positive(),
  title: z.string().trim().min(1).max(250),
  posterPath: z.string().nullable().optional(),
  status: z.enum(['want_to_watch', 'watching', 'watched', 'abandoned']),
  isFavorite: z.boolean().optional(),
});
const listVisibilitySchema = z.object({ isPublic: z.boolean() });

export function createMoviesRouter(service: MoviesService, auth: AuthService) {
  const router = Router();

  router.get('/users/:username/list', asyncHandler(async (request, response) => {
    const username = z.string().trim().min(3).max(40).parse(request.params.username);
    const items = await service.getPublicInteractions(username);
    if (!items) throw new AppError('Lista não encontrada', 404, 'not_found');
    response.json({ data: items });
  }));

  router.get('/users/:username/common', requireSession(auth), asyncHandler(async (request, response) => {
    const username = z.string().trim().min(3).max(40).parse(request.params.username);
    const result = await service.getCommonInteractions(response.locals.userId as string, username);
    if (!result || !result.isPublic) throw new AppError('Lista não encontrada', 404, 'not_found');
    response.json({ data: result.items });
  }));

  router.get('/movies/genres', asyncHandler(async (_request, response) => {
    response.json({ data: await service.genres(), meta: { catalogMode: service.catalogMode } });
  }));

  router.get('/movies', asyncHandler(async (request, response) => {
    const query = z.string().trim().min(2).max(100).optional().parse(request.query.q);
    const page = z.coerce.number().int().min(1).max(500).default(1).parse(request.query.page);
    const genreId = z.coerce.number().int().positive().optional().parse(request.query.genre);
    const year = z.coerce.number().int().min(1870).max(2200).optional().parse(request.query.year);
    if (query && genreId !== undefined) {
      throw new AppError('O filtro de gênero está disponível na descoberta sem busca por título', 400, 'unsupported_filter');
    }
    const result = await service.discover(query, { page, genreId, year });
    response.json({
      data: result.items,
      pagination: { page: result.page, totalPages: result.totalPages, totalResults: result.totalResults },
      meta: { catalogMode: service.catalogMode },
    });
  }));

  router.get('/movies/:movieId', asyncHandler(async (request, response) => {
    const movieId = z.coerce.number().int().positive().parse(request.params.movieId);
    response.json({ data: await service.getMovie(movieId), meta: { catalogMode: service.catalogMode } });
  }));

  router.get('/me/interactions', requireSession(auth), asyncHandler(async (_request, response) => {
    response.json({ data: await service.listInteractions(response.locals.userId as string) });
  }));

  router.get('/me/list-visibility', requireSession(auth), asyncHandler(async (_request, response) => {
    response.json({ data: { isPublic: await service.getListVisibility(response.locals.userId as string) } });
  }));

  router.put('/me/list-visibility', requireSession(auth), asyncHandler(async (request, response) => {
    const { isPublic } = listVisibilitySchema.parse(request.body);
    response.json({ data: { isPublic: await service.setListVisibility(response.locals.userId as string, isPublic) } });
  }));

  router.put('/me/interactions/:movieId', requireSession(auth), asyncHandler(async (request, response) => {
    const movieId = z.coerce.number().int().positive().parse(request.params.movieId);
    const input = interactionSchema.parse({ ...request.body, movieId });
    response.json({ data: await service.saveInteraction(response.locals.userId as string, { ...input, posterPath: input.posterPath ?? null }) });
  }));

  router.delete('/me/interactions/:movieId', requireSession(auth), asyncHandler(async (request, response) => {
    const movieId = z.coerce.number().int().positive().parse(request.params.movieId);
    await service.removeInteraction(response.locals.userId as string, movieId);
    response.status(204).send();
  }));

  return router;
}
