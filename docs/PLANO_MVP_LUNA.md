# MovieMatch — planejamento e checklist de entrega para Luna

## Objetivo

Entregar uma primeira versão viável em que uma pessoa consiga criar conta, encontrar filmes reais, organizar sua lista, descobrir outras pessoas, compartilhar filmes e listas com amigos e conversar por chat individual.

Responsável pela execução: **Luna**. Este documento orienta a implementação futura; caixas desmarcadas representam trabalho ainda não validado. Criar este plano não autoriza publicação, contratação de serviços, commit ou push automático.

## Ponto de partida

O projeto tem React/TypeScript em `apps/web`, API Express modular em `apps/api` e PostgreSQL via Docker. Existem módulos de autenticação, usuários, filmes, avaliações e social, mas sua presença não significa que os fluxos estejam completos. A identidade ainda é demonstrativa; a interface possui indicadores fixos e links para seções. O catálogo tem integração TMDB e demonstração sem token. A pasta `my-app/` preserva a versão antiga e não é a base desta entrega.

Luna deve conferir o código e os testes antes de aproveitar cada recurso. Preservar as alterações locais existentes, inclusive a correção dos pôsteres demonstrativos.

## Escopo e decisões propostas

As regras abaixo são propostas para limitar o MVP, não funcionalidades já implementadas. Registrar ajustes antes de construir a etapa correspondente.

| Tema | Regra proposta para o MVP |
| --- | --- |
| Identidade | Cadastro por e-mail e senha; username único; sessão persistida e revogável |
| Perfil | Nome, username, bio e avatar por iniciais; upload de foto pode ficar para depois |
| Lista | Uma lista pessoal com status de visualização e favorito independente |
| Privacidade | Lista privada por padrão; publicação voluntária; avaliações publicadas são públicas no perfil e no feed; e-mail nunca público |
| Comunidade | Seguir pessoas, sem solicitação formal de amizade |
| Chat | Conversas individuais de texto entre pessoas que se seguem mutuamente |
| Bloqueio | Impede novas mensagens e interação social; histórico acessível apenas aos participantes |
| Compartilhamento | Link de filme, perfil e lista pública; lista privada permanece inacessível por link |
| Avaliações públicas | A nota e o texto ficam públicos na página do filme quando a pessoa publica a resenha; resenhas de pessoas seguidas podem aparecer no feed, independentemente da lista |
| Compatibilidade | Mostrar quantidade real de filmes em comum; sem porcentagem inventada |

Fora desta entrega: grupos, anexos, chamadas, pagamentos, login social, listas colaborativas, comentários e curtidas sociais, recomendação por IA e algoritmo percentual de match.

## Ordem de execução

1. Preparação e contratos.
2. Login e perfil.
3. Buscador e detalhes.
4. Minha lista e avaliações.
5. Comunidade e compartilhamento.
6. Chat individual.
7. Validação integrada e preparação de publicação.

Segurança, testes e acessibilidade fazem parte de cada etapa. O chat depende de identidade, relações sociais e bloqueios funcionais. A primeira entrega parcial reúne etapas 1–4; o MVP solicitado só está completo com todas as etapas aceitas.

## 1. Preparação e contratos

- [x] **PRE-01** Ler as instruções locais, verificar `git status`, examinar os módulos, migrations, scripts e testes; registrar o que existe e o que falta.
- [x] **PRE-02** Executar `npm run check` como linha de base e registrar falhas preexistentes sem atribuí-las às mudanças novas.
- [x] **PRE-03** Definir contratos de dados, paginação, erros e autorização das novas operações, respeitando rotas → serviços → repositórios.
- [x] **PRE-04** Planejar migrations incrementais, índices, restrições de unicidade e recuperação em caso de falha. Revisar cada migration antes de executar; preservar dados existentes.
- [x] **PRE-05** Preparar configuração documentada para desenvolvimento e testes sem expor credenciais ou sobrescrever `.env` existente.
- [x] **PRE-06** Criar navegação real para descoberta, detalhes, minha lista, comunidade, perfil, login e chat; garantir funcionamento de links diretos e botão voltar.

**Aceite:** ambiente reproduzível, situação inicial registrada e contratos suficientes para implementar a primeira etapa sem inventar regras durante a execução.

## 2. Login e perfil

- [x] **AUTH-01** Implementar cadastro com validação, normalização e unicidade de e-mail e username; armazenar senha com hash apropriado.
- [x] **AUTH-02** Implementar login, consulta de sessão e logout; usar cookies HttpOnly, Secure em produção e política SameSite adequada, com proteção CSRF quando aplicável.
- [x] **AUTH-03** Definir expiração e revogação de sessões; limitar tentativas de autenticação e evitar enumeração de contas nas respostas.
- [x] **AUTH-04** Implementar recuperação de senha com token de uso único e prazo curto; não registrar senha ou token em logs. Preparar entrega por e-mail e documentar o serviço necessário para produção.
- [x] **AUTH-05** Substituir o identificador demonstrativo pela sessão autenticada em todas as operações pessoais; impedir identidade demonstrativa em produção.
- [ ] **AUTH-06** Criar telas de cadastro, login e recuperação, com erros claros e retorno à página desejada após login.
- [x] **PROFILE-01** Criar edição do próprio nome, username e bio, avatar por iniciais e página pública sem e-mail ou informações da sessão.
- [x] **PROFILE-02** Implementar configuração de visibilidade da lista e garantir sua aplicação no backend.
- [ ] **AUTH-07** Testar contas distintas, senha incorreta, logout, sessão expirada, recuperação reutilizada e tentativa de editar perfil alheio.

**Aceite:** duas pessoas entram em contas diferentes, mantêm sessão ao atualizar a página e não acessam nem alteram dados privados uma da outra.

## 3. Buscador e detalhes de filmes

- [x] **MOV-01** Configurar token TMDB exclusivamente no backend; identificar visualmente o modo demonstrativo quando não houver token.
- [x] **MOV-02** Completar descoberta e busca por título com paginação, filtros por gênero/ano e parâmetros na URL; verificar suporte da TMDB antes de definir as consultas.
- [x] **MOV-03** Implementar detalhes com título, pôster, sinopse, lançamento, gêneros e avaliação do catálogo, distinguindo-a das notas dos usuários.
- [x] **MOV-04** Tratar falta de pôster e falha de carregamento da imagem; manter alternativas acessíveis.
- [x] **MOV-05** Tratar indisponibilidade, timeout e limites da TMDB sem expor informações internas; evitar respostas de buscas antigas substituindo buscas novas.
- [x] **MOV-06** Implementar ações de salvar filme e compartilhar seu link; direcionar visitantes ao login quando a ação exigir conta.
- [x] **MOV-07** Testar busca, filtros, paginação, resultado vazio, erro externo e filme sem imagem, usando respostas controladas nos testes automatizados.

**Aceite:** com credencial configurada, uma pessoa encontra filmes reais, abre detalhes por link direto e salva um filme. A demonstração continua utilizável sem credencial.

## 4. Minha lista e avaliações

- [x] **LIST-01** Separar favorito do status de visualização. Definir e documentar a conversão de registros antigos com status `favorite`, preservando favoritos e sem presumir que foram assistidos.
- [x] **LIST-02** Completar inclusão, consulta, alteração de status e remoção de filmes da própria lista, impedindo duplicação por usuário e filme.
- [x] **LIST-03** Criar página Minha lista com filtros por status/favoritos e estados de carregamento, vazio e erro.
- [x] **LIST-04** Atualizar o cache da interface após mutações; em falhas, restaurar estado otimista se utilizado e permitir tentar novamente.
- [x] **REVIEW-01** Completar criação, edição e remoção da própria nota/resenha; definir escala única e limites de texto consistentes entre banco, API e interface.
- [x] **LIST-05** Aplicar visibilidade em todos os acessos à lista, inclusive links, feed e filmes em comum; estabelecer quais avaliações são públicas na interface de publicação.
- [ ] **LIST-06** Testar persistência após novo login, isolamento entre contas, migração de favoritos e alterações concorrentes da mesma entrada.

**Aceite:** lista e avaliações persistem entre sessões; um filme pode ser assistido e favorito ao mesmo tempo; listas privadas são inacessíveis por link e não alimentam filmes em comum; somente avaliações publicadas são públicas.

## 5. Comunidade e compartilhamento

- [ ] **SOC-01** Criar busca paginada de pessoas por username, página de perfil e ações de seguir/deixar de seguir.
- [ ] **SOC-02** Impedir seguir a si mesmo e duplicar relações; mostrar contagens calculadas a partir dos dados reais.
- [ ] **SOC-03** Criar feed paginado das pessoas seguidas, respeitando a visibilidade atual e removendo acesso quando ela mudar.
- [ ] **SOC-04** Mostrar filmes em comum apenas quando a consulta for autorizada; remover indicadores fixos da interface.
- [ ] **SHARE-01** Criar links estáveis para filmes, perfis e lista pública, com copiar link e compartilhamento nativo quando suportado.
- [ ] **SHARE-02** Garantir que links diretos funcionem ao abrir em outra aba ou navegador e que falhas de cópia sejam informadas.
- [ ] **SOC-05** Implementar bloquear/desbloquear com checagem no backend para follows, feed e chat; definir se o desbloqueio exige seguir novamente.
- [ ] **SOC-06** Implementar denúncia com motivo, armazenamento restrito e procedimento documentado de triagem por responsável; não disponibilizar denúncias a outros usuários.
- [ ] **SOC-07** Testar compartilhamento como visitante, lista privada, mudança de visibilidade, bloqueio e paginação do feed.

**Aceite:** duas pessoas se encontram e se seguem; um link público abre para o destinatário, um privado permanece protegido e o feed mostra atividades reais autorizadas.

## 6. Chat individual

- [ ] **CHAT-01** Modelar conversas, participantes, mensagens e leitura, com índices e restrição que evite conversas individuais duplicadas para o mesmo par.
- [ ] **CHAT-02** Implementar criação e listagem de conversas e histórico paginado, sempre verificando a participação do usuário.
- [ ] **CHAT-03** Adicionar comunicação em tempo real à API existente, justificando eventual dependência e autenticando a conexão.
- [ ] **CHAT-04** Validar sessão, bloqueios e seguimento mútuo ao enviar cada mensagem; permitir consultar histórico aos participantes após deixar de seguir.
- [ ] **CHAT-05** Persistir antes de confirmar entrega; usar identificador de envio para evitar duplicação em reenvios e reconexões.
- [ ] **CHAT-06** Criar interface de conversas, mensagens, envio pendente/falhou e não lidas; oferecer nova tentativa sem perder o texto.
- [ ] **CHAT-07** Implementar reconexão com recuperação de mensagens perdidas e leitura sem inconsistência entre abas.
- [ ] **CHAT-08** Permitir compartilhar filme na conversa usando referência validada e link para detalhes.
- [ ] **CHAT-09** Limitar tamanho e frequência de mensagens; renderizar texto sem executar HTML e não registrar conteúdo privado nos logs operacionais.
- [ ] **CHAT-10** Testar duas contas em tempo real, terceiro sem acesso, sessão revogada, bloqueio durante conexão ativa, reenvio duplicado e recuperação após desconexão.

**Aceite:** duas contas elegíveis trocam mensagens sem atualizar a página, recuperam o histórico ao entrar novamente e não recebem duplicatas após reconexão. Terceiros não leem nem enviam mensagens na conversa.

## 7. Validação integrada e entrega

- [ ] **REL-01** Executar `npm run check` e os testes integrados adicionados; registrar comandos, resultados e limitações reais.
- [ ] **REL-02** Validar em dois navegadores/contas: cadastrar → entrar → buscar filme → salvar → avaliar → seguir mutuamente → compartilhar → conversar → sair e entrar novamente.
- [ ] **REL-03** Testar visitantes e tentativas de acessar identificadores de outra conta em perfis privados, listas, avaliações e conversas.
- [ ] **REL-04** Validar celular e desktop, navegação por teclado, rótulos acessíveis, foco, carregamento e erros nas páginas principais.
- [ ] **REL-05** Verificar consultas e índices com dados representativos; garantir paginação de catálogo, usuários, feed e mensagens.
- [ ] **REL-06** Revisar vulnerabilidades das dependências e resolver as relevantes à entrega; registrar pendências com impacto e justificativa.
- [ ] **REL-07** Preparar instruções de configuração e publicação: domínio, HTTPS, origens permitidas, cookies, WebSocket, banco, migrations e segredos fora do repositório.
- [ ] **REL-08** Preparar backup e restauração do banco e verificar restauração em ambiente isolado; documentar rollback da aplicação e limitações de rollback das migrations.
- [ ] **REL-09** Configurar logs operacionais sem segredos ou mensagens privadas, verificação de saúde e procedimento de diagnóstico.
- [ ] **REL-10** Entregar resumo dos arquivos alterados, evidências de teste, problemas, riscos e pendências; obter autorização específica antes de publicar.
- [ ] **REL-11** Após autorização e disponibilidade dos serviços, publicar e repetir o fluxo essencial no ambiente de destino.

**Aceite:** fluxos completos validados, sem falhas conhecidas de isolamento de contas ou perda de mensagens/listas. Distinguir no relatório “pronto para publicar” de “publicado e validado”.

## Dependências externas e decisões de entrega

- [ ] Disponibilizar credencial TMDB por canal seguro para validar o catálogo real.
- [ ] Definir serviço/remetente de e-mail para recuperação de senha em produção.
- [ ] Definir hospedagem compatível com a API, WebSocket e PostgreSQL, domínio e custos antes de contratar ou publicar.
- [ ] Definir responsável por denúncias e operação, além de política de privacidade e retenção de dados antes da abertura pública.

Luna deve avançar nas tarefas independentes enquanto essas dependências são resolvidas. Não marcar integração externa ou publicação como concluída usando apenas demonstrações ou mocks.

## Como Luna deve acompanhar a execução

- Executar mudanças pequenas por etapa, lendo arquivos relacionados e preservando a arquitetura existente.
- Marcar `[x]` somente após implementar e verificar o critério correspondente.
- Registrar decisões de produto, dependências justificadas e mudanças de contrato neste documento.
- Testar regressões relevantes, especialmente acesso entre contas, privacidade, migrations e concorrência no chat.
- Nunca registrar credenciais neste documento ou nas evidências.
- Não executar operações destrutivas, commit ou push sem autorização explícita.
- Ao concluir uma etapa, preencher o registro abaixo e continuar pelas dependências estabelecidas.

| Etapa | Estado | Evidência de aceite | Pendências |
| --- | --- | --- | --- |
| 1. Preparação | Implementada localmente | Links SPA, rotas diretas para descoberta, filmes, lista, comunidade, perfil, login e chat; botão voltar e histórico do navegador cobertos por teste | O chat permanece informativo até CHAT-01 |
| 2. Login e perfil | Parcial | Cadastro retorna resposta genérica; sessões expiram em 30 dias e são revogáveis; login limitado a 10 tentativas por IP em 15 minutos e cadastro a 5; recuperação com token de uso único, edição autenticada do perfil e operações pessoais vinculadas à sessão | Provedor de e-mail para produção e retorno à página original após login |
| 3. Buscador | Implementado localmente; revalidado em 24/09/2026 | `npm run check` passou: lint, 19 testes de API, 4 testes web e builds de API/web; `git diff --check` limpo | Credencial TMDB e validação de respostas reais do provedor |
| 4. Minha lista | Parcial | LIST-01 a LIST-05 implementados; lista privada por padrão com controle de publicação | LIST-06 |
| 5. Comunidade | A executar | — | — |
| 6. Chat | A executar | — | — |
| 7. Entrega | A executar | — | Serviços e autorização de publicação |

### Registro da preparação

- **PRE-01:** API modular com rotas, serviços e repositórios; migrations incrementais `001_initial.sql` e `002_reviews_and_social.sql`; testes de serviço e HTTP; interface React de página única. Autenticação ainda usa `DEMO_USER_ID`, não há cadastro nem sessões. `movie_interactions.status` mistura `favorite` com estados de visualização. Há mudanças locais em `.gitignore`, `README.md`, `apps/api/src/app.test.ts` e `apps/api/src/modules/movies/tmdb.client.ts`; foram preservadas.
- **PRE-02:** `npm run check` passou: lint TypeScript, 8 testes e builds de API e web. No sandbox restrito, os testes HTTP falharam porque o Supertest não pôde abrir uma porta (`EPERM`); a mesma checagem passou fora do sandbox com a permissão de rede local.
- **Contratos para AUTH:** cadastro recebe `email`, `username`, `displayName` e `password`; e-mail é trimado e normalizado para minúsculas, username para minúsculas e validado como `[a-z0-9_]{3,40}`. Senha de 12 a 128 caracteres, armazenada com `scrypt` e salt aleatório. Sessão opaca aleatória, token armazenado somente como hash, expiração absoluta de 30 dias e revogação no logout. Cookie `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` em produção. Escritas autenticadas aceitam apenas origem `WEB_ORIGIN`; respostas de login genéricas não revelam se a conta existe. E-mail não é exposto no perfil público.
- **AUTH-03:** sessões têm expiração absoluta de 30 dias validada na consulta, e logout revoga o token no banco. Login é limitado a 10 chamadas por IP em 15 minutos; cadastro, a 5 no mesmo período. O limite inclui chamadas bem-sucedidas. Respostas limitadas usam `429`, código genérico `rate_limited` e `Retry-After`. O contador fica em memória do processo Express e não coordena múltiplas instâncias; produção horizontal precisa de armazenamento compartilhado. Login usa a mesma resposta para e-mail inexistente e senha incorreta. Cadastro responde sempre com `202` e texto idêntico para criação e conflito de unicidade, sem iniciar sessão; a pessoa entra pelo fluxo normal de login. Falhas técnicas não relacionadas a unicidade continuam sendo erros.
- **AUTH-04:** pedido de recuperação responde `202` com mensagem idêntica para conta existente e inexistente, limitado a 5 pedidos por IP em 15 minutos. Tokens aleatórios de 256 bits são armazenados apenas como SHA-256, expiram em 30 minutos e só podem ser consumidos uma vez. O consumo, a troca do hash de senha e a revogação de todas as sessões ocorrem na mesma transação. A interface envia o token no fragmento da URL, remove-o do histórico visível ao abrir e não o renderiza. Nenhum log inclui e-mail, senha, token ou URL; falhas de entrega geram apenas mensagem operacional genérica. `PasswordResetMailer` é o ponto de integração; o adaptador runtime está desabilitado até a escolha/configuração de um serviço transacional SMTP/API com remetente verificado. O adaptador de produção deve enfileirar o envio de forma durável. A migration `007_password_reset_tokens.sql` foi revisada, mas não executada: o migrador aplica todas as pendentes e inclui uma migration anterior com `DROP TYPE`, que exige revisão/ação separada.
- **Migrações:** adicionar colunas e tabela em migration nova, sem alterar migrations já aplicadas; unicidade permanece protegida no banco. A migration de sessões cria índice por hash e expiração, sem remover a conta demonstrativa nem converter favoritos.
- **Configuração:** `.env.example` documenta as variáveis não secretas e valores locais. `.env` já existe e não foi lido nem alterado. Token real TMDB e serviço de e-mail seguem como dependências externas.
- **PRE-06:** implementado localmente. Links internos usam History API com suporte a voltar/avançar e links diretos. `/community` mostra o feed existente; `/users/:username` exibe perfil público; `/login` abre login/cadastro; `/chat` é uma página informativa aguardando CHAT-01. As rotas já existentes de descoberta, detalhes, Minha lista e lista pública continuam diretas. Teste web verifica rota direta, navegação de retorno e `popstate`.
- **AUTH-01/02/05:** implementados. `scrypt` usa salt aleatório; sessão usa token aleatório e apenas seu SHA-256 é armazenado. Todas as operações pessoais obtêm o ator de `response.locals.userId` após `requireSession`; o frontend não envia ID de usuário para essas operações. Contas sem `password_hash`, incluindo a conta demonstrativa sem senha, não autenticam nem aparecem como perfil público. Testes de rotas verificam o escopo de filmes, resenhas, feed, seguir e perfil; testes de repositório verificam a exclusão da identidade demonstrativa. A migration `003_auth_sessions.sql` foi aplicada ao PostgreSQL local existente.
- **AUTH-06:** login e cadastro estão disponíveis na interface; recuperação de senha e retorno à página anterior após login ainda faltam.
- **PROFILE-01:** `PUT /api/users/me` obtém o ID somente da sessão validada, atualiza username/nome/bio e trata colisão de username sem expor dados de outra conta. O perfil público retorna apenas username, nome, bio e data de criação, sem ID, e-mail, hash de senha ou dados de sessão. A interface permite editar somente quando o username do perfil corresponde ao usuário autenticado; o avatar usa as iniciais do nome e acompanha sua alteração. Bio limitada a 280 caracteres, consistente com a coluna existente; username normalizado para minúsculas e validado como no cadastro.
- **Estado:** `AUTH-06` e `AUTH-07` continuam pendentes; `AUTH-03`, `AUTH-04`, `AUTH-05`, `PROFILE-01` e `PROFILE-02` foram concluídos. Os marcadores não representam um MVP completo.
- **MOV-01/02:** token permanece exclusivamente na API. A TMDB documenta busca por título com `page` e `primary_release_year`, e descoberta com `page`, `with_genres` e `primary_release_year`. Como busca por título não oferece `with_genres`, gênero é filtro de descoberta e a API rejeita explicitamente a combinação `q` + `genre`; ano pode ser combinado com busca por título. Filtros e página ficam na URL.
- **MOV-03/04/06:** detalhe público em `/movies/:movieId`, gêneros e nota do catálogo identificada como TMDB; cartões e detalhe oferecem fallback acessível de pôster. Salvar exige sessão; compartilhar usa Web Share quando disponível e cópia do link como alternativa.
- **MOV-05/07:** chamadas à TMDB têm timeout de 8 segundos. Respostas não-OK, malformadas ou falhas de rede resultam em `503 catalog_unavailable`, sem repassar detalhes do provedor. As consultas da interface usam chave por filtro e `AbortSignal` para impedir que resultados antigos substituam os atuais.
- **Limite da validação MOV:** em 24/09/2026, `npm run check` passou com 23 testes (19 API, 4 web), lint e builds de API/web; `git diff --check` também passou. Integração real com TMDB não foi exercitada; depende de credencial configurada. Respostas controladas cobrem paginação/filtros, busca vazia, detalhe, timeout, resposta inválida e indisponibilidade; o catálogo demonstrativo foi exercitado localmente. Nenhum deploy foi feito.
- **LIST-01:** `movie_interactions.is_favorite` agora é independente do `status`, cujo enum só mantém `want_to_watch`, `watching`, `watched` e `abandoned`. A migration `004_separate_movie_favorites.sql` converte registros antigos `favorite` para `status = want_to_watch` e `is_favorite = true`; não presume que foram assistidos. O campo favorito é opcional em atualizações de status e, quando omitido, o repositório preserva o valor existente. Migration aplicada ao PostgreSQL local em 24/09/2026. Validação em schema isolado dentro de transação revertida confirmou conversão do favorito, preservação de `watched` e remoção do rótulo antigo; a consulta ao banco local encontrou duas entradas `want_to_watch` não favoritas e nenhuma linha legada `favorite`. `npm run check` passou com 25 testes (21 API, 4 web), lint e builds. Rollback exige backup/restauração ou conversão manual: a migration é transacional na aplicação, mas reversão após commit não consegue distinguir favoritos migrados de favoritos novos.
- **LIST-02:** consulta, upsert e remoção continuam atrás da sessão e todas as queries recebem o `userId` resolvido no backend; `PRIMARY KEY (user_id, movie_id)` impede duplicação dentro de uma conta, permitindo o mesmo filme em contas diferentes. Atualizar o status preserva `is_favorite` quando omitido. `npm run check` passou com 28 testes (22 API, 6 web), lint e builds. Um teste de integração no PostgreSQL local, executado com duas contas e dentro de transação revertida, confirmou inclusão, alteração de status, ausência de duplicatas, isolamento e remoção. Nenhuma migration nova foi necessária. A interface de gerenciamento está registrada em LIST-03.
- **LIST-03:** página direta `/my-list`, link de navegação responsivo e consulta condicionada à sessão autenticada. Inclui filtros combináveis por status/favorito, contagem, links de detalhes, alteração de status, alternância de favorito, remoção e mensagens para visitante, carregamento, erro recuperável, lista vazia e filtros sem resultados. `npm run check` passou com 32 testes (22 API, 10 web), lint e builds. `git diff --check` passou. A validação de layout foi automatizada no ambiente web local; não foi feita revisão visual em dispositivos físicos.
- **LIST-04:** inclusão/atualização e remoção atualizam diretamente o cache React Query da conta ativa a partir da resposta persistida; as operações da página, descoberta e detalhes usam os mesmos helpers e chave `['my-interactions', userId]`. Não há atualização otimista, então uma falha não altera o cache; controles permanecem disponíveis e mostram retentativa explícita. `npm run check` passou com 33 testes (22 API, 11 web), lint e builds. Teste web cobre falha sem alteração do favorito no cache e sucesso na segunda tentativa.
