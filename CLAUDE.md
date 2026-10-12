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
- **Versões anteriores** (`user_state_history`, 30 dias): a API copia a versão de antes no máximo a cada 6 h e sempre que o site manda `checkpoint: true` (importar, limpar mês, restaurar) ou em "Apagar tudo". Conta excluída no Authik apaga também o histórico (`store.purge`).
- **Parcelas**: `Despesa.parcela = { n, de, grupo }`, uma despesa por mês criada de uma vez (é a exceção ao "mês só nasce com lançamento": a parcela é o lançamento). Parcelas não entram no Preparar mês.
- **Limites por categoria**: `Mes.orcamentos` (categoria → R$). Mês sem limites próprios herda os do anterior mais recente que tenha (`limitesDoMes`); `{}` = sem limites dali em diante.

## Estado (11/10/2026)

No ar desde 09/10/2026: site em `finance.joaoa.com.br` (Netlify), login em `auth.finance.joaoa.com.br` (Authik), API no Railway. O dono começou do zero (sem migrar dados do Clerk). Instalável como app (manifesto + ícones PNG em `web/public`).

Como trabalhar: branch nova, PR, merge só com autorização do dono.
