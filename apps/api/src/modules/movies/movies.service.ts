import type { InteractionsRepository } from './interactions.repository.js';
import type { MovieFilters, MovieInteractionInput } from './movies.types.js';
import type { TmdbClient } from './tmdb.client.js';

export class MoviesService {
  constructor(
    private readonly catalog: TmdbClient,
    private readonly interactions: InteractionsRepository,
  ) {}

  get catalogMode() {
    return this.catalog.mode;
  }

  discover(query: string | undefined, filters: MovieFilters) {
    return query ? this.catalog.search(query, filters) : this.catalog.discover(filters);
  }

  genres() {
    return this.catalog.genres();
  }

  getMovie(movieId: number) {
    return this.catalog.getMovie(movieId);
  }

  listInteractions(userId: string) {
    return this.interactions.listByUser(userId);
  }

  getListVisibility(userId: string) {
    return this.interactions.getListVisibility(userId);
  }

  setListVisibility(userId: string, isPublic: boolean) {
    return this.interactions.setListVisibility(userId, isPublic);
  }

  getPublicInteractions(username: string) {
    return this.interactions.listPublicByUsername(username);
  }

  getCommonInteractions(userId: string, username: string) {
    return this.interactions.listCommonWithPublicUser(userId, username);
  }

  saveInteraction(userId: string, interaction: MovieInteractionInput) {
    return this.interactions.upsert(userId, interaction);
  }

  removeInteraction(userId: string, movieId: number) {
    return this.interactions.remove(userId, movieId);
  }
}
