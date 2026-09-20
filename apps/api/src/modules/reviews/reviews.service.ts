import type { ReviewsRepository } from './reviews.repository.js';
import type { CreateReview } from './reviews.types.js';

export class ReviewsService {
  constructor(private readonly reviews: ReviewsRepository) {}

  listForMovie(movieId: number) {
    return this.reviews.listByMovie(movieId);
  }

  publish(userId: string, review: CreateReview) {
    return this.reviews.upsert(userId, review);
  }
}
