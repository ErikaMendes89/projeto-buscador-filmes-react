import { describe, expect, it, vi } from 'vitest';
import { AppError } from '../../shared/errors.js';
import { TmdbClient } from './tmdb.client.js';

const tmdbPage = {
  page: 2,
  total_pages: 4,
  total_results: 73,
  results: [{ id: 22, title: 'Filme real', overview: 'Sinopse', poster_path: null, release_date: '2020-05-01', vote_average: 7.4, genre_ids: [878] }],
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('TmdbClient', () => {
  it('uses demo data locally and applies genre, year, title, and pagination filters', async () => {
    const client = new TmdbClient(undefined);
    const genreYear = await client.discover({ page: 1, genreId: 878, year: 2014 });
    expect(client.mode).toBe('demo');
    expect(genreYear.items.map(({ title }) => title)).toEqual(['Interestelar']);
    expect((await client.search('duna', { page: 1 })).items[0]?.title).toBe('Duna: Parte Dois');
    expect((await client.search('inexistente', { page: 1 })).totalResults).toBe(0);
    expect(await client.getMovie(157336)).toMatchObject({ title: 'Interestelar', genres: [{ name: 'Aventura' }, { name: 'Drama' }, { name: 'Ficção científica' }] });
    await expect(client.getMovie(9)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('uses TMDB pagination, search and discover filters through the backend token', async () => {
    const fetcher = vi.fn(async () => jsonResponse(tmdbPage)) as unknown as typeof fetch;
    const client = new TmdbClient('test-token', fetcher);
    const result = await client.discover({ page: 2, genreId: 878, year: 2020 });
    expect(result).toMatchObject({ page: 2, totalPages: 4, totalResults: 73, items: [{ id: 22, genreIds: [878], posterPath: null }] });
    const [input, init] = vi.mocked(fetcher).mock.calls[0]!;
    const url = new URL(String(input));
    expect(url.pathname).toBe('/3/discover/movie');
    expect(url.searchParams.get('with_genres')).toBe('878');
    expect(url.searchParams.get('primary_release_year')).toBe('2020');
    expect(url.searchParams.get('page')).toBe('2');
    expect(new Headers(init?.headers).get('authorization')).toBe('Bearer test-token');
    expect(init?.signal).toBeInstanceOf(AbortSignal);

    await client.search('arrival', { page: 3, year: 2016 });
    const searchUrl = new URL(String(vi.mocked(fetcher).mock.calls[1]![0]));
    expect(searchUrl.pathname).toBe('/3/search/movie');
    expect(searchUrl.searchParams.get('query')).toBe('arrival');
    expect(searchUrl.searchParams.get('page')).toBe('3');
    expect(searchUrl.searchParams.get('primary_release_year')).toBe('2016');
  });

  it('maps TMDB genres and detail fields and keeps catalog endpoints distinct on 404', async () => {
    const genreFetch = vi.fn(async () => jsonResponse({ genres: [{ id: 18, name: 'Drama' }] })) as unknown as typeof fetch;
    expect(await new TmdbClient('test-token', genreFetch).genres()).toEqual([{ id: 18, name: 'Drama' }]);

    const detailFetch = vi.fn(async () => jsonResponse({
      id: 44, title: 'Detalhe', overview: 'Sinopse completa', poster_path: '/poster.jpg', release_date: '2019-08-01', vote_average: 8.1,
      genres: [{ id: 18, name: 'Drama' }],
    })) as unknown as typeof fetch;
    const movie = await new TmdbClient('test-token', detailFetch).getMovie(44);
    expect(movie).toMatchObject({ title: 'Detalhe', rating: 8.1, posterPath: '/poster.jpg', genreIds: [18], genres: [{ name: 'Drama' }] });

    const notFoundFetch = vi.fn(async () => jsonResponse({}, 404)) as unknown as typeof fetch;
    await expect(new TmdbClient('test-token', notFoundFetch).getMovie(44)).rejects.toMatchObject({ statusCode: 404, message: 'Filme não encontrado' });
    await expect(new TmdbClient('test-token', notFoundFetch).genres()).rejects.toMatchObject({ statusCode: 503, code: 'catalog_unavailable' });
  });

  it('maps provider errors, malformed responses and timeouts to a safe catalog error', async () => {
    const unavailableFetch = vi.fn(async () => jsonResponse({}, 429)) as unknown as typeof fetch;
    await expect(new TmdbClient('test-token', unavailableFetch).discover({ page: 1 })).rejects.toMatchObject({ statusCode: 503, code: 'catalog_unavailable' });

    const malformedFetch = vi.fn(async () => jsonResponse({ results: 'not-an-array' })) as unknown as typeof fetch;
    await expect(new TmdbClient('test-token', malformedFetch).discover({ page: 1 })).rejects.toMatchObject({ statusCode: 503, code: 'catalog_unavailable' });

    const timeoutFetch = vi.fn(async () => { throw new DOMException('timeout', 'TimeoutError'); }) as unknown as typeof fetch;
    await expect(new TmdbClient('test-token', timeoutFetch).search('film', { page: 1 })).rejects.toBeInstanceOf(AppError);
  });
});
