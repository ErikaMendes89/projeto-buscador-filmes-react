import React from 'react';
import '../styles/SearchBar.css';
import { FaSearch } from 'react-icons/fa'; 

function SearchBar({ onSearch }) {
  const handleSearch = (event) => {
    onSearch(event.target.value);
  };

  return (
    <div className="search-bar-container">
    <input 
      type="text" 
      className="search-bar" 
      placeholder="Procurar por filme..." 
      onChange={handleSearch} 
    />
    <button className="search-button">
        <FaSearch />
    </button>
    </div>
  );
}

export default SearchBar;
