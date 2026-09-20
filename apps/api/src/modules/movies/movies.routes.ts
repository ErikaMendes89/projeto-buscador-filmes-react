import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../shared/http.js';
import { requireSession } from '../auth/auth.middleware.js';
import type { MoviesService } from './movies.service.js';

const interactionSchema = z.object({
  movieId: z.number().int().positive(),
  title: z.string().trim().min(1).max(250),
  posterPath: z.string().nullable().optional(),
  status: z.enum(['want_to_watch', 'watching', 'watched', 'abandoned', 'favorite']),
});

export function createMoviesRouter(service: MoviesService) {
  const router = Router();

  router.get('/movies', asyncHandler(async (request, response) => {
    const query = z.string().trim().min(2).max(100).optional().parse(request.query.q);
    response.json({ data: await service.discover(query) });
  }));

  router.get('/me/interactions', requireSession, asyncHandler(async (_request, response) => {
    response.json({ data: await service.listInteractions(response.locals.userId as string) });
  }));

  router.put('/me/interactions/:movieId', requireSession, asyncHandler(async (request, response) => {
    const movieId = z.coerce.number().int().positive().parse(request.params.movieId);
    const input = interactionSchema.parse({ ...request.body, movieId });
    response.json({ data: await service.saveInteraction(response.locals.userId as string, { ...input, posterPath: input.posterPath ?? null }) });
  }));

  router.delete('/me/interactions/:movieId', requireSession, asyncHandler(async (request, response) => {
    const movieId = z.coerce.number().int().positive().parse(request.params.movieId);
    await service.removeInteraction(response.locals.userId as string, movieId);
    response.status(204).send();
  }));

  return router;
}
