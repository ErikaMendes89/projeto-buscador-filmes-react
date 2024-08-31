# Aplicativo de busca de Filmes e adicionar aos Favoritos, para compartilhar com os amigos!🚀
Este é um aplicativo React que permite aos usuários buscar filmes, salvar seus favoritos e compartilhar com seus amigos. <br>
Ficou mais fácilcriar uma lista para os amigos assistirem.🤩<br>
Ele se comunica com uma API backend em Node.js e MongoDB para armazenar e gerenciar os filmes favoritos do usuário.

## Estrutura do projeto
<b> componentes/:</b> Contém os componentes React que compôem a interface do usuário:
<ul>
  <li><b>FavoritesList.js</b>: Exibe a lista de filmes favoritos do usuário.</li>
  <li><b>MovieCard.js</b>: Exibe um cartão de filme individual com informações detalhadas e permite adicionar/remover dos favoritos clicando no icon coração.</li>
  <li><b>MovieList.js</b>: Renderiza uma lista de filmes, utilizando MovieCard para cada filme.</li>
  <li><b>SearchBar.js</b>: Barra de pesquisa para buscar filmes pela API.</li>
</ul>
<br>
<b>Pages/:</b> Contém as páginas principais do aplicativo.
<ul>
  <li><b>FavoritePage.js</b>: Página que exibe os filmes favoritos do usuário.</li>
  <li><b>HomePage.js</b>: Página inicial onde os usuários podem buscar filmes e adicionar aos favoritos.</li>
</ul>
<b>services/:</b>> Contém os serviços para comunicação com a API externa e gerenciamento de dados locais
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
<b>Endpoints</b>
<ul>
  <li><b>POST /favorites</b>: Adiciona um filme aos favoritos.</li>
  <li><b>DELETE /favorites/:id</b>: Remove um filme dos favoritos pelo ID.</li>
  <li><b>GET /favorites</b> Retorna todos os filmes favoritos.</li>
</ul>
<br>

## Estrutura dos dados
<b>Filmes</b>
<ul>
  <li><b>id</b>: Número único identificador do filme.</li>
  <li><b>title</b>: Título do filme.</li>
  <li><b>overview</b>: Resumo do filme.</li>
  <li><b>poster_path</b>: Caminho para a imagem do cartaz do filme. </li>
</ul>

  
<br>
<b>Testes Realizados no Postman</b>
<br> <br>
<img src="https://github.com/ErikaMendes89/projeto-buscador-filmes-react/blob/main/imagens-projeto-verzel/Captura%20de%20tela%202024-08-30%20112509.png" />
<img src="https://github.com/ErikaMendes89/projeto-buscador-filmes-react/blob/main/imagens-projeto-verzel/Captura%20de%20tela%202024-08-30%20112556.png"/>
<br><br>

## Rodando o Service

<b> Passo a passo </b>
<ol>
<li>Primeiramente instalar o NodeJs,MongoDBCompass e MongoDbServer em sua máquina. Caso, não tenha!</li>
<li>Após clonar o Repósitorio [https://github.com/ErikaMendes89/projeto-buscador-filmes-react/tree/main/my-app] </li>
<li>abra o cmd e excute o comando [mongod] para iniciar o server</li>
<li> Abra a pasta service no seu terminal e excute o arquivo node db.js</li>
</ol>

<br><br>
<b> Em seu terminal vai aparecer a seguinte mensagem:</b><br>
Servidor Rodando na porta 5000 <br>
Conectado ao MongoDB
<br>
<img src="https://github.com/ErikaMendes89/projeto-buscador-filmes-react/blob/main/imagens-projeto-verzel/conex%C3%A7%C3%A3o-do-meu-servidor.png">
<br><br>
<b>O seu mongoDB tem que a aparecer assim:</b>
<br><br>
<b>Para rodar o front-End</b>
<ol>
  <li>Primeiramente precisa abrir um segundo terminal com caminho para a pasta my-app</li>
  <li>No terminal digitar npm start</li>
  <li>Será aberta a porta: <i>http://localhost:3000</i></li>
</ol>
<br><br>
<img src="https://github.com/ErikaMendes89/projeto-buscador-filmes-react/blob/main/imagens-projeto-verzel/Captura%20de%20tela%202024-08-31%20001027.png" >
<br><br>
<b>Acesse o vídeo de demostração</b> <br>

[https://drive.google.com/drive/folders/12z7L8n07eRH39lujAh1xEiORzpOffCbV](https://drive.google.com/file/d/1-xHfIsZ7NoLedtR0TAUTnZoIcWD19oOO/view?usp=drive_link)

<br><br>
<b>Seu mongoDbCompass vai se parecer com isso, recebendo as requisições </b>
<img src="https://github.com/ErikaMendes89/projeto-buscador-filmes-react/blob/main/imagens-projeto-verzel/mongodb-registro.png">
<br>

## Problemas Conhecidos
<ol>
  <li><b>API Key:</b> A chave da API TMDB deve ser configurada corretamente em um arquivo .env.Igual eu fiz no projeto https://github.com/ErikaMendes89/projeto-recomendacao-de-filmes</li>
  <li><b>Recarregamento da Página:</b>Ao adicionar/remover um favorito, a página recarrega para refletir as mudanças. Uma melhoria futura pode ser a atualização dinâmica 
   sem recarregar.</li>
  <li><b>Melhorias que quero adicionar:</b> login (tela de caasdtro e tela de login), onde o armazenando dos favoritos seria armazenado individualmente. E comentarios dos amigos que a lista foi compartilhada se deu match com amiguinho sobre o filme ser fav também.  </li>
</ol>

## Considerções Finais
Sinta-se à vontade para contribuir com o projeto através de pull requests. Por favor, certifique-se de que quaisquer mudanças estejam de acordo com o estilo e a arquitetura do projeto existente. Todo Feedback é bem-vindo!! 
<br><br>
![DarthVaderStarWarsGIF](https://github.com/user-attachments/assets/a059abc6-f553-4429-ad55-702a2e8087d1)




