import React, { useEffect, useState }from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import HomePage from './pages/HomePage';
import FavoritesPage from './pages/FavoritePage';
import './styles/app.css';


function App() {
  const [favorites,setFavorites] = useState([]);

  const loadFavorites = async() => {
    try{
      const response = await fetch('http://localhost:5000/');
      const data = await response.json();
      setFavorites(data);
    }catch(error){
      console.error("Erro ao carregar os favorites:", error);
    }
  };

  useEffect(() => {
    loadFavorites(); 
  }, []);

 
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage/>} />
        <Route path="/favorites" element={<FavoritesPage  favorites={favorites} />} />
      </Routes>
    </Router>
  );
}

export default App;
