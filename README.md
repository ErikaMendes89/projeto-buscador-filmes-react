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

O backend é um monólito modular. Microserviços só serão considerados se volume ou autonomia de times justificarem a separação.

## Executar localmente

Requisitos: Node.js 22+, npm 10+ e Docker.

```bash
cp .env.example .env
docker compose up -d
npm install
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
| `GET` | `/api/movies?q=` | Descoberta e busca de filmes |
| `GET` | `/api/me/interactions` | Interações do perfil atual |
| `PUT` | `/api/me/interactions/:movieId` | Criar ou atualizar interação |
| `DELETE` | `/api/me/interactions/:movieId` | Remover interação |

Nesta fundação existe um usuário local de demonstração. Autenticação substituirá esse identificador fixo no próximo marco; ele não é uma solução de produção.

## Roadmap

- **v1.0 — fundação:** monorepo, TypeScript, Vite, API, PostgreSQL, Docker e CI.
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

