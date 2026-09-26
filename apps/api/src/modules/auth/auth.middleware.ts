import type { Request, RequestHandler } from 'express';
import { AppError } from '../../shared/errors.js';
import { asyncHandler } from '../../shared/http.js';
import type { AuthService } from './auth.service.js';

export const SESSION_COOKIE = 'moviematch_session';

export function readSessionToken(request: Request): string | null {
  const cookieHeader = request.headers.cookie;
  if (!cookieHeader) return null;
  const entry = cookieHeader.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  return entry?.slice(SESSION_COOKIE.length + 1) || null;
}

export function requireSession(service: AuthService): RequestHandler {
  return asyncHandler(async (request, response, next) => {
    const token = readSessionToken(request);
    if (!token) throw new AppError('Autenticação necessária', 401, 'unauthorized');
    const userId = await service.resolveSession(token);
    if (!userId) throw new AppError('Sessão inválida ou expirada', 401, 'unauthorized');
    response.locals.userId = userId;
    next();
  });
}

export const requireSameOrigin: RequestHandler = (request, _response, next) => {
  if (request.method === 'GET' || request.method === 'HEAD' || request.method === 'OPTIONS') {
    next();
    return;
  }
  if (request.get('origin') !== request.app.get('webOrigin')) {
    next(new AppError('Origem não permitida', 403, 'origin_forbidden'));
    return;
  }
  next();
};
