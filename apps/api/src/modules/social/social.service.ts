import { AppError } from '../../shared/errors.js';
import type { SocialRepository } from './social.repository.js';

export class SocialService {
  constructor(private readonly social: SocialRepository) {}

  getFeed(userId: string) {
    return this.social.getFeed(userId);
  }

  follow(userId: string, targetUserId: string) {
    if (userId === targetUserId) throw new AppError('Você não pode seguir o próprio perfil', 400, 'self_follow');
    return this.social.follow(userId, targetUserId);
  }

  unfollow(userId: string, targetUserId: string) {
    return this.social.unfollow(userId, targetUserId);
  }
}
