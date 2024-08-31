# Aplicativo de busca de Filmes e adicionar aos Favoritos, para compartilhar com os amigos!🚀
Este é um aplicativo React que permite aos usuários buscar filmes, salvar seus favoritos e compartilhar com seus amigos. <br>
Ficou mais fácilcriar uma lista para os amigos assistirem.🤩<br>
Ele se comunica com uma API backend em Node.js e MongoDB para armazenar e gerenciar os filmes favoritos do usuário.

## Estrutura do projeto
<b> componentes/:</b> Contém os componentes React que compôem a interface do usuário:
<ul>
  <li><b>FavoritesList.js</b>: Exibe a lista de filmes favoritos do usuário.</li>
  <li><b>MovieCard.js</b>: Exibe um cartão de filme individual com informações detalhadas e permite adicionar/remover dos favoritos.</li>
  <li><b>MovieList.js</b>: Renderiza uma lista de filmes, utilizando MovieCard para cada filme.</li>
  <li><b>SearchBar.js</b>: Barra de pesquisa para buscar filmes pela API.</li>
</ul>
<br>
<b>Pages/:</b> Contém as páginas principais do aplicativo.
<ul>
  <li><b>api.js</b>: Contém as funções necessárias para interagir com a API TMDB. 
    Inclui funções para buscar filmes baseados em uma palavra-chave e outras operações relacionadas.</li>
  <li><b>db.js</b>: Gerencia a conexão com o banco de dados MongoDB e as operações relacionadas ao armazenamento e recuperação de filmes favoritos. 
    Este arquivo encapsula a lógica de conexão e manipulação do banco de dados, garantindo que a aplicação possa armazenar e recuperar dados persistentes.</li>
</ul>
<br>
<b>styles/: Contém os arquivos de estilo CSS para os componentes. Os principais arquivos importantes:</b>
<ul>
  <li><b>App.css</b>: Define os estilos globais para a aplicação, aplicando uma fonte padrão e ajustando o layout geral</b></li>
  <li><b>favoritePage.css</b>: Aplica estilos específicos para a página de favoritos, utilizando neumorphism para botões, criando uma interface suave e tátil.</li>
  <li><b>HomePage.css</b>:Contém os estilos para a página inicial, incluindo a organização dos filmes em um layout flexível e responsivo.</li>
  <li><b>MovieCard.css</b>: Aplica glassmorphism aos cartões de filmes, com bordas arredondadas, sombras suaves, e um fundo translúcido que simula vidro fosco.</li>
  <li><b>movieDetails.css</b>: Estiliza a página de detalhes do filme, utilizando glassmorphism para o contêiner de informações, com foco na legibilidade e no contraste suave.</li>
  <li><b>movieList.css</b>: Define o layout da lista de filmes em uma grade flexível, com espaçamento adequado entre os itens.</li>
  <li><b>SearchBar.css</b>: Aplica neumorphism ao contêiner da barra de busca, com bordas arredondadas e sombras internas que criam um efeito de relevo. </li>
</ul>
<br>

## Pré-requistos
<ul>
  <li><b>Node.js</b>: Certifique-se de que o Node.js está instalado no seu sistema.</li>
  <li><b>MongoDB</b>: O MongoDB deve estar instalado e em execução.</li>
  <li><b>React</b>: Conhecimento básico de React é necessário para entender e modificar este projeto.</li>
</ul>

## API

