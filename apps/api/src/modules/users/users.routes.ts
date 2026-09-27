import { Router } from 'express';
import { z } from 'zod';
import { requireSession } from '../auth/auth.middleware.js';
import type { AuthService } from '../auth/auth.service.js';
import { asyncHandler } from '../../shared/http.js';
import type { UsersService } from './users.service.js';

const profileSchema = z.object({
  username: z.string().trim().min(3).max(40).regex(/^[a-zA-Z0-9_]+$/).transform((value) => value.toLowerCase()),
  displayName: z.string().trim().min(1).max(100),
  bio: z.string().trim().max(280).transform((value) => value || null).nullable(),
}).strict();

function publicProfile(user: Awaited<ReturnType<UsersService['getProfile']>>) {
  return {
    username: user.username,
    displayName: user.displayName,
    bio: user.bio,
    createdAt: user.createdAt,
    ...(user.followersCount === undefined ? {} : { followersCount: user.followersCount }),
    ...(user.followingCount === undefined ? {} : { followingCount: user.followingCount }),
  };
}

export function createUsersRouter(service: UsersService, auth: AuthService) {
  const router = Router();

  router.get('/search', asyncHandler(async (request, response) => {
    const query = z.string().trim().min(2).max(40).regex(/^[a-zA-Z0-9_]+$/).transform((value) => value.toLowerCase()).parse(request.query.q);
    const page = z.coerce.number().int().min(1).max(500).default(1).parse(request.query.page);
    const result = await service.searchProfiles(query, page);
    response.json({
      data: result.items.map((user) => ({ username: user.username, displayName: user.displayName, bio: user.bio, createdAt: user.createdAt })),
      pagination: { page: result.page, totalPages: result.totalPages, totalResults: result.totalResults },
    });
  }));

  router.put('/me', requireSession(auth), asyncHandler(async (request, response) => {
    const input = profileSchema.parse(request.body);
    const user = await service.updateProfile(response.locals.userId as string, input);
    response.json({ data: { user: publicProfile(user) } });
  }));

  router.get('/:username', asyncHandler(async (request, response) => {
    const username = z.string().trim().min(3).max(40).regex(/^[a-zA-Z0-9_]+$/).transform((value) => value.toLowerCase()).parse(request.params.username);
    response.json({ data: publicProfile(await service.getProfile(username)) });
  }));
  return router;
}
