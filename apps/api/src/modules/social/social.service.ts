import { AppError, NotFoundError } from '../../shared/errors.js';
import type { SocialRepository } from './social.repository.js';

const FEED_PAGE_SIZE = 20;

export class SocialService {
  constructor(private readonly social: SocialRepository) {}

  async getFeed(userId: string, page: number) {
    const result = await this.social.getFeed(userId, page, FEED_PAGE_SIZE);
    return {
      ...result,
      page,
      totalPages: Math.max(1, Math.ceil(result.totalResults / FEED_PAGE_SIZE)),
    };
  }

  follow(userId: string, targetUserId: string) {
    if (userId === targetUserId) throw new AppError('Você não pode seguir o próprio perfil', 400, 'self_follow');
    return this.social.follow(userId, targetUserId).then((allowed) => {
      if (!allowed) throw new AppError('Não é possível seguir este perfil enquanto houver um bloqueio', 403, 'user_blocked');
    });
  }

  unfollow(userId: string, targetUserId: string) {
    return this.social.unfollow(userId, targetUserId);
  }

  async getFollowStatus(userId: string, username: string) {
    const followedId = await this.findTargetUserId(username);
    return { following: userId !== followedId && await this.social.isFollowing(userId, followedId) };
  }

  async getBlockStatus(userId: string, username: string) {
    const targetId = await this.findTargetUserId(username);
    if (userId === targetId) return { blockedByMe: false, blockedYou: false };
    return this.social.getBlockStatus(userId, targetId);
  }

  async blockByUsername(userId: string, username: string) {
    const targetId = await this.findTargetUserId(username);
    if (userId === targetId) throw new AppError('Você não pode bloquear o próprio perfil', 400, 'self_block');
    return this.social.block(userId, targetId);
  }

  async unblockByUsername(userId: string, username: string) {
    const targetId = await this.findTargetUserId(username);
    if (userId === targetId) throw new AppError('Você não pode desbloquear o próprio perfil', 400, 'self_block');
    return this.social.unblock(userId, targetId);
  }

  async assertChatAllowed(userId: string, username: string) {
    const targetId = await this.findTargetUserId(username);
    if (userId === targetId) throw new AppError('Não é possível iniciar uma conversa consigo mesmo', 400, 'self_chat');
    if (!await this.social.canChat(userId, targetId)) {
      throw new AppError('Não é possível conversar com este perfil enquanto houver um bloqueio', 403, 'user_blocked');
    }
  }

  async followByUsername(userId: string, username: string) {
    const followedId = await this.findTargetUserId(username);
    return this.follow(userId, followedId);
  }

  async unfollowByUsername(userId: string, username: string) {
    const followedId = await this.findTargetUserId(username);
    return this.unfollow(userId, followedId);
  }

  private async findTargetUserId(username: string) {
    const userId = await this.social.findUserIdByUsername(username);
    if (!userId) throw new NotFoundError('Perfil não encontrado');
    return userId;
  }
}
