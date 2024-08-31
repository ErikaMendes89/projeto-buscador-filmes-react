import React, { useState, useEffect } from 'react';
import MovieList from '../componentes/MovieList';
import SearchBar from '../componentes/SearchBar';
import { useNavigate } from 'react-router-dom';
import { fetchMovies } from '../services/api';
import '../styles/HomePage.css';

function HomePage() {
  const [movies, setMovies] = useState([]);
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const searchMovies = async () => {
      if (query) {
        const results = await fetchMovies(query);
        setMovies(results);
      }
    };

    searchMovies();
  }, [query]);

  const handleSearch = (newQuery) => {
    setQuery(newQuery);
  };

  const handleFavoritesClick = ()=>{
       navigate('/favorites');
  }

  return (
    <div className="home-page">
    <h1>Busque & Escolha os seus favoritos</h1>
    <div className="search-favorites-container">
      <SearchBar onSearch={handleSearch} />
      <button className="favorite-btn" onClick={handleFavoritesClick}>
        Ver Favoritos
      </button>
    </div>
    <MovieList movies={movies} />
  </div>
  );
}

export default HomePage;
