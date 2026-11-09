import { once } from 'node:events';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { describe, expect, it, vi } from 'vitest';
import WebSocket from 'ws';
import type { AuthService } from '../auth/auth.service.js';
import { attachConversationRealtime } from './conversations.realtime.js';

const WEB_ORIGIN = 'http://localhost:5173';
const REALTIME_PATH = '/api/conversations/realtime';

async function startRealtimeServer(resolveSession: (token: string) => Promise<string | null>) {
  const server = createServer();
  const conversations = {
    sendMessage: vi.fn(async (userId: string, conversationId: string, clientMessageId: string, body: string) => ({
      message: { id: 'message-1', conversationId, clientMessageId, body, sender: { username: userId, displayName: 'Sender' }, createdAt: new Date() },
      recipientId: 'recipient-id',
      created: true,
    })),
  };
  const realtime = attachConversationRealtime(server, { resolveSession } as unknown as AuthService, conversations as never, WEB_ORIGIN);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address() as AddressInfo;
  return {
    url: `ws://127.0.0.1:${address.port}${REALTIME_PATH}`,
    conversations,
    async close(...clients: WebSocket[]) {
      for (const client of clients) {
        if (client.readyState === WebSocket.CLOSED) continue;
        client.terminate();
      }
      realtime.close();
      server.close();
      await once(server, 'close');
    },
  };
}

function rejectedHandshake(client: WebSocket): Promise<number> {
  return new Promise((resolve, reject) => {
    client.on('error', () => undefined);
    client.once('unexpected-response', (_request, response) => resolve(response.statusCode ?? 0));
    client.once('open', () => reject(new Error('The handshake unexpectedly succeeded')));
  });
}

describe('conversation realtime connection', () => {
  it('authenticates the session cookie and supports a real-time ping/pong exchange', async () => {
    const resolveSession = vi.fn(async (token: string) => token === 'valid-session' ? 'user-id' : null);
    const server = await startRealtimeServer(resolveSession);
    const client = new WebSocket(server.url, {
      headers: { Origin: WEB_ORIGIN, Cookie: 'moviematch_session=valid-session' },
    });
    try {
      const readyReceived = once(client, 'message');
      await once(client, 'open');
      const [ready] = await readyReceived;
      expect(JSON.parse(ready.toString())).toEqual({ type: 'connected' });
      expect(resolveSession).toHaveBeenCalledWith('valid-session');

      const pongReceived = once(client, 'message');
      client.send(JSON.stringify({ type: 'ping' }));
      const [pong] = await pongReceived;
      expect(JSON.parse(pong.toString())).toEqual({ type: 'pong' });
    } finally {
      await server.close(client);
    }
  });

  it('rejects missing and expired sessions before upgrading the connection', async () => {
    const resolveSession = vi.fn(async () => null);
    const server = await startRealtimeServer(resolveSession);
    try {
      const missing = new WebSocket(server.url, { headers: { Origin: WEB_ORIGIN } });
      expect(await rejectedHandshake(missing)).toBe(401);

      const expired = new WebSocket(server.url, {
        headers: { Origin: WEB_ORIGIN, Cookie: 'moviematch_session=expired-session' },
      });
      expect(await rejectedHandshake(expired)).toBe(401);
      expect(resolveSession).toHaveBeenCalledWith('expired-session');
    } finally {
      await server.close();
    }
  });

  it('rejects cross-origin connections before resolving a session', async () => {
    const resolveSession = vi.fn(async () => 'user-id');
    const server = await startRealtimeServer(resolveSession);
    try {
      const client = new WebSocket(server.url, {
        headers: { Origin: 'https://attacker.example', Cookie: 'moviematch_session=valid-session' },
      });
      expect(await rejectedHandshake(client)).toBe(403);
      expect(resolveSession).not.toHaveBeenCalled();
    } finally {
      await server.close();
    }
  });

  it('validates the session again for each message and routes accepted messages through the service', async () => {
    const resolveSession = vi.fn(async (token: string) => token === 'sender-session' ? 'user-id' : token === 'recipient-session' ? 'recipient-id' : null);
    const server = await startRealtimeServer(resolveSession);
    const sender = new WebSocket(server.url, {
      headers: { Origin: WEB_ORIGIN, Cookie: 'moviematch_session=sender-session' },
    });
    const recipient = new WebSocket(server.url, {
      headers: { Origin: WEB_ORIGIN, Cookie: 'moviematch_session=recipient-session' },
    });
    try {
      const senderReady = once(sender, 'message');
      const recipientReady = once(recipient, 'message');
      await Promise.all([once(sender, 'open'), once(recipient, 'open')]);
      await Promise.all([senderReady, recipientReady]);
      const senderMessage = once(sender, 'message');
      const recipientMessage = once(recipient, 'message');
      const clientMessageId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
      sender.send(JSON.stringify({ type: 'send_message', conversationId: '11111111-1111-4111-8111-111111111111', clientMessageId, body: ' Olá ' }));
      const [[senderEvent], [recipientEvent]] = await Promise.all([senderMessage, recipientMessage]);
      const payload = JSON.parse(senderEvent.toString());
      const received = JSON.parse(recipientEvent.toString());
      expect(payload.type).toBe('message');
      expect(payload.data.body).toBe('Olá');
      expect(payload.data.clientMessageId).toBe(clientMessageId);
      expect(received).toEqual(payload);
      expect(server.conversations.sendMessage).toHaveBeenCalledWith('user-id', '11111111-1111-4111-8111-111111111111', clientMessageId, 'Olá', undefined);
      const movieMessageId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
      const movieSenderMessage = once(sender, 'message');
      const movieRecipientMessage = once(recipient, 'message');
      sender.send(JSON.stringify({ type: 'send_message', conversationId: '11111111-1111-4111-8111-111111111111', clientMessageId: movieMessageId, movieId: 42 }));
      await Promise.all([movieSenderMessage, movieRecipientMessage]);
      expect(server.conversations.sendMessage).toHaveBeenLastCalledWith('user-id', '11111111-1111-4111-8111-111111111111', movieMessageId, '', 42);
      expect(resolveSession).toHaveBeenCalledTimes(6);
    } finally {
      await server.close(sender, recipient);
    }
  });

  it('acknowledges a duplicate retry without broadcasting the old message again', async () => {
    const resolveSession = vi.fn(async (token: string) => token === 'sender-session' ? 'user-id' : token === 'recipient-session' ? 'recipient-id' : null);
    const server = await startRealtimeServer(resolveSession);
    const sender = new WebSocket(server.url, {
      headers: { Origin: WEB_ORIGIN, Cookie: 'moviematch_session=sender-session' },
    });
    const recipient = new WebSocket(server.url, {
      headers: { Origin: WEB_ORIGIN, Cookie: 'moviematch_session=recipient-session' },
    });
    const clientMessageId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    try {
      const senderReady = once(sender, 'message');
      const recipientReady = once(recipient, 'message');
      await Promise.all([once(sender, 'open'), once(recipient, 'open')]);
      await Promise.all([senderReady, recipientReady]);
      vi.mocked(server.conversations.sendMessage).mockResolvedValueOnce({
        message: {
          id: 'persisted-message', conversationId: '11111111-1111-4111-8111-111111111111', clientMessageId, body: 'Olá',
          sender: { username: 'user-id', displayName: 'Sender' }, createdAt: new Date(),
        },
        recipientId: 'recipient-id',
        created: false,
      });
      const receivedBySender = once(sender, 'message');
      const receivedByRecipient = vi.fn();
      recipient.on('message', receivedByRecipient);
      sender.send(JSON.stringify({ type: 'send_message', conversationId: '11111111-1111-4111-8111-111111111111', clientMessageId, body: 'Olá' }));
      const [ack] = await receivedBySender;
      expect(JSON.parse(ack.toString()).data.id).toBe('persisted-message');
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(receivedByRecipient).not.toHaveBeenCalled();
      expect(resolveSession).toHaveBeenCalledTimes(3);
    } finally {
      await server.close(sender, recipient);
    }
  });

  it('closes an active socket when its session has been revoked', async () => {
    const resolveSession = vi.fn()
      .mockResolvedValueOnce('user-id')
      .mockResolvedValueOnce(null);
    const server = await startRealtimeServer(resolveSession);
    const client = new WebSocket(server.url, {
      headers: { Origin: WEB_ORIGIN, Cookie: 'moviematch_session=revoked-session' },
    });
    try {
      const readyReceived = once(client, 'message');
      await once(client, 'open');
      await readyReceived;
      const closed = once(client, 'close');
      client.send(JSON.stringify({ type: 'ping' }));
      const [code] = await closed;
      expect(code).toBe(4401);
      expect(server.conversations.sendMessage).not.toHaveBeenCalled();
    } finally {
      await server.close(client);
    }
  });
});
