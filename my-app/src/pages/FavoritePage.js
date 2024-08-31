import React, { useEffect, useState } from 'react';
import '../styles/movieDetailsPage.css';
import '../styles/favoritePage.css';
import FavoritesList from '../componentes/FavoriteList';




const FavoritePage = () => {

  const [favorites, setFavorites] = useState([]);

  useEffect(() => {
    const loadFavorites = async () => {
      try {
        const response = await fetch('http://localhost:5000/favorites');
        const data = await response.json();
        setFavorites(data);
      } catch (error) {
        console.error("Erro ao carregar os favoritos:", error);
      }
    };

    loadFavorites();
  }, []);

  const removeFavorite = (id) => {
    setFavorites(favorites.filter(movie => movie.id !== id));
  };
  


    return (
        <div>
            <FavoritesList favorites={favorites} removeFavorite={removeFavorite}/>
            </div>
    );
};

export default FavoritePage ;
