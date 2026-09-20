import cors from 'cors';
import express, { type ErrorRequestHandler } from 'express';
import helmet from 'helmet';
import { z } from 'zod';
import { config } from './config.js';
import { pool } from './db.js';
import { discoverMovies, searchMovies } from './tmdb.js';

export const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: config.WEB_ORIGIN }));
app.use(express.json({ limit: '100kb' }));

app.get('/health', (_request, response) => response.json({ status: 'ok', service: 'moviematch-api' }));

app.get('/api/movies', async (request, response, next) => {
  try {
    const query = z.string().trim().min(2).max(100).optional().parse(request.query.q);
    response.json({ data: query ? await searchMovies(query) : await discoverMovies() });
  } catch (error) { next(error); }
});

const interactionSchema = z.object({
  movieId: z.number().int().positive(),
  title: z.string().trim().min(1).max(250),
  posterPath: z.string().nullable().optional(),
  status: z.enum(['want_to_watch', 'watching', 'watched', 'abandoned', 'favorite']),
});

// Usuário de demonstração até o módulo de autenticação da v1.1.
const DEMO_USER_ID = '00000000-0000-0000-0000-000000000001';

app.get('/api/me/interactions', async (_request, response, next) => {
  try {
    const result = await pool.query(
      `SELECT movie_id AS "movieId", title, poster_path AS "posterPath", status, rating
       FROM movie_interactions WHERE user_id = $1 ORDER BY updated_at DESC`,
      [DEMO_USER_ID],
    );
    response.json({ data: result.rows });
  } catch (error) { next(error); }
});

app.put('/api/me/interactions/:movieId', async (request, response, next) => {
  try {
    const movieId = z.coerce.number().int().positive().parse(request.params.movieId);
    const input = interactionSchema.parse({ ...request.body, movieId });
    const result = await pool.query(
      `INSERT INTO movie_interactions (user_id, movie_id, title, poster_path, status)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, movie_id) DO UPDATE SET title = EXCLUDED.title,
       poster_path = EXCLUDED.poster_path, status = EXCLUDED.status, updated_at = now()
       RETURNING movie_id AS "movieId", title, poster_path AS "posterPath", status`,
      [DEMO_USER_ID, input.movieId, input.title, input.posterPath ?? null, input.status],
    );
    response.status(200).json({ data: result.rows[0] });
  } catch (error) { next(error); }
});

app.delete('/api/me/interactions/:movieId', async (request, response, next) => {
  try {
    const movieId = z.coerce.number().int().positive().parse(request.params.movieId);
    await pool.query('DELETE FROM movie_interactions WHERE user_id = $1 AND movie_id = $2', [DEMO_USER_ID, movieId]);
    response.status(204).send();
  } catch (error) { next(error); }
});

const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof z.ZodError) return void response.status(400).json({ error: 'Dados inválidos', details: error.issues });
  console.error(error);
  response.status(500).json({ error: 'Erro interno do servidor' });
};
app.use(errorHandler);
