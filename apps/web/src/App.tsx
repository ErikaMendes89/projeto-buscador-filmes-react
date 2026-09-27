import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, BookmarkPlus, ChevronLeft, ChevronRight, Compass, Heart, ListVideo, MessageCircle, Search, Share2, Sparkles, Trash2, UserRound, Users, X } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { authenticate, confirmPasswordReset, getCommonMovies, getFeed, getFollowStatus, getGenres, getListVisibility, getMovie, getMovieReviews, getMovies, getMyInteractions, getMyReview, getPublicList, getPublicProfile, getSession, logout, removeMyInteraction, removeMyReview, requestPasswordReset, saveMyInteraction, saveMyReview, searchPeople, setFollowing, setListVisibility, updateMyProfile, type CatalogFilters, type InteractionStatus, type Movie, type MovieInteraction, type PublicProfile, type Review, type SessionUser } from './api';

type AuthMode = 'login' | 'register' | 'request-reset';

function navigateTo(path: string, replace = false) {
  if (replace) window.history.replaceState(null, '', path);
  else window.history.pushState(null, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function safeReturnPath(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/my-list';
  const destination = new URL(value, window.location.origin);
  if (destination.origin !== window.location.origin || ['/login', '/reset-password'].includes(destination.pathname.replace(/\/$/, ''))) return '/my-list';
  return `${destination.pathname}${destination.search}${destination.hash}`;
}

function loginPathForCurrentPage(): string {
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  const returnTo = safeReturnPath(current);
  return `/login?returnTo=${encodeURIComponent(returnTo)}`;
}

function writeCommunitySearch(query: string, page: number) {
  const params = new URLSearchParams(window.location.search);
  params.delete('q');
  params.delete('page');
  if (query) params.set('q', query);
  if (page > 1) params.set('page', String(page));
  const search = params.toString();
  window.history.pushState(null, '', `/community${search ? `?${search}` : ''}`);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function writeCommunityFeedPage(page: number) {
  const params = new URLSearchParams(window.location.search);
  if (page > 1) params.set('feedPage', String(page));
  else params.delete('feedPage');
  const search = params.toString();
  window.history.pushState(null, '', `/community${search ? `?${search}` : ''}`);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function AuthDialog({ mode, onModeChange, onClose, onAuthenticated }: {
  mode: AuthMode;
  onModeChange: (mode: AuthMode) => void;
  onClose: () => void;
  onAuthenticated: () => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const auth = useMutation({
    mutationFn: () => mode === 'request-reset' ? requestPasswordReset(email) : authenticate(mode, { email, password, username, displayName }),
    onSuccess: () => {
      if (mode === 'register') {
        setAuthNotice('Se os dados permitirem, o cadastro estará disponível para entrar. Se você já tem uma conta, entre com sua senha.');
        onModeChange('login');
        return;
      }
      if (mode === 'request-reset') {
        setAuthNotice('Se houver uma conta para este e-mail, enviaremos instruções de recuperação.');
        onModeChange('login');
        return;
      }
      onAuthenticated();
    },
  });

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <button className="dialog-close" type="button" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
        <p className="eyebrow">MOVIEMATCH</p>
        <h2 id="auth-title">{mode === 'login' ? 'Que bom ter você de volta' : mode === 'register' ? 'Crie sua conta' : 'Recuperar senha'}</h2>
        {authNotice && <p className="auth-success" role="status">{authNotice}</p>}
        <form onSubmit={(event) => { event.preventDefault(); auth.mutate(); }}>
          {mode === 'register' && <>
            <label>Nome<input autoComplete="name" required maxLength={100} value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label>
            <label>Username<input autoComplete="username" required minLength={3} maxLength={40} pattern="[A-Za-z0-9_]+" value={username} onChange={(event) => setUsername(event.target.value)} /></label>
          </>}
          <label>E-mail<input type="email" autoComplete="email" required maxLength={320} value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          {mode !== 'request-reset' && <label>Senha<input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={mode === 'register' ? 12 : 1} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} /></label>}
          {mode === 'register' && <p className="auth-hint">Use uma senha com pelo menos 12 caracteres e username de 3 a 40 letras, números ou _.</p>}
          {auth.isError && <p className="auth-error" role="alert">{auth.error.message}</p>}
          <button className="auth-submit" type="submit" disabled={auth.isPending}>{auth.isPending ? 'Aguarde…' : mode === 'login' ? 'Entrar' : mode === 'register' ? 'Criar conta' : 'Enviar instruções'}</button>
        </form>
        {mode === 'login' && <button className="auth-forgot" type="button" onClick={() => { auth.reset(); setAuthNotice(null); onModeChange('request-reset'); }}>Esqueceu a senha?</button>}
        <p className="auth-switch">{mode === 'login' ? 'Ainda não tem conta?' : mode === 'register' ? 'Já tem uma conta?' : 'Lembrou sua senha?'}{' '}
          <button type="button" onClick={() => { auth.reset(); setAuthNotice(null); onModeChange(mode === 'register' || mode === 'request-reset' ? 'login' : 'register'); }}>{mode === 'login' ? 'Cadastre-se' : 'Entrar'}</button>
        </p>
      </section>
    </div>
  );
}

function useSession() {
  const queryClient = useQueryClient();
  const session = useQuery({ queryKey: ['session'], queryFn: getSession, retry: false });
  const endSession = useMutation({
    mutationFn: logout,
    onSuccess: () => queryClient.setQueryData(['session'], null),
  });
  return { user: session.data ?? null, signOut: endSession.mutate, signingOut: endSession.isPending, isLoading: session.isLoading, isError: session.isError, retry: session.refetch };
}

function useSaveInteraction(userId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: saveMyInteraction,
    onSuccess: (saved) => {
      if (!userId) return;
      queryClient.setQueryData<MovieInteraction[]>(['my-interactions', userId], (current) => {
        if (!current) return current;
        const exists = current.some((item) => item.movieId === saved.movieId);
        return exists ? current.map((item) => item.movieId === saved.movieId ? saved : item) : [...current, saved];
      });
    },
  });
}

function useRemoveInteraction(userId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: removeMyInteraction,
    onSuccess: (_result, movieId) => {
      if (!userId) return;
      queryClient.setQueryData<MovieInteraction[]>(['my-interactions', userId], (current) =>
        current?.filter((item) => item.movieId !== movieId),
      );
    },
  });
}

function Header({ user, onSignIn, onSignOut, signingOut, activePage = 'discover' }: {
  user: SessionUser | null;
  onSignIn: () => void;
  onSignOut: () => void;
  signingOut: boolean;
  activePage?: 'discover' | 'my-list' | 'community' | 'chat' | 'profile';
}) {
  const initials = user?.displayName.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() ?? '';
  return (
    <header className="topbar">
      <a className="brand" href="/" aria-label="MovieMatch — início"><span>Movie</span>Match</a>
      <nav aria-label="Navegação principal">
        <a className={activePage === 'discover' ? 'active' : ''} href="/#discover"><Compass size={18} /> Descobrir</a>
        <a className={activePage === 'my-list' ? 'active' : ''} href="/my-list"><ListVideo size={18} /> Minha lista</a>
        <a className={activePage === 'community' ? 'active' : ''} href="/community"><Users size={18} /> Comunidade</a>
        <a className={activePage === 'chat' ? 'active' : ''} href="/chat"><MessageCircle size={18} /> Chat</a>
      </nav>
      <div className="account-actions">
        {user ? <><span className="welcome">Olá, {user.displayName}</span><button className="account-button" onClick={onSignOut} disabled={signingOut}>{signingOut ? 'Saindo…' : 'Sair'}</button><a className={`avatar ${activePage === 'profile' ? 'active' : ''}`} href={`/users/${encodeURIComponent(user.username)}`} aria-label={`Perfil de ${user.displayName}`}>{initials}</a></> : <button className="account-button" onClick={onSignIn}>Entrar</button>}
      </div>
    </header>
  );
}

function Poster({ movie }: { movie: Pick<Movie, 'title' | 'posterPath'> }) {
  const [failed, setFailed] = useState(false);
  const posterUrl = movie.posterPath ? `https://image.tmdb.org/t/p/w500${movie.posterPath}` : null;
  return posterUrl && !failed
    ? <img src={posterUrl} alt={`Pôster de ${movie.title}`} loading="lazy" onError={() => setFailed(true)} />
    : <div className="poster-fallback" role="img" aria-label={`Pôster indisponível para ${movie.title}`}><span>MM</span></div>;
}

function MovieCard({ movie, isAuthenticated, userId, onAuthRequired }: { movie: Movie; isAuthenticated: boolean; userId?: string; onAuthRequired: () => void }) {
  const watchlist = useSaveInteraction(userId);
  const year = movie.releaseDate?.slice(0, 4) ?? '—';
  return (
    <article className="movie-card">
      <a className="movie-detail-link" href={`/movies/${movie.id}`} aria-label={`Ver detalhes de ${movie.title}`}>
        <div className="poster"><Poster movie={movie} /><span className="rating">★ {movie.rating.toFixed(1)}</span></div>
        <div className="movie-copy movie-summary"><div><p className="eyebrow">{year} · Filme</p><h3>{movie.title}</h3></div><p>{movie.overview || 'Sinopse ainda não disponível em português.'}</p></div>
      </a>
      <div className="movie-action">
        <button className="watchlist-button" onClick={() => isAuthenticated ? watchlist.mutate({ movieId: movie.id, title: movie.title, posterPath: movie.posterPath, status: 'want_to_watch' }) : onAuthRequired()} disabled={watchlist.isPending || watchlist.isSuccess}>
          <BookmarkPlus size={17} />{watchlist.isSuccess ? 'Na sua lista' : watchlist.isPending ? 'Salvando…' : isAuthenticated ? 'Quero assistir' : 'Entre para salvar'}
        </button>
        {watchlist.isError && <small role="alert">Não foi possível salvar o filme. <button type="button" onClick={() => watchlist.mutate({ movieId: movie.id, title: movie.title, posterPath: movie.posterPath, status: 'want_to_watch' })}>Tentar novamente</button></small>}
      </div>
    </article>
  );
}

function readCatalogFilters(): CatalogFilters {
  const params = new URLSearchParams(window.location.search);
  const query = params.get('q')?.trim() ?? '';
  const rawPage = Number(params.get('page'));
  const rawGenre = Number(params.get('genre'));
  const rawYear = Number(params.get('year'));
  return {
    query: query.length >= 2 ? query : '',
    page: Number.isInteger(rawPage) && rawPage >= 1 && rawPage <= 500 ? rawPage : 1,
    ...(query.length < 2 && Number.isInteger(rawGenre) && rawGenre > 0 ? { genreId: rawGenre } : {}),
    ...(Number.isInteger(rawYear) && rawYear >= 1870 && rawYear <= 2200 ? { year: rawYear } : {}),
  };
}

function writeCatalogFilters(filters: CatalogFilters) {
  const params = new URLSearchParams();
  if (filters.query) params.set('q', filters.query);
  if (filters.page > 1) params.set('page', String(filters.page));
  if (filters.genreId !== undefined) params.set('genre', String(filters.genreId));
  if (filters.year !== undefined) params.set('year', String(filters.year));
  const queryString = params.toString();
  window.history.pushState(null, '', `${window.location.pathname}${queryString ? `?${queryString}` : ''}#discover`);
}

function DiscoveryPage() {
  const [filters, setFilters] = useState(readCatalogFilters);
  const [queryInput, setQueryInput] = useState(filters.query);
  const [genreInput, setGenreInput] = useState(filters.genreId ? String(filters.genreId) : '');
  const [yearInput, setYearInput] = useState(filters.year ? String(filters.year) : '');
  const [filterError, setFilterError] = useState('');
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);
  const queryClient = useQueryClient();
  const session = useSession();
  const genres = useQuery({ queryKey: ['movie-genres'], queryFn: getGenres, staleTime: 60 * 60 * 1000 });
  const movies = useQuery({
    queryKey: ['movies', filters],
    queryFn: ({ signal }) => getMovies(filters, signal),
  });

  useEffect(() => {
    const syncFromUrl = () => {
      const next = readCatalogFilters();
      setFilters(next);
      setQueryInput(next.query);
      setGenreInput(next.genreId ? String(next.genreId) : '');
      setYearInput(next.year ? String(next.year) : '');
    };
    window.addEventListener('popstate', syncFromUrl);
    return () => window.removeEventListener('popstate', syncFromUrl);
  }, []);

  const applyFilters = (event: FormEvent) => {
    event.preventDefault();
    const query = queryInput.trim();
    const year = yearInput ? Number(yearInput) : undefined;
    if (query.length === 1) { setFilterError('Digite pelo menos dois caracteres para buscar.'); return; }
    if (yearInput && (!Number.isInteger(year) || year! < 1870 || year! > 2200)) { setFilterError('Informe um ano entre 1870 e 2200.'); return; }
    setFilterError('');
    const next: CatalogFilters = {
      query,
      page: 1,
      ...(query ? {} : genreInput ? { genreId: Number(genreInput) } : {}),
      ...(year === undefined ? {} : { year }),
    };
    setGenreInput(next.genreId ? String(next.genreId) : '');
    setFilters(next);
    writeCatalogFilters(next);
  };

  const changePage = (page: number) => {
    const next = { ...filters, page };
    setFilters(next);
    writeCatalogFilters(next);
  };

  const catalogMode = movies.data?.catalogMode ?? genres.data?.catalogMode;
  const heading = filters.query ? `Resultados para “${filters.query}”` : filters.genreId || filters.year ? 'Filmes encontrados' : 'Em alta esta semana';

  return (
    <div className="shell">
      <Header user={session.user} onSignIn={() => setAuthMode('login')} onSignOut={session.signOut} signingOut={session.signingOut} />
      <main id="top">
        <section className="hero">
          <div className="hero-copy"><p className="kicker"><Sparkles size={16} /> Seu próximo filme começa aqui</p><h1>Filmes ficam melhores quando são <em>compartilhados.</em></h1><p>Descubra histórias, monte sua watchlist e encontre o filme perfeito para assistir com quem combina com você.</p></div>
          <form className="search catalog-filters" onSubmit={applyFilters} role="search">
            <label className="title-filter"><Search size={21} /><input value={queryInput} onChange={(event) => setQueryInput(event.target.value)} placeholder="Busque por um filme…" aria-label="Buscar filmes" /></label>
            <label className="filter-field"><span>Gênero</span><select value={genreInput} onChange={(event) => setGenreInput(event.target.value)} disabled={Boolean(queryInput.trim())} aria-label="Filtrar por gênero"><option value="">Todos</option>{genres.data?.genres.map((genre) => <option key={genre.id} value={genre.id}>{genre.name}</option>)}</select></label>
            <label className="filter-field year-field"><span>Ano</span><input type="number" min="1870" max="2200" inputMode="numeric" value={yearInput} onChange={(event) => setYearInput(event.target.value)} aria-label="Filtrar por ano" /></label>
            <button className="filter-submit" type="submit">Buscar</button>
          </form>
          {filterError && <p className="filter-error" role="alert">{filterError}</p>}
          {queryInput.trim() && genreInput && <p className="filter-note">O filtro de gênero vale para descoberta; a busca por título mantém apenas o filtro de ano.</p>}
        </section>

        <section className="catalog" id="discover">
          <div className="section-heading"><div><p className="eyebrow">PARA DESCOBRIR</p><h2>{heading}</h2></div><span>{catalogMode === 'demo' ? 'Catálogo demonstrativo' : 'Catálogo TMDB'}</span></div>
          {catalogMode === 'demo' && <p className="demo-notice" role="status">Modo demonstrativo. Configure TMDB_API_TOKEN na API para buscar o catálogo atualizado.</p>}
          {genres.isError && <div className="state error" role="alert">Não foi possível carregar os gêneros. Tente novamente.</div>}
          {movies.isLoading && <div className="state">Carregando filmes…</div>}
          {movies.isError && <div className="state error" role="alert">{movies.error.message}</div>}
          {!movies.isLoading && !movies.isError && movies.data?.items.length === 0 && <div className="state">Nenhum filme encontrado para esses filtros.</div>}
          <div className="movie-grid">{movies.data?.items.map((movie) => <MovieCard key={movie.id} movie={movie} isAuthenticated={Boolean(session.user)} userId={session.user?.id} onAuthRequired={() => setAuthMode('login')} />)}</div>
          {movies.data && (movies.data.totalPages > 1 || filters.page > 1) && <div className="pagination" aria-label="Paginação dos filmes"><button type="button" onClick={() => changePage(filters.page - 1)} disabled={filters.page <= 1}><ChevronLeft size={18} /> Anterior</button><span>Página {movies.data.page} de {movies.data.totalPages}</span><button type="button" onClick={() => changePage(filters.page + 1)} disabled={filters.page >= movies.data.totalPages}>Próxima <ChevronRight size={18} /></button></div>}
        </section>
      </main>
      <footer><span className="brand"><span>Movie</span>Match</span><p>Descubra. Compartilhe. Dê match.</p></footer>
      {authMode && <AuthDialog mode={authMode} onModeChange={setAuthMode} onClose={() => setAuthMode(null)} onAuthenticated={async () => { setAuthMode(null); await queryClient.invalidateQueries({ queryKey: ['session'] }); }} />}
    </div>
  );
}

function MovieDetailsPage({ movieId }: { movieId: number }) {
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);
  const [shareMessage, setShareMessage] = useState('');
  const [reviewBody, setReviewBody] = useState('');
  const [reviewRating, setReviewRating] = useState('3');
  const queryClient = useQueryClient();
  const session = useSession();
  const details = useQuery({ queryKey: ['movie', movieId], queryFn: () => getMovie(movieId) });
  const reviews = useQuery({ queryKey: ['movie-reviews', movieId], queryFn: () => getMovieReviews(movieId) });
  const myReview = useQuery({ queryKey: ['my-review', session.user?.id, movieId], queryFn: () => getMyReview(movieId), enabled: Boolean(session.user) });
  const save = useSaveInteraction(session.user?.id);
  const saveReview = useMutation({
    mutationFn: saveMyReview,
    onSuccess: async (review) => {
      setReviewBody(review.body ?? '');
      await Promise.all([
        queryClient.setQueryData(['my-review', session.user?.id, movieId], review),
        queryClient.invalidateQueries({ queryKey: ['movie-reviews', movieId] }),
      ]);
    },
  });
  const deleteReview = useMutation({
    mutationFn: removeMyReview,
    onSuccess: async () => {
      queryClient.setQueryData(['my-review', session.user?.id, movieId], null);
      setReviewBody('');
      setReviewRating('3');
      await queryClient.invalidateQueries({ queryKey: ['movie-reviews', movieId] });
    },
  });
  const movie = details.data?.movie;

  useEffect(() => {
    if (myReview.data) {
      setReviewBody(myReview.data.body ?? '');
      setReviewRating(String(myReview.data.rating));
    }
  }, [myReview.data]);

  const shareMovie = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: movie?.title, url });
      else {
        await navigator.clipboard.writeText(url);
        setShareMessage('Link copiado.');
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      setShareMessage('Não foi possível compartilhar o link.');
    }
  };

  return (
    <div className="shell">
      <Header user={session.user} onSignIn={() => setAuthMode('login')} onSignOut={session.signOut} signingOut={session.signingOut} />
      <main className="detail-main">
        <a className="back-link" href="/#discover"><ArrowLeft size={18} /> Voltar para descoberta</a>
        {details.isLoading && <div className="state">Carregando detalhes…</div>}
        {details.isError && <div className="state error" role="alert">{details.error.message}</div>}
        {movie && <article className="movie-detail">
          <div className="detail-poster"><Poster movie={movie} /></div>
          <div className="detail-copy">
            <p className="eyebrow">DETALHES DO FILME</p>
            <h1>{movie.title}</h1>
            <p className="detail-meta">{movie.releaseDate?.slice(0, 4) ?? 'Ano indisponível'} <span aria-hidden="true">·</span> Nota TMDB: {movie.rating > 0 ? movie.rating.toFixed(1) : 'sem nota'}</p>
            <div className="genre-list">{movie.genres.map((genre) => <span key={genre.id}>{genre.name}</span>)}</div>
            <p className="detail-overview">{movie.overview || 'Sinopse ainda não disponível em português.'}</p>
            <div className="detail-actions">
              <button className="watchlist-button" onClick={() => session.user ? save.mutate({ movieId: movie.id, title: movie.title, posterPath: movie.posterPath, status: 'want_to_watch' }) : setAuthMode('login')} disabled={save.isPending || save.isSuccess}><BookmarkPlus size={17} />{save.isSuccess ? 'Na sua lista' : save.isPending ? 'Salvando…' : 'Quero assistir'}</button>
              <button className="share-button" onClick={() => void shareMovie()}><Share2 size={17} /> Compartilhar</button>
            </div>
            {save.isError && <p className="auth-error" role="alert">Não foi possível salvar o filme. <button type="button" className="inline-retry" onClick={() => movie && save.mutate({ movieId: movie.id, title: movie.title, posterPath: movie.posterPath, status: 'want_to_watch' })}>Tentar novamente</button></p>}
            {shareMessage && <p className="share-message" role="status">{shareMessage}</p>}
            {details.data?.catalogMode === 'demo' && <p className="demo-notice">Detalhes do catálogo demonstrativo.</p>}
          </div>
        </article>}
        {movie && <section className="reviews-section" aria-labelledby="reviews-title">
          <div className="section-heading"><div><p className="eyebrow">OPINIÕES DA COMUNIDADE</p><h2 id="reviews-title">Resenhas</h2></div></div>
          {session.user ? <form className="review-form" onSubmit={(event) => {
            event.preventDefault();
            saveReview.mutate({ movieId, title: movie.title, posterPath: movie.posterPath, rating: Number(reviewRating), body: reviewBody.trim() || null });
          }}>
            <h3>{myReview.data ? 'Edite sua resenha' : 'Escreva sua resenha'}</h3>
            <p className="review-public-notice">Ao publicar, sua nota e o texto ficam públicos na página do filme. Pessoas que seguem você veem a resenha no feed enquanto sua lista estiver pública.</p>
            <label>Nota (0,5 a 5)<select value={reviewRating} onChange={(event) => setReviewRating(event.target.value)}>{[0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].map((rating) => <option key={rating} value={rating}>{rating.toFixed(1)} / 5</option>)}</select></label>
            <label>Texto da resenha <span className="review-limit">{reviewBody.length}/2000</span><textarea value={reviewBody} maxLength={2000} rows={5} onChange={(event) => setReviewBody(event.target.value)} placeholder="O que você achou do filme?" /></label>
            {saveReview.isError && <p className="auth-error" role="alert">{saveReview.error.message}</p>}
            {deleteReview.isError && <p className="auth-error" role="alert">{deleteReview.error.message}</p>}
            <div className="review-form-actions"><button className="filter-submit" type="submit" disabled={myReview.isLoading || myReview.isError || saveReview.isPending || deleteReview.isPending}>{saveReview.isPending ? 'Salvando…' : myReview.data ? 'Salvar alterações' : 'Publicar resenha'}</button>{myReview.data && <button className="account-button" type="button" disabled={saveReview.isPending || deleteReview.isPending} onClick={() => deleteReview.mutate(movieId)}>{deleteReview.isPending ? 'Removendo…' : 'Remover resenha'}</button>}</div>
          </form> : <div className="review-signin"><p>Entre para publicar sua nota e resenha.</p><button className="account-button" onClick={() => setAuthMode('login')}>Entrar</button></div>}
          {myReview.isError && <p className="state error" role="alert">{myReview.error.message}</p>}
          {reviews.isLoading && <p className="state">Carregando resenhas…</p>}
          {reviews.isError && <p className="state error" role="alert">{reviews.error.message}</p>}
          {reviews.data?.length === 0 && <p className="state">Ainda não há resenhas para este filme.</p>}
          {reviews.data && reviews.data.length > 0 && <div className="review-list">{reviews.data.map((review: Review) => <article className="review-card" key={review.id}><div><strong>{review.author.displayName}</strong><span className="review-rating">★ {review.rating.toFixed(1)} / 5</span></div>{review.body && <p>{review.body}</p>}</article>)}</div>}
        </section>}
      </main>
      <footer><span className="brand"><span>Movie</span>Match</span><p>Descubra. Compartilhe. Dê match.</p></footer>
      {authMode && <AuthDialog mode={authMode} onModeChange={setAuthMode} onClose={() => setAuthMode(null)} onAuthenticated={async () => { setAuthMode(null); await queryClient.invalidateQueries({ queryKey: ['session'] }); }} />}
    </div>
  );
}

const interactionStatuses: { value: InteractionStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Todos os status' },
  { value: 'want_to_watch', label: 'Quero assistir' },
  { value: 'watching', label: 'Assistindo' },
  { value: 'watched', label: 'Assistido' },
  { value: 'abandoned', label: 'Abandonei' },
];

const statusLabels: Record<InteractionStatus, string> = {
  want_to_watch: 'Quero assistir',
  watching: 'Assistindo',
  watched: 'Assistido',
  abandoned: 'Abandonei',
};

function MyListPage() {
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);
  const [statusFilter, setStatusFilter] = useState<InteractionStatus | 'all'>('all');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const queryClient = useQueryClient();
  const session = useSession();
  const userId = session.user?.id;
  const queryKey = ['my-interactions', userId];
  const visibility = useQuery({ queryKey: ['list-visibility', userId], queryFn: getListVisibility, enabled: Boolean(userId) });
  const [shareMessage, setShareMessage] = useState('');
  const updateVisibility = useMutation({
    mutationFn: setListVisibility,
    onSuccess: (result) => queryClient.setQueryData(['list-visibility', userId], result),
  });
  const interactions = useQuery({ queryKey, queryFn: getMyInteractions, enabled: Boolean(userId), retry: false });
  const save = useSaveInteraction(userId);
  const remove = useRemoveInteraction(userId);
  const filteredItems = (interactions.data ?? []).filter((item) =>
    (statusFilter === 'all' || item.status === statusFilter) && (!favoritesOnly || item.isFavorite),
  );
  const isActionPending = save.isPending || remove.isPending;
  const actionError = save.isError
    ? 'Não foi possível atualizar esse filme. Tente novamente.'
    : remove.isError ? 'Não foi possível remover esse filme. Tente novamente.' : '';

  const authenticateAndReturn = async () => {
    setAuthMode(null);
    await queryClient.invalidateQueries({ queryKey: ['session'] });
  };

  const saveUpdatedInteraction = (item: MovieInteraction, changes: { status?: InteractionStatus; isFavorite?: boolean }) => {
    save.mutate({
      movieId: item.movieId,
      title: item.title,
      posterPath: item.posterPath,
      status: changes.status ?? item.status,
      isFavorite: changes.isFavorite ?? item.isFavorite,
    });
  };

  const removeListItem = (movieId: number) => {
    remove.mutate(movieId);
  };

  const shareList = async () => {
    if (!session.user || !visibility.data?.isPublic) return;
    const url = `${window.location.origin}/users/${encodeURIComponent(session.user.username)}/list`;
    try {
      await navigator.clipboard.writeText(url);
      setShareMessage('Link da lista copiado.');
    } catch {
      setShareMessage('Não foi possível copiar o link. Você pode abrir o link público abaixo.');
    }
  };

  return (
    <div className="shell">
      <Header user={session.user} onSignIn={() => setAuthMode('login')} onSignOut={session.signOut} signingOut={session.signingOut} activePage="my-list" />
      <main className="my-list-main">
        <section className="my-list-heading">
          <p className="eyebrow">SUA COLEÇÃO</p>
          <h1>Minha lista</h1>
          <p>Organize o que quer assistir, o que já viu e seus favoritos.</p>
        </section>

        {session.user && <section className="list-visibility" aria-label="Privacidade da lista">
          <div><strong>Visibilidade da lista</strong><p>{visibility.data?.isPublic ? 'Pública: qualquer pessoa com o link pode ver seus filmes, status e favoritos.' : 'Privada: somente você pode ver seus filmes.'}</p><small>Notas e textos de resenha só ficam públicos quando você publica uma resenha na página do filme.</small></div>
          <button className="account-button" type="button" disabled={visibility.isLoading || visibility.isError || updateVisibility.isPending} onClick={() => updateVisibility.mutate(!visibility.data?.isPublic)}>{updateVisibility.isPending ? 'Salvando…' : visibility.data?.isPublic ? 'Tornar privada' : 'Tornar pública'}</button>
          {visibility.data?.isPublic && <button className="share-button" type="button" onClick={() => void shareList()}><Share2 size={16} /> Copiar link</button>}
          {visibility.data?.isPublic && <a className="public-list-link" href={`/users/${encodeURIComponent(session.user.username)}/list`}>Abrir lista pública</a>}
          {visibility.isError && <p className="auth-error" role="alert">{visibility.error.message} <button type="button" className="inline-retry" onClick={() => void visibility.refetch()}>Tentar novamente</button></p>}
          {updateVisibility.isError && <p className="auth-error" role="alert">{updateVisibility.error.message}</p>}
          {shareMessage && <p role="status">{shareMessage}</p>}
        </section>}

        {session.isLoading && <div className="state" role="status">Verificando sua sessão…</div>}
        {session.isError && <div className="state error" role="alert"><p>Não foi possível verificar sua sessão.</p><button className="account-button" onClick={() => void session.retry()}>Tentar novamente</button></div>}
        {!session.isLoading && !session.isError && !session.user && <section className="state list-auth-prompt" aria-label="Acesso à lista"><h2>Entre para acessar sua lista</h2><p>Sua coleção fica vinculada à sua conta.</p><button className="filter-submit" onClick={() => setAuthMode('login')}>Entrar</button></section>}
        {session.user && <>
          <section className="list-filters" aria-label="Filtros da lista">
            <label htmlFor="list-status-filter">Filtrar por status</label>
            <select id="list-status-filter" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as InteractionStatus | 'all')}>
              {interactionStatuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
            </select>
            <label className="favorite-filter"><input type="checkbox" checked={favoritesOnly} onChange={(event) => setFavoritesOnly(event.target.checked)} /> Somente favoritos</label>
            <span className="list-count">{filteredItems.length} {filteredItems.length === 1 ? 'filme' : 'filmes'}</span>
          </section>

          {interactions.isLoading && <div className="state" role="status">Carregando sua lista…</div>}
          {interactions.isError && <div className="state error" role="alert"><p>{interactions.error.message}</p><button className="account-button" onClick={() => void interactions.refetch()}>Tentar novamente</button></div>}
          {actionError && <p className="list-action-error" role="alert">{actionError}{' '}{save.isError && save.variables ? <button type="button" onClick={() => save.mutate(save.variables!)}>Tentar novamente</button> : remove.isError && remove.variables !== undefined ? <button type="button" onClick={() => remove.mutate(remove.variables!)}>Tentar novamente</button> : null}</p>}
          {!interactions.isLoading && !interactions.isError && interactions.data?.length === 0 && <section className="state list-empty"><h2>Sua lista ainda está vazia</h2><p>Explore o catálogo e salve filmes para encontrar tudo por aqui.</p><a className="filter-submit" href="/#discover">Explorar filmes</a></section>}
          {!interactions.isLoading && !interactions.isError && (interactions.data?.length ?? 0) > 0 && filteredItems.length === 0 && <section className="state"><p>Nenhum filme corresponde a esses filtros.</p><button className="account-button" onClick={() => { setStatusFilter('all'); setFavoritesOnly(false); }}>Limpar filtros</button></section>}
          {!interactions.isLoading && !interactions.isError && filteredItems.length > 0 && <div className="my-list-items">
            {filteredItems.map((item) => <article className="list-item" key={item.movieId}>
              <a className="list-item-poster" href={`/movies/${item.movieId}`} aria-label={`Ver detalhes de ${item.title}`}><Poster movie={item} /></a>
              <div className="list-item-copy">
                <p className="eyebrow">MINHA LISTA</p>
                <h2><a href={`/movies/${item.movieId}`}>{item.title}</a></h2>
                <span className="list-item-status">{statusLabels[item.status]}</span>
              </div>
              <div className="list-item-actions">
                <label className="status-control"><span>Status</span><select aria-label={`Status de ${item.title}`} value={item.status} disabled={isActionPending} onChange={(event) => saveUpdatedInteraction(item, { status: event.target.value as InteractionStatus })}>
                  {interactionStatuses.slice(1).map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
                </select></label>
                <button className={`list-icon-button ${item.isFavorite ? 'is-favorite' : ''}`} type="button" aria-label={item.isFavorite ? `Remover ${item.title} dos favoritos` : `Adicionar ${item.title} aos favoritos`} title={item.isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'} disabled={isActionPending} onClick={() => saveUpdatedInteraction(item, { isFavorite: !item.isFavorite })}><Heart size={18} fill={item.isFavorite ? 'currentColor' : 'none'} /></button>
                <button className="list-icon-button remove-list-item" type="button" aria-label={`Remover ${item.title} da lista`} title="Remover da lista" disabled={isActionPending} onClick={() => removeListItem(item.movieId)}><Trash2 size={18} /></button>
              </div>
            </article>)}
          </div>}
        </>}
      </main>
      <footer><span className="brand"><span>Movie</span>Match</span><p>Descubra. Compartilhe. Dê match.</p></footer>
      {authMode && <AuthDialog mode={authMode} onModeChange={setAuthMode} onClose={() => setAuthMode(null)} onAuthenticated={() => { void authenticateAndReturn(); }} />}
    </div>
  );
}

function PublicListPage({ username }: { username: string }) {
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);
  const [showCommon, setShowCommon] = useState(false);
  const queryClient = useQueryClient();
  const session = useSession();
  const list = useQuery({ queryKey: ['public-list', username], queryFn: () => getPublicList(username), refetchInterval: 30_000 });
  const common = useQuery({ queryKey: ['common-movies', session.user?.id, username], queryFn: () => getCommonMovies(username), enabled: Boolean(session.user && showCommon), refetchInterval: 30_000 });

  return <div className="shell">
    <Header user={session.user} onSignIn={() => setAuthMode('login')} onSignOut={session.signOut} signingOut={session.signingOut} />
    <main className="my-list-main">
      <a className="back-link" href="/#discover"><Compass size={18} /> Voltar para descoberta</a>
      <section className="my-list-heading"><p className="eyebrow">LISTA COMPARTILHADA</p><h1>Lista de @{username}</h1><p>Filmes publicados voluntariamente pelo proprietário da lista.</p></section>
      {list.isLoading && <div className="state" role="status">Carregando lista…</div>}
      {list.isFetching && !list.isLoading && <div className="state" role="status">Verificando disponibilidade da lista…</div>}
      {list.isError && <div className="state error" role="alert">Esta lista é privada ou não está disponível.</div>}
      {list.isSuccess && !list.isFetching && list.data && <>
        {session.user && <section className="common-movies-control"><button className="account-button" type="button" onClick={() => setShowCommon((current) => !current)}>{showCommon ? 'Ocultar filmes em comum' : 'Ver filmes em comum'}</button>
          {showCommon && common.isLoading && <span role="status">Carregando…</span>}
          {showCommon && common.isFetching && !common.isLoading && <span role="status">Verificando autorização…</span>}
          {showCommon && common.isError && <span className="auth-error" role="alert">{common.error.message}</span>}
          {showCommon && common.isSuccess && !common.isFetching && common.data.length === 0 && <span>Vocês ainda não têm filmes em comum na lista.</span>}
          {showCommon && common.isSuccess && !common.isFetching && common.data.length > 0 && <span>{common.data.length} {common.data.length === 1 ? 'filme em comum' : 'filmes em comum'}.</span>}
        </section>}
        {list.data.length === 0 ? <div className="state">Esta lista ainda não tem filmes.</div> : <div className="my-list-items">{list.data.map((item) => <article className="list-item" key={item.movieId}>
          <a className="list-item-poster" href={`/movies/${item.movieId}`} aria-label={`Ver detalhes de ${item.title}`}><Poster movie={item} /></a>
          <div className="list-item-copy"><p className="eyebrow">LISTA PÚBLICA</p><h2><a href={`/movies/${item.movieId}`}>{item.title}</a></h2><span className="list-item-status">{statusLabels[item.status]}{item.isFavorite ? ' · Favorito' : ''}</span></div>
        </article>)}</div>}
        {showCommon && common.isSuccess && !common.isFetching && common.data.length > 0 && <section className="common-movies-list"><h2>Filmes em comum</h2><div className="my-list-items">{common.data.map((item) => <article className="list-item" key={item.movieId}><a className="list-item-poster" href={`/movies/${item.movieId}`} aria-label={`Ver detalhes de ${item.title}`}><Poster movie={item} /></a><div className="list-item-copy"><h3><a href={`/movies/${item.movieId}`}>{item.title}</a></h3></div></article>)}</div></section>}
      </>}
    </main>
    <footer><span className="brand"><span>Movie</span>Match</span><p>Descubra. Compartilhe. Dê match.</p></footer>
    {authMode && <AuthDialog mode={authMode} onModeChange={setAuthMode} onClose={() => setAuthMode(null)} onAuthenticated={async () => { setAuthMode(null); await queryClient.invalidateQueries({ queryKey: ['session'] }); }} />}
  </div>;
}

function CommunityPage() {
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);
  const [peopleInput, setPeopleInput] = useState(() => new URLSearchParams(window.location.search).get('q') ?? '');
  const [peopleQuery, setPeopleQuery] = useState(() => {
    const query = new URLSearchParams(window.location.search).get('q') ?? '';
    return /^[a-zA-Z0-9_]{2,40}$/.test(query) ? query.toLowerCase() : '';
  });
  const [peoplePage, setPeoplePage] = useState(() => {
    const page = Number(new URLSearchParams(window.location.search).get('page') ?? 1);
    return Number.isInteger(page) && page > 0 && page <= 500 ? page : 1;
  });
  const [peopleSearchError, setPeopleSearchError] = useState('');
  const [feedPage, setFeedPage] = useState(() => {
    const page = Number(new URLSearchParams(window.location.search).get('feedPage') ?? 1);
    return Number.isInteger(page) && page > 0 && page <= 500 ? page : 1;
  });
  const queryClient = useQueryClient();
  const session = useSession();
  const feed = useQuery({ queryKey: ['feed', session.user?.id, feedPage], queryFn: ({ signal }) => getFeed(feedPage, signal), enabled: Boolean(session.user), retry: false, refetchInterval: 30_000 });
  const people = useQuery({ queryKey: ['people-search', peopleQuery, peoplePage], queryFn: () => searchPeople(peopleQuery, peoplePage), enabled: Boolean(peopleQuery), retry: false });

  useEffect(() => {
    const syncSearch = () => {
      const params = new URLSearchParams(window.location.search);
      const query = params.get('q') ?? '';
      const page = Number(params.get('page') ?? 1);
      setPeopleInput(query);
      setPeopleQuery(/^[a-zA-Z0-9_]{2,40}$/.test(query) ? query.toLowerCase() : '');
      setPeoplePage(Number.isInteger(page) && page > 0 && page <= 500 ? page : 1);
      const requestedFeedPage = Number(params.get('feedPage') ?? 1);
      setFeedPage(Number.isInteger(requestedFeedPage) && requestedFeedPage > 0 && requestedFeedPage <= 500 ? requestedFeedPage : 1);
    };
    window.addEventListener('popstate', syncSearch);
    return () => window.removeEventListener('popstate', syncSearch);
  }, []);

  const submitPeopleSearch = (event: FormEvent) => {
    event.preventDefault();
    const query = peopleInput.trim();
    if (!/^[a-zA-Z0-9_]{2,40}$/.test(query)) {
      setPeopleSearchError('Digite de 2 a 40 letras, números ou _ para buscar por username.');
      return;
    }
    setPeopleSearchError('');
    setPeopleInput(query);
    setPeopleQuery(query.toLowerCase());
    setPeoplePage(1);
    writeCommunitySearch(query.toLowerCase(), 1);
  };

  const changePeoplePage = (page: number) => {
    setPeoplePage(page);
    writeCommunitySearch(peopleQuery, page);
  };

  useEffect(() => {
    if (feed.data && feedPage > feed.data.totalPages) {
      const lastPage = feed.data.totalPages;
      setFeedPage(lastPage);
      writeCommunityFeedPage(lastPage);
    }
  }, [feed.data, feedPage]);

  const changeFeedPage = (page: number) => {
    setFeedPage(page);
    writeCommunityFeedPage(page);
  };

  return <div className="shell">
    <Header user={session.user} onSignIn={() => setAuthMode('login')} onSignOut={session.signOut} signingOut={session.signingOut} activePage="community" />
    <main className="community-main">
      <section className="my-list-heading"><p className="eyebrow">MOVIEMATCH SOCIAL</p><h1>Comunidade</h1><p>Veja as resenhas publicadas por você e pelas pessoas que segue.</p></section>
      <section className="people-search" aria-labelledby="people-search-title">
        <div><p className="eyebrow">ENCONTRE PESSOAS</p><h2 id="people-search-title">Buscar por username</h2></div>
        <form role="search" aria-label="Buscar pessoas" onSubmit={submitPeopleSearch}>
          <label htmlFor="people-search-input">Username</label>
          <div className="people-search-controls"><input id="people-search-input" type="search" minLength={2} maxLength={40} pattern="[A-Za-z0-9_]+" placeholder="Ex.: erika" value={peopleInput} onChange={(event) => { setPeopleInput(event.target.value); setPeopleSearchError(''); }} /><button className="filter-submit" type="submit">Buscar pessoas</button></div>
        </form>
        {peopleSearchError && <p className="auth-error" role="alert">{peopleSearchError}</p>}
        {peopleQuery && <div className="people-results" aria-live="polite">
          {people.isLoading && <p role="status">Buscando pessoas…</p>}
          {people.isError && <p className="state error" role="alert">{people.error.message} <button type="button" className="inline-retry" onClick={() => void people.refetch()}>Tentar novamente</button></p>}
          {people.data && people.data.items.length === 0 && <p className="state">Nenhuma pessoa encontrada para “{peopleQuery}”.</p>}
          {people.data && people.data.items.length > 0 && <>
            <p className="people-result-count">{people.data.totalResults} {people.data.totalResults === 1 ? 'pessoa encontrada' : 'pessoas encontradas'}</p>
            <div className="people-results-list">{people.data.items.map((person) => <a className="people-result" key={person.username} href={`/users/${encodeURIComponent(person.username)}`}>
              <span className="profile-avatar" aria-hidden="true">{person.displayName.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}</span>
              <span><strong>{person.displayName}</strong><small>@{person.username}</small>{person.bio && <span className="people-result-bio">{person.bio}</span>}</span>
            </a>)}</div>
            {people.data.totalPages > 1 && <nav className="people-pagination" aria-label="Paginação dos resultados de pessoas">
              <button className="account-button" type="button" disabled={people.data.page <= 1} onClick={() => changePeoplePage(people.data!.page - 1)}>Anterior</button>
              <span>Página {people.data.page} de {people.data.totalPages}</span>
              <button className="account-button" type="button" disabled={people.data.page >= people.data.totalPages} onClick={() => changePeoplePage(people.data!.page + 1)}>Próxima</button>
            </nav>}
          </>}
        </div>}
      </section>
      {session.isLoading && <div className="state" role="status">Verificando sua sessão…</div>}
      {!session.isLoading && !session.user && <section className="state list-auth-prompt"><h2>Entre para ver seu feed</h2><p>As resenhas publicadas por pessoas que você segue aparecem aqui.</p><button className="filter-submit" onClick={() => setAuthMode('login')}>Entrar</button></section>}
      {session.user && feed.isLoading && <div className="state" role="status">Carregando feed…</div>}
      {session.user && feed.isError && <div className="state error" role="alert"><p>{feed.error.message}</p><button className="account-button" onClick={() => void feed.refetch()}>Tentar novamente</button></div>}
      {session.user && !feed.isLoading && !feed.isError && feed.data?.totalResults === 0 && <div className="state">Seu feed está vazio. As resenhas de quem você segue aparecerão aqui.</div>}
      {feed.data && feed.data.items.length > 0 && <div className="community-feed">{feed.data.items.map((review) => <article className="feed-review" key={review.id}>
        <div className="feed-review-heading"><a href={`/users/${encodeURIComponent(review.author.username)}`}><UserRound size={16} /> {review.author.displayName} <span>@{review.author.username}</span></a><span>★ {review.rating.toFixed(1)} / 5</span></div>
        <h2><a href={`/movies/${review.movieId}`}>{review.title}</a></h2>
        {review.body && <p>{review.body}</p>}
        <a className="feed-movie-link" href={`/movies/${review.movieId}`}>Ver filme</a>
      </article>)}</div>}
      {session.user && feed.data && feed.data.totalPages > 1 && <nav className="people-pagination" aria-label="Paginação do feed">
        <button className="account-button" type="button" disabled={feed.data.page <= 1} onClick={() => changeFeedPage(feed.data!.page - 1)}>Anterior</button>
        <span>Página {feed.data.page} de {feed.data.totalPages} · {feed.data.totalResults} resenhas</span>
        <button className="account-button" type="button" disabled={feed.data.page >= feed.data.totalPages} onClick={() => changeFeedPage(feed.data!.page + 1)}>Próxima</button>
      </nav>}
    </main>
    <footer><span className="brand"><span>Movie</span>Match</span><p>Descubra. Compartilhe. Dê match.</p></footer>
    {authMode && <AuthDialog mode={authMode} onModeChange={setAuthMode} onClose={() => setAuthMode(null)} onAuthenticated={async () => { setAuthMode(null); await queryClient.invalidateQueries({ queryKey: ['session'] }); }} />}
  </div>;
}

function ProfileEditor({ profile, onSaved, onCancel }: { profile: PublicProfile; onSaved: (updated: PublicProfile) => void; onCancel: () => void }) {
  const [username, setUsername] = useState(profile.username);
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [bio, setBio] = useState(profile.bio ?? '');
  const update = useMutation({ mutationFn: () => updateMyProfile({ username, displayName, bio: bio.trim() || null }), onSuccess: onSaved });

  return <form className="profile-edit-form" onSubmit={(event) => { event.preventDefault(); update.mutate(); }}>
    <label>Nome<input required maxLength={100} value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label>
    <label>Username<input required minLength={3} maxLength={40} pattern="[A-Za-z0-9_]+" value={username} onChange={(event) => setUsername(event.target.value)} /></label>
    <label>Bio<textarea maxLength={280} rows={4} value={bio} onChange={(event) => setBio(event.target.value)} /></label>
    {update.isError && <p className="profile-edit-error" role="alert">{update.error.message}</p>}
    <div className="profile-edit-actions"><button className="filter-submit" type="submit" disabled={update.isPending}>{update.isPending ? 'Salvando…' : 'Salvar perfil'}</button><button className="account-button" type="button" onClick={onCancel} disabled={update.isPending}>Cancelar</button></div>
  </form>;
}

function PublicProfilePage({ username }: { username: string }) {
  const queryClient = useQueryClient();
  const session = useSession();
  const [editing, setEditing] = useState(false);
  const profile = useQuery({ queryKey: ['public-profile', username], queryFn: () => getPublicProfile(username) });
  const publicList = useQuery({ queryKey: ['profile-public-list', username], queryFn: () => getPublicList(username), enabled: Boolean(profile.data) });
  const ownsProfile = Boolean(session.user && profile.data && session.user.username === profile.data.username);
  const followKey = ['follow-status', session.user?.id, username];
  const followStatus = useQuery({ queryKey: followKey, queryFn: () => getFollowStatus(username), enabled: Boolean(session.user && profile.data && !ownsProfile), retry: false });
  const updateFollow = useMutation({
    mutationFn: (following: boolean) => setFollowing(username, following),
    onSuccess: async (_result, following) => {
      queryClient.setQueryData(followKey, { following });
      await queryClient.invalidateQueries({ queryKey: ['public-profile', username] });
      await queryClient.invalidateQueries({ queryKey: ['feed', session.user?.id] });
    },
  });
  const handleProfileSaved = (updated: PublicProfile) => {
    queryClient.setQueryData<SessionUser>(['session'], (current) => current ? { ...current, ...updated } : current);
    queryClient.setQueryData(['public-profile', updated.username], {
      ...updated,
      followersCount: profile.data?.followersCount,
      followingCount: profile.data?.followingCount,
    });
    setEditing(false);
    navigateTo(`/users/${encodeURIComponent(updated.username)}`);
  };

  return <div className="shell">
    <Header user={session.user} onSignIn={() => navigateTo(loginPathForCurrentPage())} onSignOut={session.signOut} signingOut={session.signingOut} activePage="profile" />
    <main className="profile-main">
      <a className="back-link" href="/community"><ArrowLeft size={18} /> Voltar para comunidade</a>
      {profile.isLoading && <div className="state" role="status">Carregando perfil…</div>}
      {profile.isError && <div className="state error" role="alert">{profile.error.message}</div>}
        {profile.data && <section className="profile-card">
        <span className="profile-avatar" aria-hidden="true">{profile.data.displayName.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}</span>
        <p className="eyebrow">PERFIL PÚBLICO</p><h1>{profile.data.displayName}</h1><p className="profile-username">@{profile.data.username}</p>
        <p className="profile-follow-counts"><span>{profile.data.followersCount ?? 0} seguidores</span><span>{profile.data.followingCount ?? 0} seguindo</span></p>
        {profile.data.bio && <p className="profile-bio">{profile.data.bio}</p>}
        {!ownsProfile && session.user && <div className="profile-follow-actions">
          {followStatus.isLoading ? <span role="status">Verificando relação…</span> : <button className="account-button" type="button" disabled={followStatus.isError || updateFollow.isPending} onClick={() => updateFollow.mutate(!followStatus.data?.following)}>{updateFollow.isPending ? 'Salvando…' : followStatus.data?.following ? 'Deixar de seguir' : 'Seguir'}</button>}
          {followStatus.isError && <p className="auth-error" role="alert">{followStatus.error.message} <button type="button" className="inline-retry" onClick={() => void followStatus.refetch()}>Tentar novamente</button></p>}
          {updateFollow.isError && <p className="auth-error" role="alert">{updateFollow.error.message}</p>}
        </div>}
        {!ownsProfile && !session.user && !session.isLoading && !session.isError && <button className="account-button" type="button" onClick={() => navigateTo(loginPathForCurrentPage())}>Entre para seguir</button>}
        {ownsProfile && !editing && <button className="account-button profile-edit-trigger" type="button" onClick={() => setEditing(true)}>Editar perfil</button>}
        {ownsProfile && editing && <ProfileEditor profile={profile.data} onSaved={handleProfileSaved} onCancel={() => setEditing(false)} />}
        {publicList.isSuccess && <a className="filter-submit" href={`/users/${encodeURIComponent(username)}/list`}>Ver lista pública ({publicList.data.length})</a>}
        {publicList.isLoading && <span className="profile-list-loading">Verificando lista pública…</span>}
      </section>}
    </main>
    <footer><span className="brand"><span>Movie</span>Match</span><p>Descubra. Compartilhe. Dê match.</p></footer>
  </div>;
}

function ChatPage() {
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);
  const queryClient = useQueryClient();
  const session = useSession();
  return <div className="shell">
    <Header user={session.user} onSignIn={() => setAuthMode('login')} onSignOut={session.signOut} signingOut={session.signingOut} activePage="chat" />
    <main className="chat-main">
      <section className="chat-placeholder"><MessageCircle size={34} /><p className="eyebrow">CONVERSAS</p><h1>Chat</h1>
        {session.isLoading ? <p role="status">Verificando sua sessão…</p> : session.user ? <p>As conversas individuais estarão disponíveis em uma próxima etapa.</p> : <><p>Entre para acessar conversas quando o chat estiver disponível.</p><button className="filter-submit" onClick={() => setAuthMode('login')}>Entrar</button></>}
      </section>
    </main>
    <footer><span className="brand"><span>Movie</span>Match</span><p>Descubra. Compartilhe. Dê match.</p></footer>
    {authMode && <AuthDialog mode={authMode} onModeChange={setAuthMode} onClose={() => setAuthMode(null)} onAuthenticated={async () => { setAuthMode(null); await queryClient.invalidateQueries({ queryKey: ['session'] }); }} />}
  </div>;
}

function LoginPage() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [returnTo] = useState(() => safeReturnPath(new URLSearchParams(window.location.search).get('returnTo')));
  const queryClient = useQueryClient();
  return <div className="shell login-page">
    <Header user={null} onSignIn={() => setMode('login')} onSignOut={() => undefined} signingOut={false} />
    <main className="login-main">
      <a className="back-link" href="/"><ArrowLeft size={18} /> Voltar para descoberta</a>
      <section className="login-intro"><p className="eyebrow">MOVIEMATCH</p><h1>{mode === 'login' ? 'Entre para continuar' : mode === 'register' ? 'Crie sua conta' : 'Recupere seu acesso'}</h1><p>{mode === 'request-reset' ? 'Informe seu e-mail e enviaremos instruções se houver uma conta associada.' : 'Acesse sua lista e participe da comunidade.'}</p></section>
      <AuthDialog mode={mode} onModeChange={setMode} onClose={() => navigateTo('/')} onAuthenticated={async () => { await queryClient.invalidateQueries({ queryKey: ['session'] }); navigateTo(returnTo, true); }} />
    </main>
    <footer><span className="brand"><span>Movie</span>Match</span><p>Descubra. Compartilhe. Dê match.</p></footer>
  </div>;
}

function ResetPasswordPage() {
  const [token] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('token') ?? '');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const reset = useMutation({ mutationFn: () => confirmPasswordReset(token, password), onSuccess: () => setCompleted(true) });

  useEffect(() => {
    if (window.location.hash) window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
  }, []);

  return <div className="shell login-page">
    <Header user={null} onSignIn={() => navigateTo('/login')} onSignOut={() => undefined} signingOut={false} />
    <main className="login-main">
      <a className="back-link" href="/login"><ArrowLeft size={18} /> Voltar ao login</a>
      <section className="login-intro"><p className="eyebrow">MOVIEMATCH</p><h1>Redefinir senha</h1></section>
      <section className="auth-dialog" aria-labelledby="reset-title">
        {completed ? <div className="list-auth-prompt"><h2 id="reset-title">Senha atualizada</h2><p>Entre novamente com sua nova senha.</p><a className="filter-submit" href="/login">Ir para login</a></div> : !token ? <div className="state error"><h2 id="reset-title">Link inválido ou expirado</h2><p>Solicite novas instruções pela tela de login.</p></div> : <form className="profile-edit-form" onSubmit={(event) => {
          event.preventDefault();
          setLocalError(null);
          if (password !== confirmation) {
            setLocalError('As senhas não coincidem.');
            return;
          }
          reset.mutate();
        }}>
          <label>Nova senha<input type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          <label>Confirme a nova senha<input type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>
          {(localError || reset.isError) && <p className="profile-edit-error" role="alert">{localError ?? reset.error?.message ?? 'Não foi possível atualizar a senha.'}</p>}
          <button className="auth-submit" type="submit" disabled={reset.isPending}>{reset.isPending ? 'Salvando…' : 'Atualizar senha'}</button>
        </form>}
      </section>
    </main>
    <footer><span className="brand"><span>Movie</span>Match</span><p>Descubra. Compartilhe. Dê match.</p></footer>
  </div>;
}

function NotFoundPage() {
  const session = useSession();
  return <div className="shell"><Header user={session.user} onSignIn={() => navigateTo('/login')} onSignOut={session.signOut} signingOut={session.signingOut} /><main className="not-found-main"><section className="state"><h1>Página não encontrada</h1><p>Este endereço não corresponde a uma página do MovieMatch.</p><a className="filter-submit" href="/">Ir para descoberta</a></section></main><footer><span className="brand"><span>Movie</span>Match</span><p>Descubra. Compartilhe. Dê match.</p></footer></div>;
}

export function App() {
  const [navigationVersion, setNavigationVersion] = useState(0);

  useEffect(() => {
    const updatePath = () => setNavigationVersion((current) => current + 1);
    const handleInternalLinks = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest('a');
      if (!anchor || anchor.target || anchor.hasAttribute('download')) return;
      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin) return;
      if (destination.pathname === window.location.pathname && destination.search === window.location.search) return;
      event.preventDefault();
      window.history.pushState(null, '', `${destination.pathname}${destination.search}${destination.hash}`);
      window.dispatchEvent(new PopStateEvent('popstate'));
    };
    window.addEventListener('popstate', updatePath);
    document.addEventListener('click', handleInternalLinks);
    return () => {
      window.removeEventListener('popstate', updatePath);
      document.removeEventListener('click', handleInternalLinks);
    };
  }, []);

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash) requestAnimationFrame(() => document.getElementById(decodeURIComponent(hash))?.scrollIntoView?.());
  }, [navigationVersion]);

  const pathname = window.location.pathname;
  if (/^\/my-list\/?$/.test(pathname)) return <MyListPage />;
  if (/^\/community\/?$/.test(pathname)) return <CommunityPage />;
  if (/^\/chat\/?$/.test(pathname)) return <ChatPage />;
  if (/^\/login\/?$/.test(pathname)) return <LoginPage />;
  if (/^\/reset-password\/?$/.test(pathname)) return <ResetPasswordPage />;
  const publicListMatch = pathname.match(/^\/users\/([A-Za-z0-9_]+)\/list\/?$/);
  if (publicListMatch) return <PublicListPage username={decodeURIComponent(publicListMatch[1]!)} />;
  const profileMatch = pathname.match(/^\/users\/([A-Za-z0-9_]+)\/?$/);
  if (profileMatch) return <PublicProfilePage username={decodeURIComponent(profileMatch[1]!)} />;
  const match = pathname.match(/^\/movies\/(\d+)\/?$/);
  if (match) return <MovieDetailsPage movieId={Number(match[1])} />;
  if (/^\/?$/.test(pathname)) return <DiscoveryPage />;
  return <NotFoundPage />;
}
