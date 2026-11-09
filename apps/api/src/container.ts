import { pool } from './db.js';
import { config } from './config.js';
import { AuthService } from './modules/auth/auth.service.js';
import { PgAuthRepository } from './modules/auth/auth.repository.js';
import { UnconfiguredPasswordResetMailer } from './modules/auth/password-reset-mailer.js';
import { PgInteractionsRepository } from './modules/movies/interactions.repository.js';
import { MoviesService } from './modules/movies/movies.service.js';
import { TmdbClient } from './modules/movies/tmdb.client.js';
import { PgReviewsRepository } from './modules/reviews/reviews.repository.js';
import { ReviewsService } from './modules/reviews/reviews.service.js';
import { PgSocialRepository } from './modules/social/social.repository.js';
import { SocialService } from './modules/social/social.service.js';
import { PgConversationsRepository } from './modules/social/conversations.repository.js';
import { ConversationsService } from './modules/social/conversations.service.js';
import { PgUsersRepository } from './modules/users/users.repository.js';
import { UsersService } from './modules/users/users.service.js';

const usersRepository = new PgUsersRepository(pool);
const interactionsRepository = new PgInteractionsRepository(pool);
const reviewsRepository = new PgReviewsRepository(pool);
const socialRepository = new PgSocialRepository(pool);
const conversationsRepository = new PgConversationsRepository(pool);
const moviesService = new MoviesService(new TmdbClient(), interactionsRepository);

export const services = {
  auth: new AuthService(usersRepository, new PgAuthRepository(pool), new UnconfiguredPasswordResetMailer(), config.WEB_ORIGIN),
  users: new UsersService(usersRepository),
  movies: moviesService,
  reviews: new ReviewsService(reviewsRepository),
  social: new SocialService(socialRepository),
  conversations: new ConversationsService(conversationsRepository, socialRepository, moviesService),
};
