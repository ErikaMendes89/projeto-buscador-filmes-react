import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
import { z } from 'zod';

loadEnv({ path: resolve(fileURLToPath(new URL('../../../.env', import.meta.url))) });

const schema = z.object({
  API_PORT: z.coerce.number().int().positive().default(3333),
  DATABASE_URL: z.string().min(1).default('postgresql://moviematch:moviematch@localhost:5432/moviematch'),
  TMDB_API_TOKEN: z.string().optional(),
  WEB_ORIGIN: z.string().url().default('http://localhost:5173'),
});

export const config = schema.parse(process.env);
