import React, { useEffect, useState } from 'react';
import { FaHeart } from 'react-icons/fa';
import '../styles/MovieCard.css';
import '../styles/movieDetailsPage.css';


function MovieCard({ movie }) {
  const [isFavorite, setIsFavorite] = useState(false);

  useEffect(() => {
    const checkFavorite = async () => {
      try {
        const response = await fetch('http://localhost:5000/favorites');
        const favorites = await response.json();
  
        // Verifica se o ID do filme está na lista de favoritos
        const isFav = favorites.some(fav => fav.id === movie.id);
        setIsFavorite(isFav);
      } catch (error) {
        console.error("Erro ao verificar os favoritos:", error);
      }
    };
    checkFavorite();
  }, [movie.id]);


  const toggleFavorite = async () => {
    if (isFavorite) {
      await removeFavoriteFromServer(movie.id);
      if (removeFavorite) {
        removeFavorite(movie._id); 
        window.location.reload();
      }
      setIsFavorite(false); 
    } else {
      await addFavorite(movie);
      setIsFavorite(true); 
    }
 
  };
  
 const addFavorite = async (movie) => {
    try {
      const response = await fetch('http://localhost:5000/favorites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(movie),
      });
      if (response.ok) {
        setIsFavorite(true); 
        console.log(`${movie.title} foi adicionado aos favoritos!`);
      } else if (response.status === 409) {
        console.log(`${movie.title} já está nos favoritos!`);
      }
    } catch (error) {
      console.error("Erro ao adicionar o filme aos favoritos:", error);
    }
  };
  
  const removeFavorite = async (id) => {
    try {
      const response = await fetch(`http://localhost:5000/favorites/${id}`, {
        method:'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(movie),
      });
      if (response.ok) {
        console.log(`O filme com ID ${id} foi removido dos favoritos!`);
      } else if (response.status === 404) {
        console.log(`Nenhum filme com ID ${id} foi encontrado nos favoritos.`);
      }
    } catch (error) {
      console.error("Erro ao remover o filme dos favoritos:", error);
    }
  };

const removeFavoriteFromServer = async (_id) => {
    try {
      const response = await fetch(`http://localhost:5000/favorites/${_id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (response.ok) {
        console.log(`O filme com ID ${_id} foi removido dos favoritos!`);
      } else {
        console.log(`Erro ao remover o filme dos favoritos.`);
      }
    } catch (error) {
      console.error("Erro ao remover o filme dos favoritos:", error);
    }
};



  const getStars = (rating) => {
    const stars = Math.round(rating / 2);
    let starIcons = '';
    for (let i = 0; i < 5; i++) {
      starIcons += i < stars ? '★' : '☆';
    }
    return starIcons;
  };

 

  return (
    <div className="movie-card">
      <img
        src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`}
        alt={movie.title}
      />
      <div className="movie-details">
        <h2>{movie.title}</h2>
        <p>
          
          {movie.overview ? movie.overview : "Sem Descrição"}
                    
        </p>
        <div className="rating">
          <span className="stars">{getStars(movie.vote_average)}</span>
        </div>
        <FaHeart
          className={`favorite-icon ${isFavorite ? 'favorite' : ''}`}
          onClick={toggleFavorite}
        />
      </div>
    </div>
  );
}

export default MovieCard;
