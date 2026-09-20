export type Review = {
  id: string;
  movieId: number;
  title: string;
  rating: number;
  body: string | null;
  author: { username: string; displayName: string };
  createdAt: Date;
};

export type CreateReview = {
  movieId: number;
  title: string;
  posterPath: string | null;
  rating: number;
  body: string | null;
};
