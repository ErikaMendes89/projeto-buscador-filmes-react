import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../shared/http.js';
import { requireSession } from '../auth/auth.middleware.js';
import type { SocialService } from './social.service.js';

export function createSocialRouter(service: SocialService) {
  const router = Router();
  router.use(requireSession);

  router.get('/feed', asyncHandler(async (_request, response) => {
    response.json({ data: await service.getFeed(response.locals.userId as string) });
  }));

  router.put('/users/:userId/follow', asyncHandler(async (request, response) => {
    const targetUserId = z.string().uuid().parse(request.params.userId);
    await service.follow(response.locals.userId as string, targetUserId);
    response.status(204).send();
  }));

  router.delete('/users/:userId/follow', asyncHandler(async (request, response) => {
    const targetUserId = z.string().uuid().parse(request.params.userId);
    await service.unfollow(response.locals.userId as string, targetUserId);
    response.status(204).send();
  }));

  return router;
}
