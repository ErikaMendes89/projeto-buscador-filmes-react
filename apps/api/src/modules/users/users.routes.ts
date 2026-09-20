import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../shared/http.js';
import type { UsersService } from './users.service.js';

export function createUsersRouter(service: UsersService) {
  const router = Router();
  router.get('/:username', asyncHandler(async (request, response) => {
    const username = z.string().trim().min(3).max(40).parse(request.params.username);
    response.json({ data: await service.getProfile(username) });
  }));
  return router;
}
