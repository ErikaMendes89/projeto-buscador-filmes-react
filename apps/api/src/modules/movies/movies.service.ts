import type { InteractionsRepository } from './interactions.repository.js';
import type { MovieInteraction } from './movies.types.js';
import type { TmdbClient } from './tmdb.client.js';

export class MoviesService {
  constructor(
    private readonly catalog: TmdbClient,
    private readonly interactions: InteractionsRepository,
  ) {}

  discover(query?: string) {
    return query ? this.catalog.search(query) : this.catalog.discover();
  }

  listInteractions(userId: string) {
    return this.interactions.listByUser(userId);
  }

  saveInteraction(userId: string, interaction: MovieInteraction) {
    return this.interactions.upsert(userId, interaction);
  }

  removeInteraction(userId: string, movieId: number) {
    return this.interactions.remove(userId, movieId);
  }
}
