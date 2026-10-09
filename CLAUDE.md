# FinanceOS: contexto para agentes

App de finanças pessoais do dono (João Alberto, designer, pouco de backend; Windows + PowerShell). Responder **sempre em português**, explicar decisões em linguagem simples e escrever passo a passo para o que for operacional.

## Estrutura

- `web/`: React 19 + Vite + TypeScript. Netlify (`netlify.toml` na raiz aponta `base = "web"`).
  - `src/model/`: toda a regra de negócio, sem React (tipos, migração dos dados antigos, contas do mês, preparo do mês, mescla entre aparelhos, categorias). Testes em `model.test.ts` (`npm test`, usa o Node com `--experimental-strip-types`, por isso os imports do modelo levam `.ts`).
  - `src/data.tsx`: carrega e salva na API (versão + mescla de 3 vias em conflito). `src/ui.tsx`: contexto do mês/página e ações com "Desfazer". `src/components/Shell.tsx`: casco do app e todas as janelas.
  - `src/components/Entrada.tsx`: telas de login copiadas do Trackik e adaptadas.
- `api/`: Node 22 + Express 5 + pg (JavaScript ESM, sem build). Railway com Root Directory `api`. `src/app.js` recebe banco e verificador por parâmetro (testes usam `memoryStore` e chaves locais). Testes: `npm test`.

## Decisões (não reabrir sem motivo)

- **Login pelo Authik** (`../authik`, SDK em `web/vendor/*.tgz`, mesma versão do Trackik). Token curto só na memória; API confere com `jose` (`api/src/auth.js`, cópia do `account.ts` do Trackik). Nada de dado financeiro no `localStorage`.
- **Um JSON por conta** (`user_state.data`, um mês por chave `AAAA-MM`) com `version` para concorrência otimista. Os nomes dos campos vêm da versão 1 (`planejado`, `realizado`, `autoReplicar`…) para os dados antigos continuarem valendo; `migrate.ts` normaliza tudo ao carregar.
- Navegar entre meses **não cria nem copia nada**. Mês novo só nasce com um lançamento ou pelo "Preparar/Fechar mês".
- Aportes: `origem` (`conta`/`externo`) + `status` (`feito`/`previsto`). Sobra prevista desconta aportes da conta; "Na conta" só os feitos.
- Cores das séries dos gráficos validadas para daltonismo (renda `#1BAF7A`, despesas `#EB6834`); a tabela em Relatórios é a alternativa acessível.

## Estado (09/10/2026)

Versão 2 feita na branch `claude/v2-authik`: reescrita do site, API movida para cá (antes `../financeos-api`), login trocado do Clerk para o Authik. Validado com prévia local (API real com banco em memória e login simulado). **Falta publicar** seguindo o README: site em `finance.joaoa.com.br` e login em `auth.finance.joaoa.com.br` (subdomínios do site pessoal, decisão do dono em 09/10/2026; sem domínio próprio) e mover os dados do ID do Clerk para o ID do Authik (`npm run contas -- mover`).

Como trabalhar: branch nova, PR, merge só com autorização do dono.
