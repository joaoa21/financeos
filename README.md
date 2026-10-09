# FinanceOS

Finanças pessoais do mês: contas a pagar e a receber, quanto vai sobrar, investimentos rendendo pelo CDI e relatórios. Login pelo **Authik** (autenticador próprio, pasta `../authik`).

```
financeos/
├── web/   → o site (React + Vite + TypeScript), publicado na Netlify
└── api/   → a API (Node + Express + PostgreSQL), publicada no Railway
```

O site e a API ficam no mesmo repositório (como no Trackik): uma mudança que mexe nos dois vai num commit só, e a regra de negócio fica num lugar só (`web/src/model/`). O repositório antigo `financeos-api` pode ser arquivado depois da publicação.

## O que mudou na versão 2 (out/2026)

- **Visual novo** inspirado na Monarch e na família Authik/Trackik: menu lateral no computador, abas embaixo no celular, tema claro/escuro, "ocultar valores".
- **Login pelo Authik** no lugar do Clerk (cadastro, confirmação de e-mail, esqueci a senha, login com Google opcional).
- **Dados só no servidor**, ligados à conta. A versão antiga guardava uma cópia de tudo no navegador: além de expor os dados em computador compartilhado, uma segunda pessoa que entrasse no mesmo navegador recebia os dados da primeira na conta dela.
- **Nada se perde entre abas/aparelhos**: cada salvamento leva o número da versão; se outro aparelho salvou antes, as duas versões são juntadas lançamento por lançamento (`web/src/model/merge.ts`).
- **Indicador de salvamento** ("Tudo salvo" / "Salvando…" / "Sem conexão — tentando de novo") e aviso ao fechar a aba com algo por salvar. Antes, uma falha ao salvar só aparecia no console.
- **Preparar/fechar mês** numa janela só, mostrando exatamente o que vai entrar. Antes, só *navegar* até um mês copiava as despesas recorrentes (e uma despesa apagada voltava sozinha).
- **Categorias** com ícones próprios e sugestão automática pelo nome, gráfico "Para onde vai o dinheiro", "Próximos vencimentos" e atrasados em destaque.
- **Separar o dinheiro**: total do mês por forma de pagamento (cartão, boleto, pix/débito), com quanto falta pagar em cada uma. Na Visão geral e em Lançamentos, onde cada cartão também filtra a lista.
- **Valor pago diferente do previsto** (juros, desconto) e agendamento no banco.
- **Aportes simplificados**: duas perguntas ("de onde vem o dinheiro?" e "já fez?") no lugar dos quatro tipos de impacto.
- **Desfazer** em toda exclusão, inclusive "limpar mês". "Apagar tudo" pede para digitar APAGAR.
- Correções: o arrastar para reordenar não tinha efeito (a lista era reordenada pelo dia), Enter numa confirmação tentava salvar outra coisa, setas trocavam o mês enquanto se digitava o saldo, rendimento do CDB contava o próprio dia do aporte, histórico ignorava os investimentos na sobra, nomes com aspas quebravam a tela (e permitiam injetar código ao importar um arquivo), importação substituía tudo sem perguntar.
- **Segurança da API**: verificação do token do Authik (assinatura, emissor, público e validade), CORS só para o site, limite de pedidos, conferência do formato dos dados, cabeçalhos de segurança, exclusão dos dados de contas excluídas no Authik (LGPD).

Os dados antigos continuam valendo: tudo passa por `web/src/model/migrate.ts` ao carregar (e as despesas antigas ganham uma categoria sugerida pelo nome).

## Rodar no computador

Precisa de Node.js 22 e, para o login, do Authik local (pasta `authik`, com o Docker Desktop aberto).

```powershell
# API (outro terminal)
cd api
npm install
copy .env.example .env    # preencha DATABASE_URL e AUTH_URL=http://auth.financeos.localhost:4000
npm run dev               # http://localhost:3000

# Site
cd web
npm install
npm run dev               # abra http://financeos.localhost:5173
```

No Authik local, cadastre a aplicação `financeos` com URL de autenticação `http://auth.financeos.localhost:4000` e URL do produto `http://financeos.localhost:5173` (veja `authik/docs/sdk.md`).

Testes: `npm test` dentro de `api/` (11 testes: login, versões, formato, CORS, contas excluídas) e de `web/` (17 testes: totais por forma de pagamento, migração dos dados antigos, contas do mês, situação, CDI, preparo do mês, mescla entre aparelhos, categorias). `npm run build` em `web/` confere os tipos e gera o site.

## Publicar (passo a passo)

> ⚠️ **O login do Authik precisa de um domínio próprio.** A sessão fica num cookie de `auth.<domínio>` e o navegador só o envia para sites do **mesmo domínio** (`app.<domínio>`). Num endereço `*.netlify.app` o login não funciona.

Siga na ordem. Troque `<domínio>` pelo domínio do FinanceOS (ex.: `financeos.com.br`). É o mesmo caminho do Trackik (`authik/docs/integracao-trackik.md`).

### 1. E-mails (Resend)

Em resend.com → **Domains** → adicionar `conta.<domínio>`. Com o DNS na Hostinger, o Resend configura sozinho.

### 2. Aplicação no Authik

No painel https://app.authik.com.br → seletor de aplicação → **Nova aplicação**:

| Campo | Valor |
| --- | --- |
| Nome interno | `financeos` |
| URL de autenticação | `https://auth.<domínio>` |
| URL do produto | `https://app.<domínio>` |
| Remetente | `nao-responda@conta.<domínio>` |

Em **Configurações → E-mails**, confira as páginas `https://app.<domínio>/verificar-email` e `https://app.<domínio>/redefinir-senha` (o site já tem as duas).

### 3. Endereço de login (Railway, projeto `authik`)

Serviço `api` → **Settings → Networking → Custom Domain** → `auth.<domínio>`, porta 8080. Crie na Hostinger os registros CNAME e TXT que o Railway mostrar, **no domínio do FinanceOS** (confira o domínio no topo da página de DNS antes de salvar).

### 4. API (Railway, serviço do FinanceOS)

1. No serviço atual da API: **Settings → Source** → trocar o repositório para `joaoa21/financeos` e **Root Directory** = `api`.
2. **Variables**: apagar `CLERK_SECRET_KEY` e `FRONTEND_URL`; criar:
   ```
   AUTH_URL=https://auth.<domínio>
   AUTH_AUDIENCE=financeos
   FRONTEND_ORIGINS=https://app.<domínio>
   NODE_ENV=production
   ```
   (`DATABASE_URL` continua a mesma.) A API acrescenta sozinha a coluna nova no banco ao ligar.
3. Opcional, para apagar os dados de contas excluídas no Authik (LGPD): crie uma credencial do canal servidor no painel do Authik e adicione `AUTHIK_SERVER_URL=https://api.authik.com.br`, `AUTHIK_CLIENT_ID` e `AUTHIK_CLIENT_SECRET`.

### 5. Site (Netlify)

1. Em `web/.env.production`, troque `SEU-DOMINIO` pelo domínio e faça commit (não são segredos).
2. Na Netlify, ligue o site ao repositório `joaoa21/financeos`. O arquivo `netlify.toml` na raiz já diz para usar a pasta `web`.
3. **Domain management** → `app.<domínio>` (a Netlify pede um TXT de verificação e um CNAME).
4. Para mostrar "Continuar com Google": configure a chave do Google na aplicação `financeos` do Authik (`authik/docs/login-google.md`) e adicione `VITE_GOOGLE_LOGIN=1` em `web/.env.production`.

### 6. Trazer seus dados do Clerk para a conta nova

1. Abra `https://app.<domínio>`, crie sua conta e confirme o e-mail. **Não cadastre nada ainda.**
2. Pegue o ID da conta nova no painel do Authik (aplicação FinanceOS → Usuários → detalhe → copiar ID).
3. No Railway, botão direito no serviço da API → **Copy SSH Command**, cole no PowerShell e rode:
   ```
   npm run contas -- listar
   ```
   Aparece a linha antiga, com o ID do Clerk (começa com `user_`) e quantos meses tem.
4. Ainda no SSH:
   ```
   npm run contas -- mover <ID do Clerk> <ID do Authik>
   ```
5. Recarregue o site: seus meses aparecem.

Caminho alternativo: se o navegador que você usava ainda tem a cópia local da versão antiga, a Visão geral mostra **"Encontramos dados da versão anterior → Trazer para minha conta"** enquanto a conta estiver vazia.

## Endpoints da API

| Método | Rota | O que faz |
| --- | --- | --- |
| GET | `/health` | Saúde |
| GET | `/api/state` | Dados da conta: `{ data, version, updatedAt }` (`version: 0` = conta nova) |
| PUT | `/api/state` | Salva `{ data, version }`. Responde `409` com a versão atual se outro aparelho salvou antes |
| DELETE | `/api/state` | Apaga todos os dados da conta (a conta no Authik continua) |

Todas as rotas `/api` exigem `Authorization: Bearer <token do Authik>`.
