import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';

const signedInUser = { id: 'user-1', username: 'alice', displayName: 'Alice', bio: null, createdAt: '2026-01-01T00:00:00.000Z' };

function mockMyList(initialItems: { movieId: number; title: string; posterPath: null; status: string; isFavorite: boolean; rating: null }[]) {
  let items = [...initialItems];
  const jsonResponse = (data: unknown, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => data }) as Response;
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('/api/auth/session')) return jsonResponse({ data: { user: signedInUser } });
    if (!url.includes('/api/me/interactions')) return jsonResponse({ data: [] });
    const method = init?.method ?? 'GET';
    if (method === 'GET') return jsonResponse({ data: items });
    const movieId = Number(url.split('/').at(-1));
    if (method === 'PUT') {
      const update = JSON.parse(String(init?.body)) as { title: string; posterPath: null; status: string; isFavorite?: boolean };
      const existing = items.find((item) => item.movieId === movieId);
      const updated = { movieId, ...update, isFavorite: update.isFavorite ?? existing?.isFavorite ?? false, rating: null };
      items = existing ? items.map((item) => item.movieId === movieId ? updated : item) : [...items, updated];
      return jsonResponse({ data: updated });
    }
    items = items.filter((item) => item.movieId !== movieId);
    return { ok: true, status: 204, json: async () => null } as Response;
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function renderApp() {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><App /></QueryClientProvider>);
}

describe('MovieMatch home', () => {
  beforeEach(() => {
    cleanup();
    window.history.replaceState(null, '', '/');
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/auth/session')) return { ok: false, status: 401, json: async () => ({}) };
      if (url.includes('/api/movies/genres')) return { ok: true, status: 200, json: async () => ({ data: [{ id: 878, name: 'Ficção científica' }], meta: { catalogMode: 'demo' } }) };
      if (url.includes('/api/movies/157336/reviews')) return { ok: true, status: 200, json: async () => ({ data: [] }) };
      if (/\/api\/movies\/\d+$/.test(url)) return { ok: true, status: 200, json: async () => ({ data: { id: 157336, title: 'Interestelar', overview: 'Uma viagem espacial.', posterPath: '/poster.jpg', releaseDate: '2014-11-05', rating: 8.5, genreIds: [878], genres: [{ id: 878, name: 'Ficção científica' }] }, meta: { catalogMode: 'demo' } }) };
      return { ok: true, status: 200, json: async () => ({ data: [{ id: 157336, title: 'Interestelar', overview: 'Uma viagem espacial.', posterPath: null, releaseDate: '2014-11-05', rating: 8.5, genreIds: [878] }], pagination: { page: 1, totalPages: 2, totalResults: 21 }, meta: { catalogMode: 'demo' } }) };
    }));
  });

  it('communicates the social movie proposition', async () => {
    render(<QueryClientProvider client={new QueryClient()}><App /></QueryClientProvider>);
    expect(screen.getByRole('heading', { name: /filmes ficam melhores/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /buscar filmes/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /comunidade/i })).toHaveAttribute('href', '/community');
    expect(screen.getByRole('link', { name: /chat/i })).toHaveAttribute('href', '/chat');
    expect(await screen.findByText(/modo demonstrativo/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /ver detalhes de interestelar/i })).toHaveAttribute('href', '/movies/157336');
  });

  it('opens the login form and submits credentials with cookies enabled', async () => {
    const fetchMock = vi.mocked(fetch);
    render(<QueryClientProvider client={new QueryClient()}><App /></QueryClientProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('E-mail'), { target: { value: 'alice@example.com' } });
    fireEvent.change(within(dialog).getByLabelText('Senha'), { target: { value: 'correct-password' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Entrar' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/auth/login'), expect.objectContaining({ credentials: 'include', method: 'POST' })));
  });

  it('shows a generic notice after requesting account creation and returns to login', async () => {
    const fetchMock = vi.mocked(fetch);
    renderApp();
    fireEvent.click(await screen.findByRole('button', { name: 'Entrar' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cadastre-se' }));
    fireEvent.change(within(dialog).getByLabelText('Nome'), { target: { value: 'Alice' } });
    fireEvent.change(within(dialog).getByLabelText('Username'), { target: { value: 'alice_1' } });
    fireEvent.change(within(dialog).getByLabelText('E-mail'), { target: { value: 'alice@example.com' } });
    fireEvent.change(within(dialog).getByLabelText('Senha'), { target: { value: 'a long secure password' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Criar conta' }));

    expect(await screen.findByText(/se os dados permitirem/i)).toHaveAttribute('role', 'status');
    expect(within(dialog).getByRole('heading', { name: 'Que bom ter você de volta' })).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/auth/register'), expect.objectContaining({ credentials: 'include', method: 'POST' })));
    expect(fetchMock.mock.calls.filter(([input]) => String(input).includes('/api/auth/session'))).toHaveLength(1);
  });

  it('requests password recovery without exposing whether the email exists', async () => {
    const fetchMock = vi.mocked(fetch);
    renderApp();
    fireEvent.click(await screen.findByRole('button', { name: 'Entrar' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Esqueceu a senha?' }));
    expect(within(dialog).getByRole('heading', { name: 'Recuperar senha' })).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText('E-mail'), { target: { value: 'alice@example.com' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Enviar instruções' }));

    expect(await screen.findByText(/se houver uma conta para este e-mail/i)).toBeInTheDocument();
    expect(within(dialog).getByRole('heading', { name: 'Que bom ter você de volta' })).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/auth/password-reset'), expect.objectContaining({ method: 'POST', credentials: 'include' })));
  });

  it('consumes a reset link from the URL fragment without displaying the token', async () => {
    const resetToken = 'one-time-reset-token-which-is-not-rendered';
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes('/api/auth/password-reset/confirm') && init?.method === 'POST') return { ok: true, status: 204 } as Response;
      if (String(input).includes('/api/auth/session')) return { ok: false, status: 401, json: async () => ({}) } as Response;
      return { ok: true, status: 200, json: async () => ({ data: [] }) } as Response;
    });
    vi.stubGlobal('fetch', fetchMock);
    window.history.replaceState(null, '', `/reset-password#token=${resetToken}`);
    renderApp();

    fireEvent.change(await screen.findByLabelText('Nova senha'), { target: { value: 'a new secure password' } });
    fireEvent.change(screen.getByLabelText('Confirme a nova senha'), { target: { value: 'a new secure password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar senha' }));

    expect(await screen.findByRole('heading', { name: 'Senha atualizada' })).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(resetToken);
    expect(window.location.hash).toBe('');
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/auth/password-reset/confirm'), expect.objectContaining({ method: 'POST', body: JSON.stringify({ token: resetToken, password: 'a new secure password' }) }));
  });

  it('persists discovery filters and pagination in the URL', async () => {
    const fetchMock = vi.mocked(fetch);
    render(<QueryClientProvider client={new QueryClient()}><App /></QueryClientProvider>);
    await screen.findByRole('option', { name: 'Ficção científica' });
    fireEvent.change(screen.getByLabelText('Filtrar por gênero'), { target: { value: '878' } });
    fireEvent.change(screen.getByLabelText('Filtrar por ano'), { target: { value: '2014' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    await waitFor(() => expect(window.location.search).toContain('genre=878'));
    expect(window.location.search).toContain('year=2014');
    await waitFor(() => expect(fetchMock.mock.calls.some(([input]) => String(input).includes('genre=878') && String(input).includes('year=2014'))).toBe(true));

    fireEvent.click(screen.getByRole('button', { name: /próxima/i }));
    await waitFor(() => expect(window.location.search).toContain('page=2'));

    fireEvent.change(screen.getByRole('textbox', { name: 'Buscar filmes' }), { target: { value: 'Interestelar' } });
    fireEvent.change(screen.getByLabelText('Filtrar por ano'), { target: { value: '2014' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    await waitFor(() => expect(window.location.search).toContain('q=Interestelar'));
    expect(window.location.search).toContain('year=2014');
    expect(window.location.search).not.toContain('genre=');
    await waitFor(() => expect(fetchMock.mock.calls.some(([input]) => String(input).includes('q=Interestelar') && String(input).includes('year=2014'))).toBe(true));
  });

  it('opens movie details directly and identifies the catalog rating', async () => {
    const priorClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    window.history.replaceState(null, '', '/movies/157336');
    render(<QueryClientProvider client={new QueryClient()}><App /></QueryClientProvider>);
    expect(await screen.findByRole('heading', { name: 'Interestelar' })).toBeInTheDocument();
    expect(screen.getByText(/nota TMDB: 8.5/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /compartilhar/i })).toBeInTheDocument();
    fireEvent.error(screen.getByRole('img', { name: 'Pôster de Interestelar' }));
    expect(screen.getByRole('img', { name: 'Pôster indisponível para Interestelar' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /quero assistir/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /compartilhar/i }));
    expect(await screen.findByRole('status')).toHaveTextContent('Link copiado.');
    expect(writeText).toHaveBeenCalledWith(window.location.href);
    window.history.replaceState(null, '', '/');
    if (priorClipboard) Object.defineProperty(navigator, 'clipboard', priorClipboard);
    else Reflect.deleteProperty(navigator, 'clipboard');
  });

  it('navigates from a direct movie link, supports back links, and responds to browser history', async () => {
    window.history.replaceState(null, '', '/movies/157336');
    renderApp();

    expect(await screen.findByRole('heading', { name: 'Interestelar' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: /voltar para descoberta/i }));
    expect(await screen.findByRole('heading', { name: /filmes ficam melhores/i })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/');

    window.history.pushState(null, '', '/chat');
    fireEvent(window, new PopStateEvent('popstate'));
    expect(await screen.findByRole('heading', { name: 'Chat' })).toBeInTheDocument();
  });

  it('opens community, profile, and login pages from direct URLs', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/auth/session')) return { ok: false, status: 401, json: async () => ({}) } as Response;
      if (url.includes('/api/users/alice/list')) return { ok: true, status: 200, json: async () => ({ data: [] }) } as Response;
      if (url.includes('/api/users/alice')) return { ok: true, status: 200, json: async () => ({ data: { id: 'user-2', username: 'alice', displayName: 'Alice', bio: 'Filmes e conversa.', createdAt: '2026-01-01' } }) } as Response;
      return { ok: true, status: 200, json: async () => ({ data: [] }) } as Response;
    });
    vi.stubGlobal('fetch', fetchMock);

    window.history.replaceState(null, '', '/community');
    const view = renderApp();
    expect(await screen.findByRole('heading', { name: 'Comunidade' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Entre para ver seu feed' })).toBeInTheDocument();
    view.unmount();

    window.history.replaceState(null, '', '/users/alice');
    renderApp();
    expect(await screen.findByRole('heading', { name: 'Alice' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /ver lista pública/i })).toBeInTheDocument();
    cleanup();

    window.history.replaceState(null, '', '/login');
    renderApp();
    expect(await screen.findByRole('heading', { name: 'Entre para continuar' })).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('lets the signed-in profile owner edit their name, username, and bio', async () => {
    const updatedProfile = { username: 'alice_2', displayName: 'Alice Example', bio: 'Filmes favoritos', createdAt: signedInUser.createdAt };
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/auth/session')) return { ok: true, status: 200, json: async () => ({ data: { user: signedInUser } }) } as Response;
      if (url.includes('/api/users/me') && init?.method === 'PUT') return { ok: true, status: 200, json: async () => ({ data: { user: updatedProfile } }) } as Response;
      if (url.includes('/api/users/alice_2')) return { ok: true, status: 200, json: async () => ({ data: updatedProfile }) } as Response;
      if (url.includes('/api/users/alice/list') || url.includes('/api/users/alice_2/list')) return { ok: true, status: 200, json: async () => ({ data: [] }) } as Response;
      if (url.includes('/api/users/alice')) return { ok: true, status: 200, json: async () => ({ data: { username: 'alice', displayName: 'Alice', bio: 'Original', createdAt: signedInUser.createdAt } }) } as Response;
      return { ok: true, status: 200, json: async () => ({ data: [] }) } as Response;
    });
    vi.stubGlobal('fetch', fetchMock);
    window.history.replaceState(null, '', '/users/alice');
    renderApp();

    fireEvent.click(await screen.findByRole('button', { name: 'Editar perfil' }));
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Alice Example' } });
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'alice_2' } });
    fireEvent.change(screen.getByLabelText('Bio'), { target: { value: 'Filmes favoritos' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar perfil' }));

    expect(await screen.findByRole('heading', { name: 'Alice Example' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/users/alice_2');
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/users/me'), expect.objectContaining({ method: 'PUT', credentials: 'include' }));
    expect(JSON.parse(String(fetchMock.mock.calls.find(([input, init]) => String(input).includes('/api/users/me') && init?.method === 'PUT')?.[1]?.body))).toEqual({ username: 'alice_2', displayName: 'Alice Example', bio: 'Filmes favoritos' });
  });

  it('creates, edits, and removes the signed-in user movie review', async () => {
    window.history.replaceState(null, '', '/movies/157336');
    let savedReview: { id: string; movieId: number; title: string; rating: number; body: string | null; author: typeof signedInUser; createdAt: string } | null = null;
    const movie = { id: 157336, title: 'Interestelar', overview: 'Uma viagem espacial.', posterPath: null, releaseDate: '2014-11-05', rating: 8.5, genreIds: [878], genres: [{ id: 878, name: 'Ficção científica' }] };
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const jsonResponse = (data: unknown) => ({ ok: true, status: 200, json: async () => data }) as Response;
      if (url.includes('/api/auth/session')) return jsonResponse({ data: { user: signedInUser } });
      if (url.endsWith('/api/movies/157336')) return jsonResponse({ data: movie, meta: { catalogMode: 'demo' } });
      if (url.endsWith('/api/movies/157336/reviews/me')) {
        if (init?.method === 'PUT') {
          const inputReview = JSON.parse(String(init.body)) as { title: string; rating: number; body: string | null };
          savedReview = { id: 'review-1', movieId: 157336, ...inputReview, author: signedInUser, createdAt: '2026-01-01' };
          return jsonResponse({ data: savedReview });
        }
        if (init?.method === 'DELETE') { savedReview = null; return { ok: true, status: 204 } as Response; }
        return jsonResponse({ data: savedReview });
      }
      if (url.endsWith('/api/movies/157336/reviews')) return jsonResponse({ data: savedReview ? [savedReview] : [] });
      return jsonResponse({ data: [] });
    }));

    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><App /></QueryClientProvider>);
    expect(await screen.findByRole('heading', { name: 'Escreva sua resenha' })).toBeInTheDocument();
    expect(screen.getByText(/Ao publicar, sua nota e o texto ficam públicos na página do filme/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Nota (0,5 a 5)'), { target: { value: '4.5' } });
    fireEvent.change(screen.getByLabelText(/Texto da resenha/), { target: { value: 'Uma ótima história.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Publicar resenha' }));
    expect(await screen.findByText('Uma ótima história.')).toBeInTheDocument();
    expect(screen.getByText('★ 4.5 / 5')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Texto da resenha/), { target: { value: 'Uma história excelente.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));
    expect(await screen.findByText('Uma história excelente.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Remover resenha' }));
    expect(await screen.findByRole('heading', { name: 'Escreva sua resenha' })).toBeInTheDocument();
    expect(screen.getByText('Ainda não há resenhas para este filme.')).toBeInTheDocument();
  });

  it('shows the signed-in list and filters by status and favorites', async () => {
    const items = [
      { movieId: 10, title: 'Aguardando', posterPath: null, status: 'want_to_watch', isFavorite: false, rating: null },
      { movieId: 20, title: 'Favorito assistido', posterPath: null, status: 'watched', isFavorite: true, rating: null },
      { movieId: 30, title: 'Em andamento', posterPath: null, status: 'watching', isFavorite: false, rating: null },
    ];
    const fetchMock = mockMyList(items);
    window.history.replaceState(null, '', '/my-list');
    renderApp();

    expect(await screen.findByRole('heading', { name: 'Minha lista' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Ver detalhes de Aguardando' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver detalhes de Favorito assistido' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver detalhes de Em andamento' })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/me/interactions'), { credentials: 'include' });

    fireEvent.change(screen.getByLabelText('Filtrar por status'), { target: { value: 'watched' } });
    expect(screen.queryByRole('link', { name: 'Ver detalhes de Aguardando' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver detalhes de Favorito assistido' })).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Somente favoritos'));
    expect(screen.getByRole('link', { name: 'Ver detalhes de Favorito assistido' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Ver detalhes de Em andamento' })).not.toBeInTheDocument();
  });

  it('changes status/favorite and removes an item, refreshing the list after each operation', async () => {
    const fetchMock = mockMyList([{ movieId: 10, title: 'Interestelar', posterPath: null, status: 'want_to_watch', isFavorite: false, rating: null }]);
    window.history.replaceState(null, '', '/my-list');
    renderApp();
    await screen.findByRole('link', { name: 'Ver detalhes de Interestelar' });

    fireEvent.change(screen.getByLabelText('Status de Interestelar'), { target: { value: 'watched' } });
    await waitFor(() => expect(screen.getByLabelText('Status de Interestelar')).toHaveValue('watched'));
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar Interestelar aos favoritos' }));
    await screen.findByRole('button', { name: 'Remover Interestelar dos favoritos' });
    fireEvent.click(screen.getByRole('button', { name: 'Remover Interestelar da lista' }));
    await waitFor(() => expect(screen.queryByRole('link', { name: 'Ver detalhes de Interestelar' })).not.toBeInTheDocument());
    expect(fetchMock.mock.calls.map(([, init]) => init?.method ?? 'GET')).toContain('PUT');
    expect(fetchMock.mock.calls.map(([, init]) => init?.method)).toContain('DELETE');
  });

  it('keeps cached data unchanged after a failed mutation and retries it explicitly', async () => {
    let isFavorite = false;
    let saveAttempts = 0;
    const jsonResponse = (data: unknown, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => data }) as Response;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/auth/session')) return jsonResponse({ data: { user: signedInUser } });
      if (!url.includes('/api/me/interactions')) return jsonResponse({ data: [] });
      if (!init?.method || init.method === 'GET') return jsonResponse({ data: [{ movieId: 10, title: 'Interestelar', posterPath: null, status: 'want_to_watch', isFavorite, rating: null }] });
      if (init.method === 'PUT') {
        saveAttempts += 1;
        if (saveAttempts === 1) return jsonResponse({ error: 'Falha temporária' }, 503);
        isFavorite = JSON.parse(String(init.body)).isFavorite as boolean;
        return jsonResponse({ data: { movieId: 10, title: 'Interestelar', posterPath: null, status: 'want_to_watch', isFavorite, rating: null } });
      }
      return { ok: true, status: 204, json: async () => null } as Response;
    });
    vi.stubGlobal('fetch', fetchMock);
    window.history.replaceState(null, '', '/my-list');
    renderApp();
    await screen.findByRole('button', { name: 'Adicionar Interestelar aos favoritos' });

    fireEvent.click(screen.getByRole('button', { name: 'Adicionar Interestelar aos favoritos' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível atualizar esse filme');
    expect(screen.getByRole('button', { name: 'Adicionar Interestelar aos favoritos' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(await screen.findByRole('button', { name: 'Remover Interestelar dos favoritos' })).toBeInTheDocument();
    expect(saveAttempts).toBe(2);
  });

  it('shows empty, loading, and retryable error states on the list page', async () => {
    window.history.replaceState(null, '', '/my-list');
    mockMyList([]);
    const emptyView = renderApp();
    expect(await screen.findByText('Sua lista ainda está vazia')).toBeInTheDocument();
    emptyView.unmount();

    const pendingResolvers: { url: string; resolve: (response: Response) => void }[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes('/api/auth/session')) return { ok: true, status: 200, json: async () => ({ data: { user: signedInUser } }) } as Response;
      return await new Promise<Response>((resolve) => { pendingResolvers.push({ url: String(input), resolve }); });
    });
    vi.stubGlobal('fetch', fetchMock);
    const loadingView = renderApp();
    expect(await screen.findByText(/Carregando sua lista/)).toBeInTheDocument();
    const listRequest = pendingResolvers.find(({ url }) => url.includes('/api/me/interactions'))!;
    listRequest.resolve({ ok: false, status: 503, json: async () => ({ error: 'Falha na lista' }) } as Response);
    expect(await screen.findByRole('alert')).toHaveTextContent('Falha na lista');
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    await waitFor(() => expect(pendingResolvers.filter(({ url }) => url.includes('/api/me/interactions'))).toHaveLength(2));
    pendingResolvers.filter(({ url }) => url.includes('/api/me/interactions'))[1]!.resolve({ ok: true, status: 200, json: async () => ({ data: [] }) } as Response);
    expect(await screen.findByText('Sua lista ainda está vazia')).toBeInTheDocument();
    loadingView.unmount();
  });

  it('prompts visitors to sign in before loading a private list', async () => {
    window.history.replaceState(null, '', '/my-list');
    renderApp();
    expect(await screen.findByRole('heading', { name: 'Entre para acessar sua lista' })).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Acesso à lista' })).getByRole('button', { name: 'Entrar' })).toBeInTheDocument();
    expect(vi.mocked(fetch).mock.calls.some(([input]) => String(input).includes('/api/me/interactions'))).toBe(false);
  });

  it('publishes the list only by explicit choice and displays its share link', async () => {
    let isPublic = false;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const jsonResponse = (data: unknown) => ({ ok: true, status: 200, json: async () => data }) as Response;
      if (url.includes('/api/auth/session')) return jsonResponse({ data: { user: signedInUser } });
      if (url.includes('/api/me/list-visibility')) {
        if (init?.method === 'PUT') isPublic = (JSON.parse(String(init.body)) as { isPublic: boolean }).isPublic;
        return jsonResponse({ data: { isPublic } });
      }
      if (url.includes('/api/me/interactions')) return jsonResponse({ data: [] });
      return jsonResponse({ data: [] });
    });
    vi.stubGlobal('fetch', fetchMock);
    window.history.replaceState(null, '', '/my-list');
    renderApp();

    const makePublic = await screen.findByRole('button', { name: 'Tornar pública' });
    await waitFor(() => expect(makePublic).toBeEnabled());
    expect(screen.getByText('Privada: somente você pode ver seus filmes.')).toBeInTheDocument();
    fireEvent.click(makePublic);
    expect(await screen.findByText('Pública: qualquer pessoa com o link pode ver seus filmes, status e favoritos.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Abrir lista pública' })).toHaveAttribute('href', '/users/alice/list');
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/me/list-visibility'), expect.objectContaining({ method: 'PUT', body: '{"isPublic":true}' }));
  });

  it('opens a public list by direct link without exposing a private list to visitors', async () => {
    const item = { movieId: 10, title: 'Filme compartilhado', posterPath: null, status: 'watched', isFavorite: false };
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/auth/session')) return { ok: false, status: 401, json: async () => ({}) } as Response;
      if (url.includes('/api/users/alice/list')) return { ok: true, status: 200, json: async () => ({ data: [item] }) } as Response;
      return { ok: false, status: 404, json: async () => ({ error: 'Lista não encontrada' }) } as Response;
    });
    vi.stubGlobal('fetch', fetchMock);
    window.history.replaceState(null, '', '/users/alice/list');
    renderApp();

    expect(await screen.findByRole('heading', { name: 'Lista de @alice' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Ver detalhes de Filme compartilhado' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ver filmes em comum' })).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/users/alice/list'));
  });

  it('loads films in common only after an authenticated viewer requests them', async () => {
    const item = { movieId: 10, title: 'Filme compartilhado', posterPath: null, status: 'watched', isFavorite: false };
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/auth/session')) return { ok: true, status: 200, json: async () => ({ data: { user: signedInUser } }) } as Response;
      if (url.includes('/api/users/alice/list')) return { ok: true, status: 200, json: async () => ({ data: [item] }) } as Response;
      if (url.includes('/api/users/alice/common')) return { ok: true, status: 200, json: async () => ({ data: [item] }) } as Response;
      return { ok: false, status: 404, json: async () => ({ error: 'Não encontrado' }) } as Response;
    });
    vi.stubGlobal('fetch', fetchMock);
    window.history.replaceState(null, '', '/users/alice/list');
    renderApp();

    const commonButton = await screen.findByRole('button', { name: 'Ver filmes em comum' });
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes('/api/users/alice/common'))).toBe(false);
    fireEvent.click(commonButton);
    expect(await screen.findByText('1 filme em comum.')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/users/alice/common'), { credentials: 'include' });
  });
});
