import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../shared/http.js';
import { requireSession } from '../auth/auth.middleware.js';
import type { ReviewsService } from './reviews.service.js';

const createReviewSchema = z.object({
  title: z.string().trim().min(1).max(250),
  posterPath: z.string().nullable().optional(),
  rating: z.number().min(0.5).max(5).multipleOf(0.5),
  body: z.string().trim().max(2000).nullable().optional(),
});

export function createReviewsRouter(service: ReviewsService) {
  const router = Router();

  router.get('/movies/:movieId/reviews', asyncHandler(async (request, response) => {
    const movieId = z.coerce.number().int().positive().parse(request.params.movieId);
    response.json({ data: await service.listForMovie(movieId) });
  }));

  router.put('/movies/:movieId/reviews/me', requireSession, asyncHandler(async (request, response) => {
    const movieId = z.coerce.number().int().positive().parse(request.params.movieId);
    const input = createReviewSchema.parse(request.body);
    const review = await service.publish(response.locals.userId as string, {
      ...input,
      movieId,
      posterPath: input.posterPath ?? null,
      body: input.body ?? null,
    });
    response.status(201).json({ data: review });
  }));

  return router;
}
