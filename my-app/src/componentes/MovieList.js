import React from 'react';
import MovieCard from './MovieCard';
import '../styles/MovieList.css';

function MovieList({ movies }) {
  return (
    <div className="movie-list">
      {movies.map(movie => (
        <MovieCard key={movie.id} movie={movie} overview={movie.overview}/>
      ))}
    </div>
  );
}

export default MovieList;
