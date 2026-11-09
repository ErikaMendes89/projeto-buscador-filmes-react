import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../shared/http.js';
import { requireSession } from '../auth/auth.middleware.js';
import type { AuthService } from '../auth/auth.service.js';
import type { ConversationsService } from './conversations.service.js';

export function createConversationsRouter(service: ConversationsService, auth: AuthService) {
  const router = Router();
  router.use(requireSession(auth));

  router.post('/conversations', asyncHandler(async (request, response) => {
    const { username } = z.object({
      username: z.string().trim().min(3).max(40).regex(/^[a-zA-Z0-9_]+$/).transform((value) => value.toLowerCase()),
    }).strict().parse(request.body);
    const result = await service.createIndividual(response.locals.userId as string, username);
    response.status(result.created ? 201 : 200).json({ data: { id: result.id, kind: 'individual' } });
  }));

  router.get('/conversations', asyncHandler(async (_request, response) => {
    response.json({ data: await service.listForUser(response.locals.userId as string) });
  }));

  router.get('/conversations/:conversationId/messages', asyncHandler(async (request, response) => {
    const conversationId = z.string().uuid().parse(request.params.conversationId);
    const page = z.coerce.number().int().min(1).max(500).default(1).parse(request.query.page);
    const result = await service.listMessages(response.locals.userId as string, conversationId, page);
    response.json({
      data: result.items,
      pagination: { page: result.page, pageSize: result.pageSize, totalPages: result.totalPages, totalResults: result.totalResults },
    });
  }));

  router.get('/conversations/:conversationId/messages/after/:messageId', asyncHandler(async (request, response) => {
    const conversationId = z.string().uuid().parse(request.params.conversationId);
    const messageId = z.string().uuid().parse(request.params.messageId);
    const result = await service.listMessagesAfter(response.locals.userId as string, conversationId, messageId);
    response.json({ data: result.items, pagination: { hasMore: result.hasMore, nextCursor: result.nextCursor } });
  }));

  router.post('/conversations/:conversationId/messages/read', asyncHandler(async (request, response) => {
    const conversationId = z.string().uuid().parse(request.params.conversationId);
    await service.markMessagesRead(response.locals.userId as string, conversationId);
    response.status(204).end();
  }));

  return router;
}
