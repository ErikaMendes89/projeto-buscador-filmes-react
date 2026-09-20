import { describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth/auth.service.js';
import type { InteractionsRepository } from './movies/interactions.repository.js';
import { MoviesService } from './movies/movies.service.js';
import type { TmdbClient } from './movies/tmdb.client.js';
import type { ReviewsRepository } from './reviews/reviews.repository.js';
import { ReviewsService } from './reviews/reviews.service.js';
import type { SocialRepository } from './social/social.repository.js';
import { SocialService } from './social/social.service.js';
import type { UsersRepository } from './users/users.repository.js';
import { UsersService } from './users/users.service.js';

const user = { id: 'user-1', username: 'erika', displayName: 'Erika', bio: null, createdAt: new Date() };
const users: UsersRepository = { findById: vi.fn(async () => user), findByUsername: vi.fn(async () => user) };

describe('module services', () => {
  it('keeps session and public profile rules inside their modules', async () => {
    await expect(new AuthService(users).getSession(user.id)).resolves.toEqual({ user });
    await expect(new UsersService(users).getProfile('erika')).resolves.toEqual(user);
  });

  it('coordinates catalog and interactions without coupling routes to PostgreSQL', async () => {
    const catalog = { discover: vi.fn(async () => []), search: vi.fn(async () => []) } as unknown as TmdbClient;
    const interactions: InteractionsRepository = {
      listByUser: vi.fn(async () => []),
      upsert: vi.fn(async (_userId, interaction) => interaction),
      remove: vi.fn(async () => undefined),
    };
    const service = new MoviesService(catalog, interactions);
    await service.discover('Duna');
    expect(catalog.search).toHaveBeenCalledWith('Duna');
  });

  it('publishes reviews through the reviews repository contract', async () => {
    const reviews: ReviewsRepository = {
      listByMovie: vi.fn(async () => []),
      upsert: vi.fn(async (_userId, review) => ({ ...review, id: 'review-1', author: { username: 'erika', displayName: 'Erika' }, createdAt: new Date() })),
    };
    const result = await new ReviewsService(reviews).publish(user.id, { movieId: 1, title: 'Filme', posterPath: null, rating: 4.5, body: null });
    expect(result.rating).toBe(4.5);
  });

  it('rejects self-follow inside the social domain', () => {
    const social: SocialRepository = { follow: vi.fn(), unfollow: vi.fn(), getFeed: vi.fn(async () => []) };
    expect(() => new SocialService(social).follow(user.id, user.id)).toThrow('seguir o próprio perfil');
  });
});
