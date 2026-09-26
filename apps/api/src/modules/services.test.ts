import { describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth/auth.service.js';
import type { AuthRepository } from './auth/auth.repository.js';
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
const users: UsersRepository = {
  findById: vi.fn(async () => user),
  findByUsername: vi.fn(async () => user),
  findAccountByEmail: vi.fn(async () => null),
  createAccount: vi.fn(async () => user),
  updateProfile: vi.fn(async (_id, input) => ({ ...user, ...input })),
};
const authRepository: AuthRepository = {
  createSession: vi.fn(async () => undefined),
  findSessionUser: vi.fn(async () => user.id),
  revokeSession: vi.fn(async () => undefined),
  createPasswordResetToken: vi.fn(async () => undefined),
  resetPassword: vi.fn(async () => true),
};

describe('module services', () => {
  it('keeps session and public profile rules inside their modules', async () => {
    await expect(new AuthService(users, authRepository, { sendPasswordReset: vi.fn(async () => undefined) }, 'http://localhost:5173').getSession(user.id)).resolves.toEqual({ user });
    await expect(new UsersService(users).getProfile('erika')).resolves.toEqual(user);
  });

  it('coordinates catalog and interactions without coupling routes to PostgreSQL', async () => {
    const page = { items: [], page: 1, totalPages: 1, totalResults: 0 };
    const catalog = {
      discover: vi.fn(async () => page),
      search: vi.fn(async () => page),
      get mode() { return 'demo' as const; },
      genres: vi.fn(async () => []),
      getMovie: vi.fn(),
    } as unknown as TmdbClient;
    const interactions: InteractionsRepository = {
      listByUser: vi.fn(async () => []),
      getListVisibility: vi.fn(async () => false),
      setListVisibility: vi.fn(async (_userId, isPublic) => isPublic),
      listPublicByUsername: vi.fn(async () => []),
      listCommonWithPublicUser: vi.fn(async () => ({ isPublic: true, items: [] })),
      upsert: vi.fn(async (_userId, interaction) => ({ ...interaction, isFavorite: interaction.isFavorite ?? false })),
      remove: vi.fn(async () => undefined),
    };
    const service = new MoviesService(catalog, interactions);
    await service.discover('Duna', { page: 1 });
    expect(catalog.search).toHaveBeenCalledWith('Duna', { page: 1 });
  });

  it('publishes reviews through the reviews repository contract', async () => {
    const reviews: ReviewsRepository = {
      listByMovie: vi.fn(async () => []),
      findByUserAndMovie: vi.fn(async () => null),
      upsert: vi.fn(async (_userId, review) => ({ ...review, id: 'review-1', author: { username: 'erika', displayName: 'Erika' }, createdAt: new Date() })),
      remove: vi.fn(async () => undefined),
    };
    const result = await new ReviewsService(reviews).publish(user.id, { movieId: 1, title: 'Filme', posterPath: null, rating: 4.5, body: null });
    expect(result.rating).toBe(4.5);
  });

  it('rejects self-follow inside the social domain', () => {
    const social: SocialRepository = { follow: vi.fn(), unfollow: vi.fn(), getFeed: vi.fn(async () => []) };
    expect(() => new SocialService(social).follow(user.id, user.id)).toThrow('seguir o próprio perfil');
  });
});
