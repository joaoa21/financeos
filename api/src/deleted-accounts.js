// Contas excluídas no Authik (LGPD): de tempos em tempos a API pergunta ao Authik
// quais contas foram excluídas e apaga os dados financeiros delas.
//
// A consulta é pelo "canal servidor" do Authik (guia: authik/docs/canal-servidor.md),
// com uma credencial própria (client id + segredo) que fica só nas variáveis do Railway.
// Sempre perguntamos pelos últimos 89 dias (o Authik guarda 90): apagar de novo uma
// conta já apagada não faz nada, então não é preciso lembrar da última consulta.

const WINDOW_DAYS = 89;
const TIMEOUT_MS = 15_000;
const MAX_PAGES = 1_000; // trava contra um "next" que nunca acaba
const FIRST_RUN_MS = 60_000;
const EVERY_MS = 6 * 60 * 60 * 1000;

/** Lista os IDs das contas excluídas no Authik desde `since`, percorrendo todas as páginas. */
export async function fetchDeletedAccounts(config, since) {
  const doFetch = config.fetch ?? fetch;
  const auth = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');
  const ids = new Set();
  let cursor = null;
  for (let page = 0; page < MAX_PAGES; page++) {
    const url = new URL('/v1/server/deleted-accounts', config.url);
    url.searchParams.set('since', since.toISOString());
    if (cursor) url.searchParams.set('cursor', cursor);
    const response = await doFetch(url, {
      headers: { authorization: `Basic ${auth}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      const code = typeof body?.code === 'string' ? body.code : 'sem código';
      throw new Error(`Authik respondeu ${response.status} (${code}) ao listar contas excluídas`);
    }
    const data = await response.json();
    if (!Array.isArray(data?.accounts) || (data.next !== null && typeof data.next !== 'string')) {
      throw new Error('Resposta inesperada do Authik ao listar contas excluídas');
    }
    for (const account of data.accounts) {
      if (typeof account?.userId === 'string' && account.userId && account.userId.length <= 200) ids.add(account.userId);
    }
    if (!data.next) return [...ids];
    cursor = data.next;
  }
  throw new Error(`Lista de contas excluídas com mais de ${MAX_PAGES} páginas: interrompida`);
}

/** Apaga os dados das contas excluídas. Se o Authik falhar, nada é apagado. */
export async function purgeDeletedAccounts(store, config, now = new Date()) {
  const since = new Date(now.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const ids = await fetchDeletedAccounts(config, since);
  let purged = 0;
  for (const id of ids) if (await store.remove(id)) purged++;
  return { deletedAccounts: ids.length, purged };
}

/** Liga a limpeza automática: 1 minuto depois de a API ligar e depois a cada 6 horas. */
export function startDeletedAccountsSweep(store, config, log = console) {
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      const result = await purgeDeletedAccounts(store, config);
      log.info(`Contas excluídas no Authik: ${result.deletedAccounts} nos últimos ${WINDOW_DAYS} dias; dados apagados de ${result.purged}`);
    } catch (error) {
      log.error(`Limpeza de contas excluídas falhou: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      running = false;
    }
  };
  const first = setTimeout(run, FIRST_RUN_MS);
  const every = setInterval(run, EVERY_MS);
  first.unref();
  every.unref();
  return () => {
    clearTimeout(first);
    clearInterval(every);
  };
}

/** Lê a credencial do canal servidor das variáveis de ambiente; null se faltar alguma. */
export function authikServerConfigFromEnv(env = process.env) {
  const { AUTHIK_SERVER_URL: url, AUTHIK_CLIENT_ID: clientId, AUTHIK_CLIENT_SECRET: clientSecret } = env;
  if (!url || !clientId || !clientSecret) return null;
  return { url, clientId, clientSecret };
}
