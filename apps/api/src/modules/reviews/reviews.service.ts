import type { ReviewsRepository } from './reviews.repository.js';
import type { CreateReview } from './reviews.types.js';

export class ReviewsService {
  constructor(private readonly reviews: ReviewsRepository) {}

  listForMovie(movieId: number) {
    return this.reviews.listByMovie(movieId);
  }

  findMine(userId: string, movieId: number) {
    return this.reviews.findByUserAndMovie(userId, movieId);
  }

  publish(userId: string, review: CreateReview) {
    return this.reviews.upsert(userId, review);
  }

  removeMine(userId: string, movieId: number) {
    return this.reviews.remove(userId, movieId);
  }
}
