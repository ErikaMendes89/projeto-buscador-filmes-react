import { afterEach, describe, expect, it, vi } from 'vitest';
import { confirmPasswordReset, getCommonMovies, getFeed, getFollowStatus, getListVisibility, getMovieReviews, getMyInteractions, getMyReview, getPublicList, getPublicProfile, removeMyInteraction, removeMyReview, requestPasswordReset, saveMyInteraction, saveMyReview, searchPeople, setFollowing, setListVisibility, updateMyProfile } from './api';

afterEach(() => vi.unstubAllGlobals());

describe('community feed API', () => {
  it('loads a requested feed page with its pagination metadata and session', async () => {
    const review = { id: 'review-1', movieId: 10, title: 'Filme', posterPath: null, rating: 4, body: null, author: { username: 'alice', displayName: 'Alice' }, createdAt: '2026-01-01' };
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => ({ ok: true, status: 200, json: async () => ({ data: [review], pagination: { page: 2, totalPages: 3, totalResults: 45 } }) }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(getFeed(2)).resolves.toEqual({ items: [review], page: 2, totalPages: 3, totalResults: 45 });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/feed?page=2');
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ credentials: 'include' });
  });
});

describe('movie interaction API', () => {
  it('reads the signed-in user list with session cookies', async () => {
    const items = [{ movieId: 10, title: 'Filme', posterPath: null, status: 'watched', isFavorite: true, rating: null }];
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ data: items }) }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(getMyInteractions()).resolves.toEqual(items);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/me/interactions'), { credentials: 'include' });
  });

  it('creates or changes one interaction and removes it through the same account-scoped resource', async () => {
    const saved = { movieId: 10, title: 'Filme', posterPath: null, status: 'watched', isFavorite: true, rating: null };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ data: saved }) })
      .mockResolvedValueOnce({ ok: true, status: 204 });
    vi.stubGlobal('fetch', fetchMock);

    await expect(saveMyInteraction({ movieId: 10, title: 'Filme', posterPath: null, status: 'watched', isFavorite: true })).resolves.toEqual(saved);
    const [saveUrl, saveOptions] = fetchMock.mock.calls[0]!;
    expect(String(saveUrl)).toContain('/api/me/interactions/10');
    expect(saveOptions).toMatchObject({ method: 'PUT', credentials: 'include' });
    expect(JSON.parse(String(saveOptions?.body))).toMatchObject({ status: 'watched', isFavorite: true });

    await expect(removeMyInteraction(10)).resolves.toBeUndefined();
    expect(fetchMock.mock.calls[1]).toEqual([expect.stringContaining('/api/me/interactions/10'), { method: 'DELETE', credentials: 'include' }]);
  });
});

describe('movie review API', () => {
  it('loads public reviews and the signed-in user review', async () => {
    const reviews = [{ id: 'review-1', movieId: 10, title: 'Filme', rating: 4, body: null, author: { username: 'alice', displayName: 'Alice' }, createdAt: '2026-01-01' }];
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ data: reviews }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ data: reviews[0] }) });
    vi.stubGlobal('fetch', fetchMock);

    await expect(getMovieReviews(10)).resolves.toEqual(reviews);
    await expect(getMyReview(10)).resolves.toEqual(reviews[0]);
    expect(fetchMock.mock.calls[1]).toEqual([expect.stringContaining('/api/movies/10/reviews/me'), { credentials: 'include' }]);
  });

  it('saves and removes the authenticated user review', async () => {
    const review = { id: 'review-1', movieId: 10, title: 'Filme', rating: 4.5, body: 'Ótimo', author: { username: 'alice', displayName: 'Alice' }, createdAt: '2026-01-01' };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ data: review }) })
      .mockResolvedValueOnce({ ok: true, status: 204 });
    vi.stubGlobal('fetch', fetchMock);

    await expect(saveMyReview({ movieId: 10, title: 'Filme', posterPath: null, rating: 4.5, body: 'Ótimo' })).resolves.toEqual(review);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: 'PUT', credentials: 'include' });
    await expect(removeMyReview(10)).resolves.toBeUndefined();
    expect(fetchMock.mock.calls[1]).toEqual([expect.stringContaining('/api/movies/10/reviews/me'), { method: 'DELETE', credentials: 'include' }]);
  });
});

describe('list visibility API', () => {
  it('loads and changes private-by-default visibility using the session', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ data: { isPublic: false } }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ data: { isPublic: true } }) });
    vi.stubGlobal('fetch', fetchMock);

    await expect(getListVisibility()).resolves.toEqual({ isPublic: false });
    await expect(setListVisibility(true)).resolves.toEqual({ isPublic: true });
    expect(fetchMock.mock.calls[0]).toEqual([expect.stringContaining('/api/me/list-visibility'), { credentials: 'include' }]);
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: 'PUT', credentials: 'include', body: '{"isPublic":true}' });
  });

  it('fetches a public list directly and requires an authenticated session for common movies', async () => {
    const items = [{ movieId: 10, title: 'Filme', posterPath: null, status: 'watched', isFavorite: false }];
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ data: items }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ data: items }) });
    vi.stubGlobal('fetch', fetchMock);

    await expect(getPublicList('alice')).resolves.toEqual(items);
    await expect(getCommonMovies('alice')).resolves.toEqual(items);
    expect(fetchMock.mock.calls[0]).toEqual([expect.stringContaining('/api/users/alice/list')]);
    expect(fetchMock.mock.calls[1]).toEqual([expect.stringContaining('/api/users/alice/common'), { credentials: 'include' }]);
  });
});

describe('profile API', () => {
  it('loads only public profile data and updates the current account with its session', async () => {
    const profile = { username: 'alice', displayName: 'Alice', bio: null, createdAt: '2026-01-01T00:00:00.000Z' };
    const updated = { ...profile, username: 'alice_2', displayName: 'Alice Example', bio: 'Filmes' };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ data: profile }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ data: { user: updated } }) });
    vi.stubGlobal('fetch', fetchMock);

    await expect(getPublicProfile('alice')).resolves.toEqual(profile);
    await expect(updateMyProfile({ username: 'alice_2', displayName: 'Alice Example', bio: 'Filmes' })).resolves.toEqual(updated);
    expect(fetchMock.mock.calls[0]).toEqual([expect.stringContaining('/api/users/alice')]);
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: 'PUT', credentials: 'include', body: JSON.stringify({ username: 'alice_2', displayName: 'Alice Example', bio: 'Filmes' }) });
  });

  it('searches paginated profiles and follows or unfollows by username with session cookies', async () => {
    const profiles = [{ username: 'alice', displayName: 'Alice', bio: null, createdAt: '2026-01-01T00:00:00.000Z' }];
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ data: profiles, pagination: { page: 2, totalPages: 3, totalResults: 45 } }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ data: { following: true } }) })
      .mockResolvedValueOnce({ ok: true, status: 204 })
      .mockResolvedValueOnce({ ok: true, status: 204 });
    vi.stubGlobal('fetch', fetchMock);

    await expect(searchPeople('ali', 2)).resolves.toEqual({ items: profiles, page: 2, totalPages: 3, totalResults: 45 });
    await expect(getFollowStatus('alice')).resolves.toEqual({ following: true });
    await expect(setFollowing('alice', false)).resolves.toBeUndefined();
    await expect(setFollowing('alice', true)).resolves.toBeUndefined();
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/users/search?q=ali&page=2');
    expect(fetchMock.mock.calls[1]).toEqual([expect.stringContaining('/api/users/by-username/alice/follow'), { credentials: 'include' }]);
    expect(fetchMock.mock.calls[2]?.[1]).toMatchObject({ method: 'DELETE', credentials: 'include' });
    expect(fetchMock.mock.calls[3]?.[1]).toMatchObject({ method: 'PUT', credentials: 'include' });
  });
});

describe('password recovery API', () => {
  it('requests a reset without putting the email in the URL and submits the token only to confirmation', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 202 })
      .mockResolvedValueOnce({ ok: true, status: 204 });
    vi.stubGlobal('fetch', fetchMock);
    const email = 'alice@example.com';
    const token = 'one-time-reset-token';

    await expect(requestPasswordReset(email)).resolves.toBeUndefined();
    await expect(confirmPasswordReset(token, 'a new secure password')).resolves.toBeUndefined();
    expect(fetchMock.mock.calls[0]?.[0]).toContain('/api/auth/password-reset');
    expect(fetchMock.mock.calls[0]?.[0]).not.toContain(email);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: 'POST', credentials: 'include', body: JSON.stringify({ email }) });
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: 'POST', credentials: 'include', body: JSON.stringify({ token, password: 'a new secure password' }) });
  });
});
