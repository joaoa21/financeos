import pg from 'pg';
import { createApp } from './app.js';
import { authikVerifier } from './auth.js';
import { authikServerConfigFromEnv, startDeletedAccountsSweep } from './deleted-accounts.js';
import { migrate, pgStore } from './store.js';

// Liga a API. As configurações vêm das variáveis de ambiente (veja .env.example).

const env = process.env;
const production = env.NODE_ENV === 'production';

if (!env.DATABASE_URL) {
  console.error('Falta DATABASE_URL (endereço do PostgreSQL).');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  // O Postgres interno do Railway usa certificado próprio.
  ssl: env.DATABASE_SSL === 'false' || !production ? false : { rejectUnauthorized: false },
  max: 10,
});
pool.on('error', (err) => console.error('PostgreSQL:', err.message));

const origins = (env.FRONTEND_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim().replace(/\/$/, ''))
  .filter(Boolean);
if (!production) origins.push('http://financeos.localhost:5173', 'http://localhost:5173');
if (origins.some((origin) => origin === '*')) {
  console.error('FRONTEND_ORIGINS não aceita "*": informe os endereços do site, separados por vírgula.');
  process.exit(1);
}

let verify = null;
if (env.AUTH_URL) verify = authikVerifier({ authURL: env.AUTH_URL, audience: env.AUTH_AUDIENCE ?? 'financeos' });
else console.warn('AUTH_URL não definido: as rotas /api respondem 503 até configurar o login.');

await migrate(pool);
const store = pgStore(pool);
const app = createApp({ store, verify, origins, trustProxy: production });

const sweep = authikServerConfigFromEnv();
if (sweep) startDeletedAccountsSweep(store, sweep);

const port = Number(env.PORT) || 3000;
const server = app.listen(port, () => console.log(`FinanceOS API na porta ${port} (origens: ${origins.join(', ') || 'nenhuma'})`));

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    server.close(() => pool.end().finally(() => process.exit(0)));
  });
}
