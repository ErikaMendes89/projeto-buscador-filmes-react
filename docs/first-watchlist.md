# Sua primeira lista de filmes

[Voltar ao projeto](../README.md) · [Executar localmente](../README.md#executar-localmente)

O exercício usa o catálogo demonstrativo para mostrar o que o navegador consulta
e o que o PostgreSQL guarda para a sua conta.

## Consulte o catálogo

Suba o MovieMatch com `TMDB_API_TOKEN` vazio. Em outro terminal, busque um título
que faz parte dos dados de exemplo.

```bash
curl -fsS 'http://localhost:3333/api/movies?q=Interestelar'
```

A resposta traz `meta.catalogMode` igual a `"demo"` e o filme **Interestelar**
em `data`, com ID `157336`. Compare essa consulta com a mesma busca na interface.
Os dados do catálogo vêm do próprio projeto. Os pôsteres que a interface tenta
exibir são carregados do TMDB.

## Salve um filme na lista

1. Abra `http://localhost:5173`, clique em **Entrar** e depois em **Cadastre-se**.
   Crie uma conta local de teste com e-mail fictício e senha exclusiva de pelo
   menos 12 caracteres. A interface volta para a tela de login após o cadastro.
2. Entre na conta e busque **Interestelar**. No resultado, clique em **Quero assistir**.
3. Abra **Minha lista**. Mude o status do filme para **Assistido** e marque-o como
   favorito pelo coração. Use **Somente favoritos** para conferir que ele aparece
   com o novo status e continua sendo um único item na lista.
4. Recarregue a página. A lista continua mostrando o mesmo status e o favorito
   porque ambos foram gravados para a conta. Ao entrar com uma segunda conta de
   teste, você vê a lista dessa outra conta.

As listas começam privadas. Você pode conferir e mudar a visibilidade na própria
página **Minha lista**.

## Acompanhe a gravação no código

Na aba **Rede** das ferramentas do navegador, filtre por `interactions` e repita
a mudança de status. Você deve ver um `PUT /api/me/interactions/157336`. A leitura
da lista usa `GET /api/me/interactions`.

| Etapa | Onde olhar | O que observar |
| --- | --- | --- |
| Interface | [`App.tsx`](../apps/web/src/App.tsx) e [`api.ts`](../apps/web/src/api.ts) | A mudança chama `saveMyInteraction` com o filme, o status e o favorito. |
| Rota Express | [`movies.routes.ts`](../apps/api/src/modules/movies/movies.routes.ts) | A rota usa a identidade da sessão e valida os dados com Zod. |
| Serviço | [`movies.service.ts`](../apps/api/src/modules/movies/movies.service.ts) | `saveInteraction` delega a gravação ao repositório. |
| PostgreSQL | [`interactions.repository.ts`](../apps/api/src/modules/movies/interactions.repository.ts) e [migração inicial](../apps/api/sql/001_initial.sql) | A chave `(user_id, movie_id)` permite atualizar o mesmo item com `ON CONFLICT`. |

O [teste do repositório](../apps/api/src/modules/movies/interactions.repository.test.ts)
documenta dois resultados que você acabou de observar. Um filme pode ser favorito e
ter qualquer status, e a lista de uma conta permanece separada da outra.
