import { pool } from './db.js';
import { AuthService } from './modules/auth/auth.service.js';
import { PgInteractionsRepository } from './modules/movies/interactions.repository.js';
import { MoviesService } from './modules/movies/movies.service.js';
import { TmdbClient } from './modules/movies/tmdb.client.js';
import { PgReviewsRepository } from './modules/reviews/reviews.repository.js';
import { ReviewsService } from './modules/reviews/reviews.service.js';
import { PgSocialRepository } from './modules/social/social.repository.js';
import { SocialService } from './modules/social/social.service.js';
import { PgUsersRepository } from './modules/users/users.repository.js';
import { UsersService } from './modules/users/users.service.js';

const usersRepository = new PgUsersRepository(pool);
const interactionsRepository = new PgInteractionsRepository(pool);
const reviewsRepository = new PgReviewsRepository(pool);
const socialRepository = new PgSocialRepository(pool);

export const services = {
  auth: new AuthService(usersRepository),
  users: new UsersService(usersRepository),
  movies: new MoviesService(new TmdbClient(), interactionsRepository),
  reviews: new ReviewsService(reviewsRepository),
  social: new SocialService(socialRepository),
};
