import { config } from '../../config.js';
import type { Movie } from './movies.types.js';

type TmdbMovie = {
  id: number;
  title: string;
  overview?: string;
  poster_path?: string | null;
  release_date?: string;
  vote_average?: number;
};

const demoMovies: Movie[] = [
  { id: 157336, title: 'Interestelar', overview: 'Exploradores atravessam um buraco de minhoca em busca de um novo lar para a humanidade.', posterPath: null, releaseDate: '2014-11-05', rating: 8.5 },
  { id: 27205, title: 'A Origem', overview: 'Um ladrão invade sonhos para implantar uma ideia na mente de um alvo.', posterPath: null, releaseDate: '2010-07-15', rating: 8.4 },
  { id: 693134, title: 'Duna: Parte Dois', overview: 'Paul Atreides se une a Chani e aos Fremen enquanto busca vingança.', posterPath: null, releaseDate: '2024-02-27', rating: 8.2 },
];

const mapMovie = (movie: TmdbMovie): Movie => ({
  id: movie.id,
  title: movie.title,
  overview: movie.overview ?? '',
  posterPath: movie.poster_path ?? null,
  releaseDate: movie.release_date ?? null,
  rating: movie.vote_average ?? 0,
});

export class TmdbClient {
  async discover(): Promise<Movie[]> {
    if (!config.TMDB_API_TOKEN) return demoMovies;
    return this.request('/trending/movie/week');
  }

  async search(query: string): Promise<Movie[]> {
    if (!config.TMDB_API_TOKEN) {
      const normalized = query.toLocaleLowerCase('pt-BR');
      return demoMovies.filter((movie) => movie.title.toLocaleLowerCase('pt-BR').includes(normalized));
    }
    return this.request('/search/movie', { query });
  }

  private async request(path: string, params: Record<string, string> = {}): Promise<Movie[]> {
    const url = new URL(`https://api.themoviedb.org/3${path}`);
    url.searchParams.set('language', 'pt-BR');
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
    const response = await fetch(url, { headers: { Authorization: `Bearer ${config.TMDB_API_TOKEN}` } });
    if (!response.ok) throw new Error(`TMDB respondeu com status ${response.status}`);
    const payload = (await response.json()) as { results: TmdbMovie[] };
    return payload.results.map(mapMovie);
  }
}
