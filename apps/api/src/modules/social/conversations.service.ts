import { AppError, NotFoundError } from '../../shared/errors.js';
import type { SocialRepository } from './social.repository.js';
import type { ConversationsRepository } from './conversations.repository.js';
import type { MoviesService } from '../movies/movies.service.js';

const HISTORY_PAGE_SIZE = 20;

function assertHistoryQueryAllowed(status: 'ok' | 'not_participant' | 'blocked'): asserts status is 'ok' {
  if (status === 'not_participant') throw new NotFoundError('Conversa não encontrada');
  if (status === 'blocked') {
    throw new AppError('Não é possível acessar esta conversa enquanto houver um bloqueio', 403, 'user_blocked');
  }
}

export class ConversationsService {
  constructor(
    private readonly conversations: ConversationsRepository,
    private readonly social: SocialRepository,
    private readonly movies?: Pick<MoviesService, 'getMovie'>,
  ) {}

  async createIndividual(userId: string, username: string) {
    const peerId = await this.social.findUserIdByUsername(username);
    if (!peerId) throw new NotFoundError('Perfil não encontrado');
    if (peerId === userId) throw new AppError('Não é possível iniciar uma conversa consigo mesmo', 400, 'self_chat');

    if (!await this.social.canChat(userId, peerId)) {
      throw new AppError('Não é possível conversar com este perfil enquanto houver um bloqueio', 403, 'user_blocked');
    }

    const conversation = await this.conversations.createIndividual(userId, peerId);
    if (!conversation) {
      throw new AppError('Não é possível conversar com este perfil enquanto houver um bloqueio', 403, 'user_blocked');
    }
    return conversation;
  }

  listForUser(userId: string) {
    return this.conversations.listForUser(userId);
  }

  async sendMessage(userId: string, conversationId: string, clientMessageId: string, body: string, movieId?: number) {
    if (movieId !== undefined && !this.movies) throw new AppError('Catálogo de filmes indisponível', 503, 'catalog_unavailable');
    const movie = movieId === undefined ? null : await this.movies!.getMovie(movieId);
    const result = await this.conversations.sendMessage(
      conversationId, userId, clientMessageId, movie ? 'Filme compartilhado' : body,
      movie ? { id: movie.id, title: movie.title, posterPath: movie.posterPath } : null,
    );
    if (result.status === 'not_participant') throw new NotFoundError('Conversa não encontrada');
    if (result.status === 'blocked') {
      throw new AppError('Não é possível enviar mensagens enquanto houver um bloqueio', 403, 'user_blocked');
    }
    if (result.status === 'mutual_follow_required') {
      throw new AppError('É necessário seguir este perfil e ser seguido por ele para enviar mensagens', 403, 'mutual_follow_required');
    }
    if (result.status === 'idempotency_conflict') {
      throw new AppError('O identificador de envio já foi usado com outro conteúdo', 409, 'idempotency_conflict');
    }
    return result;
  }

  async listMessages(userId: string, conversationId: string, page: number) {
    const result = await this.conversations.listMessages(conversationId, userId, page, HISTORY_PAGE_SIZE);
    assertHistoryQueryAllowed(result.status);
    return {
      items: result.items,
      totalResults: result.totalResults,
      page,
      pageSize: HISTORY_PAGE_SIZE,
      totalPages: Math.max(1, Math.ceil(result.totalResults / HISTORY_PAGE_SIZE)),
    };
  }

  async listMessagesAfter(userId: string, conversationId: string, afterMessageId: string) {
    const result = await this.conversations.listMessagesAfter(conversationId, userId, afterMessageId, 100);
    assertHistoryQueryAllowed(result.status);
    return { items: result.items, hasMore: result.hasMore, nextCursor: result.hasMore ? result.items.at(-1)?.id ?? null : null };
  }

  async markMessagesRead(userId: string, conversationId: string) {
    const result = await this.conversations.markMessagesRead(conversationId, userId);
    assertHistoryQueryAllowed(result.status);
  }
}
