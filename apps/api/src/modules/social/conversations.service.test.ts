import { describe, expect, it, vi } from 'vitest';
import { ConversationsService } from './conversations.service.js';

describe('ConversationsService', () => {
  it('creates or returns an individual conversation for a valid, unblocked account', async () => {
    const conversations = { createIndividual: vi.fn(async () => ({ id: 'conversation-1', created: true })) };
    const social = {
      findUserIdByUsername: vi.fn(async () => 'peer-id'),
      canChat: vi.fn(async () => true),
    };
    const service = new ConversationsService(conversations as never, social as never);

    await expect(service.createIndividual('viewer-id', 'alice')).resolves.toEqual({ id: 'conversation-1', created: true });
    expect(conversations.createIndividual).toHaveBeenCalledWith('viewer-id', 'peer-id');
  });

  it('rejects missing, self, and blocked targets before creating a conversation', async () => {
    const conversations = { createIndividual: vi.fn(async () => ({ id: 'conversation-1', created: true })) };
    const social = {
      findUserIdByUsername: vi.fn(async (username: string) => username === 'missing' ? null : username === 'self' ? 'viewer-id' : 'peer-id'),
      canChat: vi.fn(async () => false),
    };
    const service = new ConversationsService(conversations as never, social as never);

    await expect(service.createIndividual('viewer-id', 'missing')).rejects.toMatchObject({ statusCode: 404 });
    await expect(service.createIndividual('viewer-id', 'self')).rejects.toMatchObject({ code: 'self_chat', statusCode: 400 });
    await expect(service.createIndividual('viewer-id', 'alice')).rejects.toMatchObject({ code: 'user_blocked', statusCode: 403 });
    expect(conversations.createIndividual).not.toHaveBeenCalled();
  });

  it('maps repository authorization results when reading paginated history', async () => {
    const conversations = {
      listMessages: vi.fn(async (): Promise<{ status: 'ok'; items: never[]; totalResults: number } | { status: 'not_participant' | 'blocked' }> => ({ status: 'ok', items: [], totalResults: 21 })),
    };
    const service = new ConversationsService(conversations as never, {} as never);

    await expect(service.listMessages('viewer-id', 'conversation-1', 2)).resolves.toEqual({
      items: [], totalResults: 21, page: 2, pageSize: 20, totalPages: 2,
    });
    expect(conversations.listMessages).toHaveBeenCalledWith('conversation-1', 'viewer-id', 2, 20);

    conversations.listMessages.mockResolvedValueOnce({ status: 'not_participant' });
    await expect(service.listMessages('outsider-id', 'conversation-1', 1)).rejects.toMatchObject({ statusCode: 404 });
    expect(conversations.listMessages).toHaveBeenCalledTimes(2);

    conversations.listMessages.mockResolvedValueOnce({ status: 'blocked' });
    await expect(service.listMessages('viewer-id', 'conversation-1', 1)).rejects.toMatchObject({ code: 'user_blocked', statusCode: 403 });
    expect(conversations.listMessages).toHaveBeenCalledTimes(3);
  });

  it('maps repository authorization results for cursor recovery and read receipts', async () => {
    const conversations = {
      listMessagesAfter: vi.fn(async (): Promise<{ status: 'ok'; items: { id: string }[]; hasMore: boolean } | { status: 'not_participant' | 'blocked' }> => ({ status: 'ok', items: [{ id: 'message-2' }], hasMore: false })),
      markMessagesRead: vi.fn(async (): Promise<{ status: 'ok'; updatedCount: number } | { status: 'not_participant' | 'blocked' }> => ({ status: 'ok', updatedCount: 1 })),
    };
    const service = new ConversationsService(conversations as never, {} as never);

    await expect(service.listMessagesAfter('viewer-id', 'conversation-1', 'message-1')).resolves.toEqual({ items: [{ id: 'message-2' }], hasMore: false, nextCursor: null });
    await expect(service.markMessagesRead('viewer-id', 'conversation-1')).resolves.toBeUndefined();
    expect(conversations.listMessagesAfter).toHaveBeenCalledWith('conversation-1', 'viewer-id', 'message-1', 100);
    expect(conversations.markMessagesRead).toHaveBeenCalledWith('conversation-1', 'viewer-id');

    conversations.markMessagesRead.mockResolvedValueOnce({ status: 'not_participant' });
    await expect(service.markMessagesRead('outsider-id', 'conversation-1')).rejects.toMatchObject({ statusCode: 404 });
    conversations.listMessagesAfter.mockResolvedValueOnce({ status: 'blocked' });
    await expect(service.listMessagesAfter('viewer-id', 'conversation-1', 'message-1')).rejects.toMatchObject({ code: 'user_blocked', statusCode: 403 });
    expect(conversations.markMessagesRead).toHaveBeenCalledTimes(2);
  });

  it('maps send failures for nonparticipants, blocks, and missing mutual follows', async () => {
    const conversations = { sendMessage: vi.fn()
      .mockResolvedValueOnce({ status: 'not_participant' })
      .mockResolvedValueOnce({ status: 'blocked' })
      .mockResolvedValueOnce({ status: 'mutual_follow_required' })
      .mockResolvedValueOnce({ status: 'idempotency_conflict' })
      .mockResolvedValueOnce({ status: 'sent', created: true, recipientId: 'peer-id', message: { id: 'message-1' } }) };
    const service = new ConversationsService(conversations as never, {} as never);

    await expect(service.sendMessage('outsider-id', 'conversation-1', 'client-id', 'hello')).rejects.toMatchObject({ statusCode: 404 });
    await expect(service.sendMessage('viewer-id', 'conversation-1', 'client-id', 'hello')).rejects.toMatchObject({ code: 'user_blocked', statusCode: 403 });
    await expect(service.sendMessage('viewer-id', 'conversation-1', 'client-id', 'hello')).rejects.toMatchObject({ code: 'mutual_follow_required', statusCode: 403 });
    await expect(service.sendMessage('viewer-id', 'conversation-1', 'client-id', 'hello')).rejects.toMatchObject({ code: 'idempotency_conflict', statusCode: 409 });
    await expect(service.sendMessage('viewer-id', 'conversation-1', 'client-id', 'hello')).resolves.toEqual({ status: 'sent', created: true, recipientId: 'peer-id', message: { id: 'message-1' } });
  });

  it('validates a shared movie through the catalog and persists only its canonical reference', async () => {
    const movie = { id: 42, title: 'Filme válido', posterPath: '/poster.jpg', overview: '', releaseDate: null, rating: 7, genreIds: [], genres: [] };
    const conversations = { sendMessage: vi.fn(async () => ({ status: 'sent', created: true, recipientId: 'peer-id', message: { id: 'message-1' } })) };
    const catalog = { getMovie: vi.fn(async () => movie) };
    const service = new ConversationsService(conversations as never, {} as never, catalog as never);

    await service.sendMessage('sender-id', 'conversation-id', 'client-id', '', 42);

    expect(catalog.getMovie).toHaveBeenCalledWith(42);
    expect(conversations.sendMessage).toHaveBeenCalledWith('conversation-id', 'sender-id', 'client-id', 'Filme compartilhado', { id: 42, title: 'Filme válido', posterPath: '/poster.jpg' });
  });

  it('does not persist a movie share when the catalog rejects its reference', async () => {
    const conversations = { sendMessage: vi.fn() };
    const catalog = { getMovie: vi.fn(async () => { throw new Error('Filme não encontrado'); }) };
    const service = new ConversationsService(conversations as never, {} as never, catalog as never);

    await expect(service.sendMessage('sender-id', 'conversation-id', 'client-id', '', 999)).rejects.toThrow('Filme não encontrado');
    expect(conversations.sendMessage).not.toHaveBeenCalled();
  });
});
