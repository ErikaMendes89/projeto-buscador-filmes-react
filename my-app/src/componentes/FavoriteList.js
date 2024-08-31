import React from 'react';
import MovieList from './MovieList';
import '../styles/favoritePage.css'; 



const shareFavorites = () => {
  const shareText = `Confira meus filmes favoritos: http://localhost:3000/favorites`;
  navigator.clipboard.writeText(shareText).then(() => {
    alert("Link de favoritos copiado para a área de transferência!");
  });
};


function FavoritesList({ favorites, removeFavorite }) {
  const goBack = () => {
    window.history.back();
  };

  return (
    <div className="favorites-list">
      <h1>Seus Filmes Favoritos </h1>
       <button className="back-btn" onClick={goBack}>Voltar</button>
      <button className="share-btn" onClick={shareFavorites}>Compartilhar</button>
      <MovieList movies={favorites} removeFavorite={removeFavorite} />  
    </div>
  );
}

export default FavoritesList;
