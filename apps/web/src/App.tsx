import { useMutation, useQuery } from '@tanstack/react-query';
import { BookmarkPlus, Compass, Heart, Search, Sparkles, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getMovies, saveToWatchlist, type Movie } from './api';

function MovieCard({ movie }: { movie: Movie }) {
  const watchlist = useMutation({ mutationFn: () => saveToWatchlist(movie) });
  const year = movie.releaseDate?.slice(0, 4) ?? '—';
  const poster = movie.posterPath ? `https://image.tmdb.org/t/p/w500${movie.posterPath}` : null;

  return (
    <article className="movie-card">
      <div className="poster">
        {poster ? <img src={poster} alt={`Pôster de ${movie.title}`} loading="lazy" /> : <div className="poster-fallback"><span>MM</span></div>}
        <span className="rating">★ {movie.rating.toFixed(1)}</span>
      </div>
      <div className="movie-copy">
        <div><p className="eyebrow">{year} · Filme</p><h3>{movie.title}</h3></div>
        <p>{movie.overview || 'Sinopse ainda não disponível em português.'}</p>
        <button className="watchlist-button" onClick={() => watchlist.mutate()} disabled={watchlist.isPending || watchlist.isSuccess}>
          <BookmarkPlus size={17} />
          {watchlist.isSuccess ? 'Na sua lista' : watchlist.isPending ? 'Salvando…' : 'Quero assistir'}
        </button>
        {watchlist.isError && <small role="alert">Inicie o PostgreSQL para salvar.</small>}
      </div>
    </article>
  );
}

export function App() {
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  useEffect(() => {
    const timeout = window.setTimeout(() => setQuery(input.trim().length >= 2 ? input.trim() : ''), 350);
    return () => window.clearTimeout(timeout);
  }, [input]);
  const movies = useQuery({ queryKey: ['movies', query], queryFn: () => getMovies(query) });

  return (
    <div className="shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="MovieMatch — início"><span>Movie</span>Match</a>
        <nav aria-label="Navegação principal"><a className="active" href="#discover"><Compass size={18} /> Descobrir</a><a href="#social"><Users size={18} /> Comunidade</a><a href="#watchlist"><Heart size={18} /> Minha lista</a></nav>
        <button className="avatar" aria-label="Abrir perfil de Erika">EM</button>
      </header>

      <main id="top">
        <section className="hero">
          <div className="hero-copy"><p className="kicker"><Sparkles size={16} /> Seu próximo filme começa aqui</p><h1>Filmes ficam melhores quando são <em>compartilhados.</em></h1><p>Descubra histórias, monte sua watchlist e encontre o filme perfeito para assistir com quem combina com você.</p></div>
          <form className="search" onSubmit={(event) => event.preventDefault()} role="search"><Search size={21} /><input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Busque por um filme…" aria-label="Buscar filmes" /></form>
          <div className="signals" id="social"><div><strong>84%</strong><span>Match com Gabriel</span></div><div><strong>12</strong><span>Filmes em comum</span></div><div><strong>4.8</strong><span>Sua média</span></div></div>
        </section>

        <section className="catalog" id="discover">
          <div className="section-heading"><div><p className="eyebrow">PARA DESCOBRIR</p><h2>{query ? `Resultados para “${query}”` : 'Em alta esta semana'}</h2></div><span>Catálogo por TMDB</span></div>
          {movies.isLoading && <div className="state">Preparando a sessão…</div>}
          {movies.isError && <div className="state error" role="alert">A API não respondeu. Execute <code>npm run dev</code> na raiz do projeto.</div>}
          {movies.data?.length === 0 && <div className="state">Nenhum filme encontrado.</div>}
          <div className="movie-grid">{movies.data?.map((movie) => <MovieCard key={movie.id} movie={movie} />)}</div>
        </section>
      </main>
      <footer><span className="brand"><span>Movie</span>Match</span><p>Descubra. Compartilhe. Dê match.</p></footer>
    </div>
  );
}
