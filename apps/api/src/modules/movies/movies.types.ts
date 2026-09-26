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

export type MoviePage = {
  items: Movie[];
  page: number;
  totalPages: number;
  totalResults: number;
};

export type MovieFilters = { page: number; genreId?: number; year?: number };

export type InteractionStatus = 'want_to_watch' | 'watching' | 'watched' | 'abandoned';

export type MovieInteraction = {
  movieId: number;
  title: string;
  posterPath: string | null;
  status: InteractionStatus;
  isFavorite: boolean;
  rating?: number | null;
};

export type MovieInteractionInput = Omit<MovieInteraction, 'isFavorite'> & { isFavorite?: boolean };
