import express from 'express';
import { bearerToken } from './auth.js';
import { invalidState } from './validate.js';

// Rotas da API. Recebe as peças prontas (banco, verificador de login, endereços
// permitidos) para que os testes possam trocar o banco por um na memória.

/**
 * @param {{
 *   store: ReturnType<typeof import('./store.js').memoryStore>,
 *   verify: ((token: string | null) => Promise<string | null>) | null,
 *   origins: string[],
 *   trustProxy?: boolean,
 *   log?: { error: (...args: unknown[]) => void },
 * }} options
 */
export function createApp({ store, verify, origins, trustProxy = false, log = console }) {
  const app = express();
  app.disable('x-powered-by');
  // No Railway a API fica atrás de um proxy: o IP verdadeiro vem em X-Forwarded-For.
  if (trustProxy) app.set('trust proxy', 1);

  // Cabeçalhos de segurança: a API só responde JSON, nunca é aberta como página.
  app.use((req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
      'Cache-Control': 'no-store',
    });
    next();
  });

  // CORS: só o site do FinanceOS (FRONTEND_ORIGINS) pode chamar a API pelo navegador.
  const allowed = new Set(origins);
  app.use((req, res, next) => {
    const origin = req.get('origin');
    if (origin) {
      if (!allowed.has(origin)) return res.status(403).json({ error: 'Origem não permitida' });
      res.set({ 'Access-Control-Allow-Origin': origin, Vary: 'Origin' });
      if (req.method === 'OPTIONS') {
        res.set({
          'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Authorization, Content-Type',
          'Access-Control-Max-Age': '600',
        });
        return res.status(204).end();
      }
    }
    next();
  });

  app.get('/health', (req, res) => res.json({ status: 'ok' }));

  // Limite de pedidos por IP (só na memória): protege contra abuso e loops do site.
  app.use('/api', rateLimit({ max: 180, windowMs: 60_000 }));

  // Login obrigatório em tudo de /api.
  app.use('/api', async (req, res, next) => {
    if (!verify) return res.status(503).json({ error: 'Login não configurado na API (falta AUTH_URL).' });
    const userId = await verify(bearerToken(req.get('authorization')));
    if (!userId) return res.status(401).json({ error: 'Entre de novo para continuar.' });
    req.userId = userId;
    next();
  });

  app.use('/api', express.json({ limit: '1mb' }));

  app.get('/api/state', async (req, res) => {
    const row = await store.get(req.userId);
    res.json(row ?? { data: {}, version: 0, updatedAt: null });
  });

  app.put('/api/state', async (req, res) => {
    const { data, version } = req.body ?? {};
    if (!Number.isInteger(version) || version < 0) return res.status(400).json({ error: 'Campo "version" inválido' });
    const problem = invalidState(data);
    if (problem) return res.status(400).json({ error: `Dados inválidos: ${problem}` });
    const result = await store.save(req.userId, data, version);
    if (!result.ok) {
      // Outra aba ou outro aparelho salvou antes: devolve a versão atual para o site.
      const current = await store.get(req.userId);
      return res.status(409).json({ error: 'Os dados mudaram em outro lugar.', ...(current ?? { data: {}, version: 0 }) });
    }
    res.json({ version: result.version, updatedAt: result.updatedAt });
  });

  // "Apagar todos os meus dados" (a conta no Authik continua existindo).
  app.delete('/api/state', async (req, res) => {
    await store.remove(req.userId);
    res.status(204).end();
  });

  app.use((req, res) => res.status(404).json({ error: 'Rota não encontrada' }));

  // Erros inesperados: registra sem dados da conta e responde algo genérico.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Dados grandes demais' });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido' });
    log.error(`Erro em ${req.method} ${req.path}: ${err.message}`);
    res.status(500).json({ error: 'Erro interno. Tente de novo em instantes.' });
  });

  return app;
}

function rateLimit({ max, windowMs }) {
  const hits = new Map();
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) if (entry.reset <= now) hits.delete(key);
  }, windowMs);
  sweep.unref();
  return (req, res, next) => {
    const now = Date.now();
    const entry = hits.get(req.ip);
    if (!entry || entry.reset <= now) {
      hits.set(req.ip, { count: 1, reset: now + windowMs });
      return next();
    }
    entry.count += 1;
    if (entry.count > max) {
      res.set('Retry-After', String(Math.ceil((entry.reset - now) / 1000)));
      return res.status(429).json({ error: 'Muitos pedidos. Espere um pouco.' });
    }
    next();
  };
}
