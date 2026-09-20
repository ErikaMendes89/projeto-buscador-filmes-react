import { Router } from 'express';
import { asyncHandler } from '../../shared/http.js';
import { requireSession } from './auth.middleware.js';
import type { AuthService } from './auth.service.js';

export function createAuthRouter(service: AuthService) {
  const router = Router();
  router.get('/session', requireSession, asyncHandler(async (_request, response) => {
    response.json({ data: await service.getSession(response.locals.userId as string) });
  }));
  return router;
}
