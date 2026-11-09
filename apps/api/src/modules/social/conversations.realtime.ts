import type { IncomingMessage, Server } from 'node:http';
import type { Socket } from 'node:net';
import { z } from 'zod';
import { WebSocket, WebSocketServer } from 'ws';
import { readSessionToken } from '../auth/auth.middleware.js';
import type { AuthService } from '../auth/auth.service.js';
import { AppError } from '../../shared/errors.js';
import type { ConversationsService } from './conversations.service.js';

const REALTIME_PATH = '/api/conversations/realtime';
const MAX_PAYLOAD_BYTES = 4 * 1024;
const pingSchema = z.object({ type: z.literal('ping') }).strict();
const sendMessageSchema = z.object({
  type: z.literal('send_message'),
  conversationId: z.string().uuid(),
  clientMessageId: z.string().uuid(),
  body: z.string().trim().min(1).max(4000).optional(),
  movieId: z.number().int().positive().optional(),
}).strict().refine((event) => (event.body !== undefined) !== (event.movieId !== undefined));

interface RealtimeIdentity {
  userId: string;
  sessionToken: string;
}

function rejectUpgrade(socket: Socket, status: 401 | 403 | 404 | 503) {
  if (socket.destroyed) return;
  const messages = { 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found', 503: 'Service Unavailable' };
  const message = messages[status];
  socket.end(`HTTP/1.1 ${status} ${message}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
}

function sendJson(socket: WebSocket, payload: unknown) {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload));
}

export function attachConversationRealtime(
  server: Server,
  auth: Pick<AuthService, 'resolveSession'>,
  conversations: Pick<ConversationsService, 'sendMessage'>,
  webOrigin: string,
) {
  const webSockets = new WebSocketServer({ noServer: true, maxPayload: MAX_PAYLOAD_BYTES });
  const identities = new WeakMap<WebSocket, RealtimeIdentity>();
  const socketsByUser = new Map<string, Set<WebSocket>>();

  const onUpgrade = (request: IncomingMessage, socket: Socket, head: Buffer) => {
    void (async () => {
      let url: URL;
      try {
        url = new URL(request.url ?? '/', 'http://localhost');
      } catch {
        rejectUpgrade(socket, 404);
        return;
      }
      if (url.pathname !== REALTIME_PATH || url.search) {
        rejectUpgrade(socket, 404);
        return;
      }
      if (request.headers.origin !== webOrigin) {
        rejectUpgrade(socket, 403);
        return;
      }

      const token = readSessionToken(request);
      if (!token) {
        rejectUpgrade(socket, 401);
        return;
      }

      let userId: string | null;
      try {
        userId = await auth.resolveSession(token);
      } catch {
        rejectUpgrade(socket, 503);
        return;
      }
      if (!userId) {
        rejectUpgrade(socket, 401);
        return;
      }
      if (socket.destroyed) return;

      webSockets.handleUpgrade(request, socket, head, (webSocket) => {
        identities.set(webSocket, { userId, sessionToken: token });
        webSockets.emit('connection', webSocket, request);
      });
    })().catch(() => rejectUpgrade(socket, 503));
  };

  server.on('upgrade', onUpgrade);
  webSockets.on('connection', (webSocket: WebSocket) => {
    const identity = identities.get(webSocket);
    if (!identity) {
      webSocket.close(1011, 'Falha ao autenticar conexão');
      return;
    }
    const sockets = socketsByUser.get(identity.userId) ?? new Set<WebSocket>();
    sockets.add(webSocket);
    socketsByUser.set(identity.userId, sockets);
    sendJson(webSocket, { type: 'connected' });

    webSocket.once('close', () => {
      sockets.delete(webSocket);
      if (sockets.size === 0) socketsByUser.delete(identity.userId);
    });

    let operationQueue = Promise.resolve();
    webSocket.on('message', (data, isBinary) => {
      operationQueue = operationQueue.then(async () => {
        if (webSocket.readyState !== WebSocket.OPEN) return;
        if (isBinary) {
          webSocket.close(1003, 'Somente mensagens JSON são aceitas');
          return;
        }

        let activeUserId: string | null;
        try {
          activeUserId = await auth.resolveSession(identity.sessionToken);
        } catch {
          webSocket.close(1013, 'Sessão temporariamente indisponível');
          return;
        }
        if (activeUserId !== identity.userId) {
          webSocket.close(4401, 'Sessão inválida ou expirada');
          return;
        }

        let event: unknown;
        try {
          event = JSON.parse(data.toString());
        } catch {
          sendJson(webSocket, { type: 'error', code: 'invalid_message' });
          return;
        }
        if (pingSchema.safeParse(event).success) {
          sendJson(webSocket, { type: 'pong' });
          return;
        }

        const parsed = sendMessageSchema.safeParse(event);
        if (!parsed.success) {
          sendJson(webSocket, { type: 'error', code: 'invalid_message' });
          return;
        }

        try {
          const result = await conversations.sendMessage(identity.userId, parsed.data.conversationId, parsed.data.clientMessageId, parsed.data.body ?? '', parsed.data.movieId);
          const payload = { type: 'message', data: result.message };
          sendJson(webSocket, payload);
          const recipients = result.created ? [...(socketsByUser.get(result.recipientId) ?? [])] : [];
          await Promise.all(recipients.map(async (recipient) => {
            const recipientIdentity = identities.get(recipient);
            if (!recipientIdentity || recipient.readyState !== WebSocket.OPEN) return;
            try {
              const recipientSession = await auth.resolveSession(recipientIdentity.sessionToken);
              if (recipientSession !== result.recipientId) {
                recipient.close(4401, 'Sessão inválida ou expirada');
                return;
              }
            } catch {
              recipient.close(1013, 'Sessão temporariamente indisponível');
              return;
            }
            sendJson(recipient, payload);
          }));
        } catch (error) {
          sendJson(webSocket, {
            type: 'error',
            code: error instanceof AppError ? error.code : 'internal_error',
          });
        }
      }).catch(() => sendJson(webSocket, { type: 'error', code: 'internal_error' }));
    });
  });

  return {
    close() {
      server.off('upgrade', onUpgrade);
      for (const client of webSockets.clients) client.close(1001, 'Servidor encerrando');
      webSockets.close();
    },
  };
}
