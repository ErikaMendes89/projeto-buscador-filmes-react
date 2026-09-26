import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../shared/http.js';
import { readSessionToken, requireSession, SESSION_COOKIE } from './auth.middleware.js';
import type { AuthService } from './auth.service.js';

const registrationSchema = z.object({
  email: z.string().trim().email().max(320).transform((value) => value.toLowerCase()),
  username: z.string().trim().min(3).max(40).regex(/^[a-zA-Z0-9_]+$/).transform((value) => value.toLowerCase()),
  displayName: z.string().trim().min(1).max(100),
  password: z.string().min(12).max(128),
});

const loginSchema = z.object({
  email: z.string().trim().email().max(320).transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(128),
});

const passwordResetRequestSchema = z.object({
  email: z.string().trim().email().max(320).transform((value) => value.toLowerCase()),
});

const passwordResetSchema = z.object({
  token: z.string().min(32).max(256),
  password: z.string().min(12).max(128),
});

const cookieOptions = (secure: boolean) => `Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}${secure ? '; Secure' : ''}`;

function createRateLimiter(limit: number, windowMs: number): RequestHandler {
  const attempts = new Map<string, { count: number; resetAt: number }>();

  return (request, response, next) => {
    const now = Date.now();
    for (const [ip, entry] of attempts) {
      if (entry.resetAt <= now) attempts.delete(ip);
    }

    const ip = request.ip || request.socket.remoteAddress || 'unknown';
    let entry = attempts.get(ip);
    if (!entry || entry.resetAt <= now) {
      if (attempts.size >= 10_000) {
        const oldestIp = attempts.keys().next().value;
        if (oldestIp) attempts.delete(oldestIp);
      }
      entry = { count: 0, resetAt: now + windowMs };
      attempts.set(ip, entry);
    }

    if (entry.count >= limit) {
      response.setHeader('Retry-After', String(Math.max(1, Math.ceil((entry.resetAt - now) / 1000))));
      response.status(429).json({ error: 'Muitas tentativas. Tente novamente mais tarde.', code: 'rate_limited' });
      return;
    }

    entry.count += 1;
    next();
  };
}

export function createAuthRouter(service: AuthService, secureCookie: boolean) {
  const router = Router();
  const limitLoginAttempts = createRateLimiter(10, 15 * 60 * 1000);
  const limitRegistrationAttempts = createRateLimiter(5, 15 * 60 * 1000);
  const limitResetRequests = createRateLimiter(5, 15 * 60 * 1000);
  const limitResetConfirmations = createRateLimiter(10, 15 * 60 * 1000);

  router.post('/register', limitRegistrationAttempts, asyncHandler(async (request, response) => {
    const input = registrationSchema.parse(request.body);
    await service.register(input);
    response.status(202).json({ message: 'Se os dados permitirem, o cadastro estará disponível para entrar.' });
  }));

  router.post('/login', limitLoginAttempts, asyncHandler(async (request, response) => {
    const input = loginSchema.parse(request.body);
    const { user, token } = await service.login(input.email, input.password);
    response.setHeader('Set-Cookie', `${SESSION_COOKIE}=${token}; ${cookieOptions(secureCookie)}`);
    response.json({ data: { user } });
  }));

  router.post('/password-reset', limitResetRequests, asyncHandler(async (request, response) => {
    const input = passwordResetRequestSchema.parse(request.body);
    await service.requestPasswordReset(input.email);
    response.status(202).json({ message: 'Se houver uma conta para este e-mail, enviaremos instruções de recuperação.' });
  }));

  router.post('/password-reset/confirm', limitResetConfirmations, asyncHandler(async (request, response) => {
    const input = passwordResetSchema.parse(request.body);
    await service.resetPassword(input.token, input.password);
    response.status(204).send();
  }));

  router.get('/session', requireSession(service), asyncHandler(async (_request, response) => {
    response.json({ data: await service.getSession(response.locals.userId as string) });
  }));

  router.post('/logout', requireSession(service), asyncHandler(async (request, response) => {
    const token = readSessionToken(request);
    if (token) await service.revokeSession(token);
    response.setHeader('Set-Cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureCookie ? '; Secure' : ''}`);
    response.status(204).send();
  }));

  return router;
}
