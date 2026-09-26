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
  return { username: user.username, displayName: user.displayName, bio: user.bio, createdAt: user.createdAt };
}

export function createUsersRouter(service: UsersService, auth: AuthService) {
  const router = Router();
  router.put('/me', requireSession(auth), asyncHandler(async (request, response) => {
    const input = profileSchema.parse(request.body);
    const user = await service.updateProfile(response.locals.userId as string, input);
    response.json({ data: { user: publicProfile(user) } });
  }));

  router.get('/:username', asyncHandler(async (request, response) => {
    const username = z.string().trim().min(3).max(40).parse(request.params.username);
    response.json({ data: publicProfile(await service.getProfile(username)) });
  }));
  return router;
}
