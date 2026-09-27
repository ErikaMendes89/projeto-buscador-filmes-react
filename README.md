# MovieMatch

Rede social de descoberta de filmes: encontre o que assistir, organize sua watchlist e descubra o que você e seus amigos gostam em comum.

> O projeto nasceu como um buscador React + MongoDB em 2024. A pasta `my-app/` preserva essa primeira versão; a arquitetura atual vive em `apps/`.

## Primeira entrega da evolução

- interface responsiva em React 19, TypeScript e Vite;
- catálogo e busca via TMDB, sem expor o token no navegador;
- catálogo demonstrativo quando nenhum token é configurado;
- API Node.js/Express modular e validada com Zod;
- PostgreSQL com modelo inicial de usuário e interações;
- estados preparados para `quero assistir`, `assistindo`, `assistido`, `abandonei` e `favorito`;
- atualização de watchlist sem recarregar a página;
- headers de segurança, CORS restrito e payload limitado;
- testes de API e interface;
- build, lint e testes automatizados no GitHub Actions.

## Arquitetura

```text
apps/web  (React + TypeScript + TanStack Query)
    │
    └── REST API
          │
          ├── TMDB (catálogo)
          └── PostgreSQL (dados sociais)
```

O backend é um monólito modular. Cada domínio possui rotas, serviços, contratos e repositórios próprios:

```text
apps/api/src/modules/
├── auth/       sessão e identidade autenticada
├── users/      perfis públicos
├── movies/     catálogo TMDB e interações
├── reviews/    notas e resenhas
└── social/     follows e feed
```

`container.ts` é a raiz de composição: instancia os repositórios e injeta as dependências nos serviços. As rotas não executam SQL diretamente. Microserviços só serão considerados se volume ou autonomia de times justificarem a separação.

## Executar localmente

Requisitos: Node.js 22+, npm 10+ e Docker.

```bash
cp .env.example .env
docker compose up -d
npm install
npm run db:migrate -w @moviematch/api
npm run dev
```

- Web: http://localhost:5173
- API: http://localhost:3333
- Health check: http://localhost:3333/health

O sistema abre com três filmes demonstrativos sem credenciais. Para usar o catálogo real, crie um token de leitura na TMDB e preencha `TMDB_API_TOKEN` no `.env`.

## Qualidade

```bash
npm run check
```

Esse comando valida os tipos, executa os testes e gera os builds de produção dos dois aplicativos.

## Endpoints iniciais

| Método | Rota | Uso |
|---|---|---|
| `GET` | `/health` | Saúde da API |
| `GET` | `/api/movies?q=&page=&year=&genre=` | Busca/descoberta paginada (gênero só na descoberta) |
| `GET` | `/api/movies/genres` | Gêneros do catálogo |
| `GET` | `/api/movies/:movieId` | Detalhes do filme |
| `GET` | `/api/me/interactions` | Listar filmes da própria conta (sessão obrigatória) |
| `PUT` | `/api/me/interactions/:movieId` | Incluir filme ou atualizar status/favorito da própria conta |
| `DELETE` | `/api/me/interactions/:movieId` | Remover filme da própria conta (sessão obrigatória) |
| `GET` | `/api/auth/session` | Sessão atual |
| `POST` | `/api/auth/register` | Solicitar cadastro (resposta genérica; depois, entrar pelo login) |
| `POST` | `/api/auth/login` | Iniciar sessão |
| `POST` | `/api/auth/logout` | Revogar a sessão atual |
| `POST` | `/api/auth/password-reset` | Solicitar recuperação sem revelar se o e-mail existe |
| `POST` | `/api/auth/password-reset/confirm` | Redefinir senha com token de uso único |
| `GET` | `/api/users/:username` | Perfil público (username, nome, bio e data de criação; sem ID, e-mail ou sessão) |
| `GET` | `/api/users/search?q=&page=` | Busca paginada de perfis por username (20 por página; sem ID ou e-mail) |
| `PUT` | `/api/users/me` | Editar nome, username e bio da conta autenticada |
| `GET/PUT/DELETE` | `/api/users/by-username/:username/follow` | Consultar, seguir ou deixar de seguir perfil (sessão obrigatória) |
| `GET` | `/api/users/:username/list` | Lista pública (retorna 404 se privada) |
| `GET` | `/api/users/:username/common` | Filmes em comum com uma lista pública (requer sessão) |
| `GET/PUT` | `/api/me/list-visibility` | Consultar ou alterar visibilidade da própria lista |
| `GET` | `/api/movies/:movieId/reviews` | Resenhas de um filme |
| `PUT` | `/api/movies/:movieId/reviews/me` | Publicar a própria resenha |
| `GET` | `/api/feed?page=1` | Feed paginado de resenhas próprias e de perfis seguidos com lista pública |
| `PUT/DELETE` | `/api/users/:userId/follow` | Seguir ou deixar de seguir |

O `PUT` recebe `{ "title": "...", "posterPath": null, "status": "want_to_watch", "isFavorite": false }`; os status válidos são `want_to_watch`, `watching`, `watched` e `abandoned`. `isFavorite` é opcional e, quando omitido numa atualização, o valor salvo é preservado. A combinação única por conta e filme transforma inclusões repetidas em atualização, sem criar duplicatas.

A conta local de demonstração permanece como dado inicial sem senha: não pode iniciar sessão e não é retornada como perfil público. Todas as operações pessoais usam o usuário resolvido pela sessão validada no backend; nenhum identificador de demonstração é enviado pelo cliente.

A recuperação cria token aleatório de uso único, guarda apenas o hash e expira em 30 minutos. A aplicação contém a interface `PasswordResetMailer`, mas o envio não está configurado por padrão. Para produção, escolha e configure um serviço transacional de e-mail (SMTP ou API), implemente o adaptador e remetente verificado; nunca registre senha, token ou URL de recuperação nos logs. A migration `007_password_reset_tokens.sql` precisa ser aplicada antes de habilitar o fluxo.

Listas são privadas por padrão. Tornar uma lista pública publica seus filmes, status e favoritos; notas e textos pessoais da lista não são expostos. Uma resenha publicada é pública na página do filme. No feed, seguidores veem as resenhas apenas enquanto a lista do autor estiver pública; o próprio autor continua vendo as suas.

## Roadmap

O roadmap abaixo resume a evolução planejada do produto.

- **v1.0 — fundação:** monorepo, TypeScript, Vite, API modular, PostgreSQL, Docker e CI.
- **v1.1 — identidade:** cadastro, login, sessões seguras e perfil.
- **v1.2 — diário de filmes:** avaliações, reviews e histórico.
- **v2.0 — social:** seguir pessoas, feed, curtidas, comentários e listas.
- **v2.1 — Movie Match:** compatibilidade e watchlists em comum.
- **v3.0 — recomendação:** recomendação híbrida e busca semântica.
- **v4.0 — produção:** observabilidade, proteção contra abuso e deploy.

## Decisões registradas

- PostgreSQL substitui MongoDB porque usuários, relações sociais, listas, reviews e interações formam um domínio relacional.
- O token da TMDB fica no backend; variáveis `VITE_*` são públicas e não devem conter segredos.
- A primeira versão permanece no repositório para mostrar a evolução técnica, mas não participa do workspace novo.
- IA e `pgvector` entram apenas depois de existirem dados e métricas que justifiquem recomendação personalizada.

Este produto usa a API da TMDB, mas não é endossado ou certificado pela TMDB.

## Licença

Este projeto é disponibilizado sob a [licença MIT](LICENSE). Você pode usar, copiar, modificar, distribuir, sublicenciar e vender cópias do software, preservando os avisos de copyright e o texto da licença. O software é fornecido sem garantia.

A licença deste repositório não se estende a marcas, dados, serviços, dependências ou outros materiais de terceiros, que permanecem sujeitos aos próprios termos.
