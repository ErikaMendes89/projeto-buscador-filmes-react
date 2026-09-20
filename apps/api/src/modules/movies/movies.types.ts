export type Movie = {
  id: number;
  title: string;
  overview: string;
  posterPath: string | null;
  releaseDate: string | null;
  rating: number;
};

export type InteractionStatus = 'want_to_watch' | 'watching' | 'watched' | 'abandoned' | 'favorite';

export type MovieInteraction = {
  movieId: number;
  title: string;
  posterPath: string | null;
  status: InteractionStatus;
  rating?: number | null;
};
