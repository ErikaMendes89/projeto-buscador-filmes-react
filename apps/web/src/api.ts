export type Movie = {
  id: number;
  title: string;
  overview: string;
  posterPath: string | null;
  releaseDate: string | null;
  rating: number;
  genreIds: number[];
};

export type MovieGenre = { id: number; name: string };
export type MovieDetails = Movie & { genres: MovieGenre[] };
export type CatalogMode = 'demo' | 'tmdb';
export type CatalogFilters = { query: string; page: number; genreId?: number; year?: number };
export type MoviePage = { items: Movie[]; page: number; totalPages: number; totalResults: number; catalogMode: CatalogMode };
export type InteractionStatus = 'want_to_watch' | 'watching' | 'watched' | 'abandoned';
export type MovieInteraction = {
  movieId: number;
  title: string;
  posterPath: string | null;
  status: InteractionStatus;
  isFavorite: boolean;
  rating: number | null;
};

export type SessionUser = { id: string; username: string; displayName: string; bio: string | null; createdAt: string };
export type PublicProfile = Omit<SessionUser, 'id'>;
export type Review = { id: string; movieId: number; title: string; rating: number; body: string | null; author: { username: string; displayName: string }; createdAt: string };
export type ListVisibility = { isPublic: boolean };
export type FeedReview = Review & { posterPath: string | null };

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3333';

export async function getSession(): Promise<SessionUser | null> {
  const response = await fetch(`${API_URL}/api/auth/session`, { credentials: 'include' });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error('Não foi possível consultar a sessão.');
  const payload = (await response.json()) as { data?: { user?: SessionUser } };
  return payload.data?.user ?? null;
}

export async function authenticate(mode: 'login' | 'register', input: { email: string; password: string; username?: string; displayName?: string }): Promise<void> {
  const response = await fetch(`${API_URL}/api/auth/${mode}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? 'Não foi possível entrar. Tente novamente.');
  }
}

export async function requestPasswordReset(email: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/auth/password-reset`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!response.ok) throw await errorFromResponse(response, 'Não foi possível solicitar a recuperação.');
}

export async function confirmPasswordReset(token: string, password: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/auth/password-reset/confirm`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, password }),
  });
  if (!response.ok) throw await errorFromResponse(response, 'Link de recuperação inválido ou expirado.');
}

export async function logout(): Promise<void> {
  const response = await fetch(`${API_URL}/api/auth/logout`, { method: 'POST', credentials: 'include' });
  if (!response.ok) throw new Error('Não foi possível encerrar a sessão.');
}

async function errorFromResponse(response: Response, fallback: string): Promise<Error> {
  const payload = (await response.json().catch(() => null)) as { error?: string } | null;
  return new Error(payload?.error ?? fallback);
}

export async function getMovies(filters: CatalogFilters, signal?: AbortSignal): Promise<MoviePage> {
  const url = new URL('/api/movies', API_URL);
  if (filters.query) url.searchParams.set('q', filters.query);
  if (filters.page > 1) url.searchParams.set('page', String(filters.page));
  if (filters.genreId !== undefined) url.searchParams.set('genre', String(filters.genreId));
  if (filters.year !== undefined) url.searchParams.set('year', String(filters.year));
  const response = await fetch(url, { signal });
  if (!response.ok) throw await errorFromResponse(response, 'Não foi possível carregar os filmes.');
  const payload = (await response.json()) as {
    data: Movie[];
    pagination: { page: number; totalPages: number; totalResults: number };
    meta: { catalogMode: CatalogMode };
  };
  return { items: payload.data, ...payload.pagination, catalogMode: payload.meta.catalogMode };
}

export async function getMovie(movieId: number): Promise<{ movie: MovieDetails; catalogMode: CatalogMode }> {
  const response = await fetch(`${API_URL}/api/movies/${movieId}`);
  if (!response.ok) throw await errorFromResponse(response, 'Não foi possível carregar os detalhes do filme.');
  const payload = (await response.json()) as { data: MovieDetails; meta: { catalogMode: CatalogMode } };
  return { movie: payload.data, catalogMode: payload.meta.catalogMode };
}

export async function getGenres(): Promise<{ genres: MovieGenre[]; catalogMode: CatalogMode }> {
  const response = await fetch(`${API_URL}/api/movies/genres`);
  if (!response.ok) throw await errorFromResponse(response, 'Não foi possível carregar os gêneros.');
  const payload = (await response.json()) as { data: MovieGenre[]; meta: { catalogMode: CatalogMode } };
  return { genres: payload.data, catalogMode: payload.meta.catalogMode };
}

export async function getMovieReviews(movieId: number): Promise<Review[]> {
  const response = await fetch(`${API_URL}/api/movies/${movieId}/reviews`);
  if (!response.ok) throw await errorFromResponse(response, 'Não foi possível carregar as resenhas.');
  const payload = (await response.json()) as { data: Review[] };
  return payload.data;
}

export async function getMyReview(movieId: number): Promise<Review | null> {
  const response = await fetch(`${API_URL}/api/movies/${movieId}/reviews/me`, { credentials: 'include' });
  if (!response.ok) throw await errorFromResponse(response, 'Não foi possível carregar sua resenha.');
  const payload = (await response.json()) as { data: Review | null };
  return payload.data;
}

export async function saveMyReview(review: { movieId: number; title: string; posterPath: string | null; rating: number; body: string | null }): Promise<Review> {
  const response = await fetch(`${API_URL}/api/movies/${review.movieId}/reviews/me`, {
    method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(review),
  });
  if (!response.ok) throw await errorFromResponse(response, 'Não foi possível salvar sua resenha.');
  const payload = (await response.json()) as { data: Review };
  return payload.data;
}

export async function removeMyReview(movieId: number): Promise<void> {
  const response = await fetch(`${API_URL}/api/movies/${movieId}/reviews/me`, { method: 'DELETE', credentials: 'include' });
  if (!response.ok) throw await errorFromResponse(response, 'Não foi possível remover sua resenha.');
}

export async function getMyInteractions(): Promise<MovieInteraction[]> {
  const response = await fetch(`${API_URL}/api/me/interactions`, { credentials: 'include' });
  if (!response.ok) throw await errorFromResponse(response, 'Não foi possível carregar sua lista.');
  const payload = (await response.json()) as { data: MovieInteraction[] };
  return payload.data;
}

export async function saveMyInteraction(interaction: {
  movieId: number;
  title: string;
  posterPath: string | null;
  status: InteractionStatus;
  isFavorite?: boolean;
}): Promise<MovieInteraction> {
  const response = await fetch(`${API_URL}/api/me/interactions/${interaction.movieId}`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(interaction),
  });
  if (!response.ok) throw await errorFromResponse(response, 'Não foi possível salvar o filme na lista.');
  const payload = (await response.json()) as { data: MovieInteraction };
  return payload.data;
}

export async function removeMyInteraction(movieId: number): Promise<void> {
  const response = await fetch(`${API_URL}/api/me/interactions/${movieId}`, { method: 'DELETE', credentials: 'include' });
  if (!response.ok) throw await errorFromResponse(response, 'Não foi possível remover o filme da lista.');
}

export async function getListVisibility(): Promise<ListVisibility> {
  const response = await fetch(`${API_URL}/api/me/list-visibility`, { credentials: 'include' });
  if (!response.ok) throw await errorFromResponse(response, 'Não foi possível consultar a privacidade da lista.');
  const payload = (await response.json()) as { data: ListVisibility };
  return payload.data;
}

export async function setListVisibility(isPublic: boolean): Promise<ListVisibility> {
  const response = await fetch(`${API_URL}/api/me/list-visibility`, {
    method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isPublic }),
  });
  if (!response.ok) throw await errorFromResponse(response, 'Não foi possível atualizar a privacidade da lista.');
  const payload = (await response.json()) as { data: ListVisibility };
  return payload.data;
}

export async function getPublicList(username: string): Promise<MovieInteraction[]> {
  const response = await fetch(`${API_URL}/api/users/${encodeURIComponent(username)}/list`);
  if (!response.ok) throw await errorFromResponse(response, 'Esta lista é privada ou não está disponível.');
  const payload = (await response.json()) as { data: MovieInteraction[] };
  return payload.data;
}

export async function getCommonMovies(username: string): Promise<MovieInteraction[]> {
  const response = await fetch(`${API_URL}/api/users/${encodeURIComponent(username)}/common`, { credentials: 'include' });
  if (!response.ok) throw await errorFromResponse(response, 'Não foi possível consultar os filmes em comum.');
  const payload = (await response.json()) as { data: MovieInteraction[] };
  return payload.data;
}

export async function getPublicProfile(username: string): Promise<PublicProfile> {
  const response = await fetch(`${API_URL}/api/users/${encodeURIComponent(username)}`);
  if (!response.ok) throw await errorFromResponse(response, 'Não foi possível carregar este perfil.');
  const payload = (await response.json()) as { data: PublicProfile };
  return payload.data;
}

export async function updateMyProfile(input: { username: string; displayName: string; bio: string | null }): Promise<PublicProfile> {
  const response = await fetch(`${API_URL}/api/users/me`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw await errorFromResponse(response, 'Não foi possível salvar seu perfil.');
  const payload = (await response.json()) as { data: { user: PublicProfile } };
  return payload.data.user;
}

export async function getFeed(): Promise<FeedReview[]> {
  const response = await fetch(`${API_URL}/api/feed`, { credentials: 'include' });
  if (!response.ok) throw await errorFromResponse(response, 'Não foi possível carregar o feed.');
  const payload = (await response.json()) as { data: FeedReview[] };
  return payload.data;
}
