import axios from 'axios';

const API_KEY = 'Insira sua API TMDB aqui'; //preciso pesquisar mais sobre variaveis ambiente em react js,para insirir minha api em arquivo .env. 
const BASE_URL = 'https://api.themoviedb.org/3';

export const fetchMovies = async (query) => {
  const response = await axios.get(`${BASE_URL}/search/movie`, {
    params: {
      api_key: API_KEY,
      query: query,
      language: 'pt-BR',
    },
  });
  return response.data.results;
};

export const fetchMovieById = async (id) => {
  const response = await axios.get(`${BASE_URL}/movie/${id}`, {
    params: {
      api_key: API_KEY,
      language: 'pt-BR',
    },
  });
  return response.data;
};
