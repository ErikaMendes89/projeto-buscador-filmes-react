# MovieMatch

Rede social de descoberta de filmes: encontre o que assistir, organize sua watchlist e descubra o que você e seus amigos gostam em comum.

> O projeto nasceu como um buscador React + MongoDB em 2024. A pasta `my-app/` preserva essa primeira versão. A arquitetura atual vive em `apps/`.

## Comece pelo catálogo demonstrativo

Use o [guia da primeira lista de filmes](docs/first-watchlist.md) para buscar
um dos títulos de exemplo, salvá-lo na sua lista e seguir a gravação até o
PostgreSQL. O catálogo demonstrativo funciona com `TMDB_API_TOKEN` vazio.

## O que existe hoje

| Área | O que você pode usar |
| --- | --- |
| Catálogo | Busca por título, descoberta com filtros e detalhes de filmes via TMDB ou dados demonstrativos. |
| Conta e lista pessoal | Cadastro, login e perfil público. A lista começa privada e permite salvar filmes, mudar o status e marcar favoritos de forma independente. |
| Comunidade | Resenhas públicas, busca por username, seguir e bloquear perfis, feed de resenhas e filmes em comum com listas públicas. |
| Conversas | Chat individual por WebSocket, histórico, marcação de leitura e compartilhamento de filmes. Enviar mensagens exige que os dois perfis se sigam e que nenhum tenha bloqueado o outro. |

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
└── social/     follows, feed, bloqueios e conversas
```

[`container.ts`](apps/api/src/container.ts) instancia os repositórios e injeta as dependências nos serviços. As rotas validam a entrada, os serviços aplicam as regras do domínio e os repositórios cuidam do SQL. Microserviços só serão considerados se volume ou autonomia de times justificarem a separação.

## Executar localmente

Use Node.js 22.12+, npm 10+ e Docker com Compose. O primeiro exercício parte
de um volume PostgreSQL novo. Na raiz do clone, crie o `.env` se precisar e
mantenha `TMDB_API_TOKEN` vazio para usar o catálogo demonstrativo.

```bash
test -f .env || cp .env.example .env
docker compose up -d postgres
npm ci
```

Na primeira inicialização do volume, o [Compose](docker-compose.yml) executa
os arquivos SQL de `apps/api/sql/`. Confirme que o banco aceita conexões TCP
antes de iniciar a API.

```bash
docker compose exec -T postgres sh -c 'pg_isready -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

Quando o comando mostrar `accepting connections`, inicie os aplicativos.

```bash
npm run dev
```

- Interface em `http://localhost:5173`.
- API em `http://localhost:3333`.
- Health check da API em `http://localhost:3333/health`.

Para um volume novo no Windows, use o [script PowerShell](local.ps1) com
`./local.ps1 -SkipMigrations`. O parâmetro deixa a inicialização do esquema
a cargo do PostgreSQL do Compose.

Em bancos preparados pelo [script de migrations](apps/api/src/scripts/migrate.ts),
`npm run db:migrate -w @moviematch/api` aplica os arquivos que ainda não constam
no histórico de migrations. Para usar o catálogo real, preencha `TMDB_API_TOKEN` no
`.env` com um token de leitura da TMDB e reinicie a API.

## Qualidade

```bash
npm run check
```

Esse comando valida os tipos, executa os testes e gera os builds de produção dos dois aplicativos.

## Endpoints principais

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
| `GET/PUT/DELETE` | `/api/movies/:movieId/reviews/me` | Consultar, publicar ou remover a própria resenha |
| `GET` | `/api/feed?page=1` | Feed paginado de resenhas próprias e de perfis seguidos com lista pública |
| `PUT/DELETE` | `/api/users/:userId/follow` | Seguir ou deixar de seguir |
| `GET/PUT/DELETE` | `/api/users/by-username/:username/block` | Consultar, bloquear ou desbloquear um perfil (sessão obrigatória) |
| `GET/POST` | `/api/conversations` | Listar conversas ou abrir uma conversa individual (sessão obrigatória) |
| `GET` | `/api/conversations/:conversationId/messages` | Consultar o histórico paginado de uma conversa (sessão obrigatória) |
| `POST` | `/api/conversations/:conversationId/messages/read` | Marcar mensagens como lidas (sessão obrigatória) |

O `PUT /api/me/interactions/:movieId` recebe um corpo como
`{ "title": "Interestelar", "posterPath": null, "status": "want_to_watch", "isFavorite": false }`.
Os estados válidos são `want_to_watch`, `watching`, `watched` e `abandoned`.
`isFavorite` é opcional. Omitir esse campo em uma atualização preserva o valor
anterior. A combinação única por conta e filme transforma inclusões repetidas em
atualização, mantendo uma linha por filme na lista de cada conta.

A conta local de demonstração permanece como dado inicial sem senha: não pode iniciar sessão e não é retornada como perfil público. Todas as operações pessoais usam o usuário resolvido pela sessão validada no backend; nenhum identificador de demonstração é enviado pelo cliente.

A recuperação cria token aleatório de uso único, guarda apenas o hash e expira em 30 minutos. A aplicação contém a interface `PasswordResetMailer`, mas o envio não está configurado por padrão. Para produção, escolha e configure um serviço transacional de e-mail (SMTP ou API), implemente o adaptador e remetente verificado; nunca registre senha, token ou URL de recuperação nos logs. A migration `007_password_reset_tokens.sql` precisa ser aplicada antes de habilitar o fluxo.

Listas são privadas por padrão. Tornar uma lista pública publica seus filmes, status e favoritos; notas e textos pessoais da lista não são expostos. Uma resenha publicada é pública na página do filme. No feed, seguidores veem as resenhas apenas enquanto a lista do autor estiver pública; o próprio autor continua vendo as suas.

## Roadmap

- **Evoluir a comunidade.** Curtidas e comentários em resenhas, além de mais recursos de compatibilidade entre perfis.
- **Investigar recomendações.** Experimentar busca semântica e recomendação híbrida quando houver dados e métricas para avaliá-las.
- **Preparar a operação em produção.** Configurar o serviço de e-mail da recuperação de senha, ampliar observabilidade e proteção contra abuso e preparar o deploy.

## Decisões registradas

- PostgreSQL substitui MongoDB porque usuários, relações sociais, listas, reviews e interações formam um domínio relacional.
- O token da TMDB fica no backend; variáveis `VITE_*` são públicas e não devem conter segredos.
- A primeira versão permanece no repositório para mostrar a evolução técnica, mas não participa do workspace novo.
- IA e `pgvector` entram apenas depois de existirem dados e métricas que justifiquem recomendação personalizada.

Este produto usa a API da TMDB, mas não é endossado ou certificado pela TMDB.

## Licença

Este projeto é disponibilizado sob a [licença MIT](LICENSE). Você pode usar, copiar, modificar, distribuir, sublicenciar e vender cópias do software, preservando os avisos de copyright e o texto da licença. O software é fornecido sem garantia.

A licença deste repositório não se estende a marcas, dados, serviços, dependências ou outros materiais de terceiros, que permanecem sujeitos aos próprios termos.
