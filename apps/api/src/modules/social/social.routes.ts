import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../shared/http.js';
import { requireSession } from '../auth/auth.middleware.js';
import type { AuthService } from '../auth/auth.service.js';
import type { SocialService } from './social.service.js';

export function createSocialRouter(service: SocialService, auth: AuthService) {
  const router = Router();
  router.use(requireSession(auth));

  router.get('/users/by-username/:username/follow', asyncHandler(async (request, response) => {
    const username = z.string().trim().min(3).max(40).regex(/^[a-zA-Z0-9_]+$/).transform((value) => value.toLowerCase()).parse(request.params.username);
    response.json({ data: await service.getFollowStatus(response.locals.userId as string, username) });
  }));

  router.put('/users/by-username/:username/follow', asyncHandler(async (request, response) => {
    const username = z.string().trim().min(3).max(40).regex(/^[a-zA-Z0-9_]+$/).transform((value) => value.toLowerCase()).parse(request.params.username);
    await service.followByUsername(response.locals.userId as string, username);
    response.status(204).send();
  }));

  router.delete('/users/by-username/:username/follow', asyncHandler(async (request, response) => {
    const username = z.string().trim().min(3).max(40).regex(/^[a-zA-Z0-9_]+$/).transform((value) => value.toLowerCase()).parse(request.params.username);
    await service.unfollowByUsername(response.locals.userId as string, username);
    response.status(204).send();
  }));

  router.get('/feed', asyncHandler(async (request, response) => {
    const page = z.coerce.number().int().min(1).max(500).default(1).parse(request.query.page);
    const result = await service.getFeed(response.locals.userId as string, page);
    response.json({ data: result.items, pagination: { page: result.page, totalPages: result.totalPages, totalResults: result.totalResults } });
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
