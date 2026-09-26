import { z } from 'zod';
import { config } from '../../config.js';
import { AppError, NotFoundError } from '../../shared/errors.js';
import type { Movie, MovieDetails, MovieFilters, MovieGenre, MoviePage } from './movies.types.js';

const TMDB_TIMEOUT_MS = 8_000;

const demoGenres: MovieGenre[] = [
  { id: 12, name: 'Aventura' }, { id: 18, name: 'Drama' }, { id: 28, name: 'Ação' },
  { id: 35, name: 'Comédia' }, { id: 53, name: 'Suspense' }, { id: 80, name: 'Crime' },
  { id: 878, name: 'Ficção científica' }, { id: 9648, name: 'Mistério' },
];

const demoMovies: MovieDetails[] = [
  { id: 157336, title: 'Interestelar', overview: 'Exploradores atravessam um buraco de minhoca em busca de um novo lar para a humanidade.', posterPath: '/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg', releaseDate: '2014-11-05', rating: 8.5, genreIds: [12, 18, 878], genres: [demoGenres[0]!, demoGenres[1]!, demoGenres[6]!] },
  { id: 27205, title: 'A Origem', overview: 'Um ladrão invade sonhos para implantar uma ideia na mente de um alvo.', posterPath: '/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg', releaseDate: '2010-07-15', rating: 8.4, genreIds: [28, 878, 9648], genres: [demoGenres[2]!, demoGenres[6]!, demoGenres[7]!] },
  { id: 693134, title: 'Duna: Parte Dois', overview: 'Paul Atreides se une a Chani e aos Fremen enquanto busca vingança.', posterPath: '/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg', releaseDate: '2024-02-27', rating: 8.2, genreIds: [12, 28, 878], genres: [demoGenres[0]!, demoGenres[2]!, demoGenres[6]!] },
];

const movieSchema = z.object({
  id: z.number().int(),
  title: z.string(),
  overview: z.string().optional(),
  poster_path: z.string().nullable().optional(),
  release_date: z.string().optional(),
  vote_average: z.number().optional(),
  genre_ids: z.array(z.number().int()).optional(),
});

const pageSchema = z.object({
  page: z.number().int(),
  total_pages: z.number().int(),
  total_results: z.number().int(),
  results: z.array(movieSchema),
});

const detailSchema = movieSchema.extend({
  genres: z.array(z.object({ id: z.number().int(), name: z.string() })),
});

const genreListSchema = z.object({ genres: z.array(z.object({ id: z.number().int(), name: z.string() })) });

const mapMovie = (movie: z.infer<typeof movieSchema>): Movie => ({
  id: movie.id,
  title: movie.title,
  overview: movie.overview ?? '',
  posterPath: movie.poster_path ?? null,
  releaseDate: movie.release_date || null,
  rating: movie.vote_average ?? 0,
  genreIds: movie.genre_ids ?? [],
});

function demoPage(movies: Movie[], page: number): MoviePage {
  const pageSize = 20;
  const start = (page - 1) * pageSize;
  return { items: movies.slice(start, start + pageSize), page, totalPages: Math.ceil(movies.length / pageSize), totalResults: movies.length };
}

export class TmdbClient {
  constructor(
    private readonly token: string | undefined = config.TMDB_API_TOKEN,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  get mode(): 'demo' | 'tmdb' {
    return this.token ? 'tmdb' : 'demo';
  }

  async discover(filters: MovieFilters): Promise<MoviePage> {
    if (!this.token) {
      const results = demoMovies.filter((movie) =>
        (filters.genreId === undefined || movie.genreIds.includes(filters.genreId)) &&
        (filters.year === undefined || movie.releaseDate?.startsWith(String(filters.year))),
      );
      return demoPage(results, filters.page);
    }

    const params: Record<string, string> = { page: String(filters.page) };
    let path = '/trending/movie/week';
    if (filters.genreId !== undefined || filters.year !== undefined) {
      path = '/discover/movie';
      params.sort_by = 'popularity.desc';
      if (filters.genreId !== undefined) params.with_genres = String(filters.genreId);
      if (filters.year !== undefined) params.primary_release_year = String(filters.year);
    }
    return this.fetchPage(path, params);
  }

  async search(query: string, filters: MovieFilters): Promise<MoviePage> {
    if (!this.token) {
      const normalized = query.toLocaleLowerCase('pt-BR');
      const results = demoMovies.filter((movie) =>
        movie.title.toLocaleLowerCase('pt-BR').includes(normalized) &&
        (filters.year === undefined || movie.releaseDate?.startsWith(String(filters.year))),
      );
      return demoPage(results, filters.page);
    }

    const params: Record<string, string> = { query, page: String(filters.page) };
    if (filters.year !== undefined) params.primary_release_year = String(filters.year);
    return this.fetchPage('/search/movie', params);
  }

  async genres(): Promise<MovieGenre[]> {
    if (!this.token) return demoGenres;
    return this.parseResponse(genreListSchema, await this.fetchJson('/genre/movie/list')).genres;
  }

  async getMovie(movieId: number): Promise<MovieDetails> {
    if (!this.token) {
      const movie = demoMovies.find(({ id }) => id === movieId);
      if (!movie) throw new NotFoundError('Filme não encontrado');
      return movie;
    }
    const result = await this.fetchJson(`/movie/${movieId}`, {}, true);
    const movie = this.parseResponse(detailSchema, result);
    return { ...mapMovie(movie), genreIds: movie.genres.map(({ id }) => id), genres: movie.genres };
  }

  private async fetchPage(path: string, params: Record<string, string>): Promise<MoviePage> {
    const result = this.parseResponse(pageSchema, await this.fetchJson(path, params));
    return {
      items: result.results.map(mapMovie),
      page: result.page,
      totalPages: result.total_pages,
      totalResults: result.total_results,
    };
  }

  private async fetchJson(path: string, params: Record<string, string> = {}, movieDetail = false): Promise<unknown> {
    const url = new URL(`https://api.themoviedb.org/3${path}`);
    url.searchParams.set('language', 'pt-BR');
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));

    try {
      const response = await this.fetcher(url, {
        headers: { Authorization: `Bearer ${this.token}` },
        signal: AbortSignal.timeout(TMDB_TIMEOUT_MS),
      });
      if (response.status === 404 && movieDetail) throw new NotFoundError('Filme não encontrado');
      if (!response.ok) throw new AppError('Catálogo temporariamente indisponível', 503, 'catalog_unavailable');
      return await response.json() as unknown;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Catálogo temporariamente indisponível', 503, 'catalog_unavailable');
    }
  }

  private parseResponse<T>(schema: z.ZodType<T>, payload: unknown): T {
    try {
      return schema.parse(payload);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new AppError('Resposta inválida do catálogo', 503, 'catalog_unavailable');
      }
      throw error;
    }
  }
}
