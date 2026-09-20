export type Movie = {
  id: number;
  title: string;
  overview: string;
  posterPath: string | null;
  releaseDate: string | null;
  rating: number;
};

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3333';

export async function getMovies(query: string): Promise<Movie[]> {
  const url = new URL('/api/movies', API_URL);
  if (query.trim().length >= 2) url.searchParams.set('q', query.trim());
  const response = await fetch(url);
  if (!response.ok) throw new Error('Não foi possível carregar os filmes.');
  const payload = (await response.json()) as { data: Movie[] };
  return payload.data;
}

export async function saveToWatchlist(movie: Movie): Promise<void> {
  const response = await fetch(`${API_URL}/api/me/interactions/${movie.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ movieId: movie.id, title: movie.title, posterPath: movie.posterPath, status: 'want_to_watch' }),
  });
  if (!response.ok) throw new Error('Não foi possível salvar o filme.');
}
