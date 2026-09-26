import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { config } from './config.js';
import { services } from './container.js';
import { createAuthRouter } from './modules/auth/auth.routes.js';
import { requireSameOrigin } from './modules/auth/auth.middleware.js';
import { createMoviesRouter } from './modules/movies/movies.routes.js';
import { createReviewsRouter } from './modules/reviews/reviews.routes.js';
import { createSocialRouter } from './modules/social/social.routes.js';
import { createUsersRouter } from './modules/users/users.routes.js';
import { errorHandler } from './shared/error-handler.js';

export const app = express();
app.disable('x-powered-by');
app.set('webOrigin', config.WEB_ORIGIN);
app.use(helmet());
app.use(cors({ origin: config.WEB_ORIGIN, credentials: true }));
app.use(express.json({ limit: '100kb' }));

app.get('/health', (_request, response) => response.json({ status: 'ok', service: 'moviematch-api' }));

app.use('/api', requireSameOrigin);
app.use('/api/auth', createAuthRouter(services.auth, process.env.NODE_ENV === 'production'));
app.use('/api/users', createUsersRouter(services.users, services.auth));
app.use('/api', createMoviesRouter(services.movies, services.auth));
app.use('/api', createReviewsRouter(services.reviews, services.auth));
app.use('/api', createSocialRouter(services.social, services.auth));

app.use(errorHandler);
