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
    return this.social.follow(userId, targetUserId);
  }

  unfollow(userId: string, targetUserId: string) {
    return this.social.unfollow(userId, targetUserId);
  }

  async getFollowStatus(userId: string, username: string) {
    const followedId = await this.findTargetUserId(username);
    return { following: userId !== followedId && await this.social.isFollowing(userId, followedId) };
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
