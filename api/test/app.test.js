import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { createApp } from '../src/app.js';
import { authikVerifier } from '../src/auth.js';
import { fetchDeletedAccounts, purgeDeletedAccounts } from '../src/deleted-accounts.js';
import { memoryStore } from '../src/store.js';
import { invalidState } from '../src/validate.js';

const AUTH_URL = 'https://auth.financeos.test';
const SITE = 'https://app.financeos.test';

let server, base, sign, otherKeySign, store;

before(async () => {
  const { publicKey, privateKey } = await generateKeyPair('EdDSA', { crv: 'Ed25519' });
  const other = await generateKeyPair('EdDSA', { crv: 'Ed25519' });
  const jwk = { ...(await exportJWK(publicKey)), kid: 'k1', alg: 'EdDSA' };
  const keys = createLocalJWKSet({ keys: [jwk] });
  const make = (key) => (sub, claims = {}) =>
    new SignJWT({ ...claims })
      .setProtectedHeader({ alg: 'EdDSA', kid: 'k1' })
      .setSubject(sub)
      .setIssuer(claims.iss ?? AUTH_URL)
      .setAudience(claims.aud ?? 'financeos')
      .setIssuedAt()
      .setExpirationTime(claims.exp ?? '5m')
      .sign(key);
  sign = make(privateKey);
  otherKeySign = make(other.privateKey);
  store = memoryStore();
  const verify = authikVerifier({ authURL: AUTH_URL, audience: 'financeos', keys });
  const app = createApp({ store, verify, origins: [SITE], log: { error() {} } });
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());

async function call(path, { token, method = 'GET', body, origin } = {}) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (origin) headers.origin = origin;
  const res = await fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  return { status: res.status, headers: res.headers, body: text ? JSON.parse(text) : null };
}

const month = { saldoInicial: 100, despesas: [{ id: 'a', nome: 'Aluguel', planejado: 1500, realizado: 0 }], rendas: [], investimentos: [] };

describe('login', () => {
  it('recusa pedido sem token, com token de outra chave, outro público ou vencido', async () => {
    assert.equal((await call('/api/state')).status, 401);
    assert.equal((await call('/api/state', { token: await otherKeySign('u1') })).status, 401);
    assert.equal((await call('/api/state', { token: await sign('u1', { aud: 'trackik' }) })).status, 401);
    assert.equal((await call('/api/state', { token: await sign('u1', { iss: 'https://auth.outro.test' }) })).status, 401);
    const expired = await sign('u1', { exp: Math.floor(Date.now() / 1000) - 60 });
    assert.equal((await call('/api/state', { token: expired })).status, 401);
  });

  it('conta nova recebe dados vazios e versão 0', async () => {
    const res = await call('/api/state', { token: await sign('nova') });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { data: {}, version: 0, updatedAt: null });
  });
});

describe('salvar', () => {
  it('salva, devolve versão nova e cada conta só vê os próprios dados', async () => {
    const token = await sign('joao');
    const saved = await call('/api/state', { token, method: 'PUT', body: { data: { '2026-10': month }, version: 0 } });
    assert.equal(saved.status, 200);
    assert.equal(saved.body.version, 1);
    const read = await call('/api/state', { token });
    assert.deepEqual(read.body.data, { '2026-10': month });
    const other = await call('/api/state', { token: await sign('maria') });
    assert.deepEqual(other.body.data, {});
  });

  it('recusa salvar em cima de uma versão antiga (outra aba salvou antes) e devolve a atual', async () => {
    const token = await sign('conflito');
    await call('/api/state', { token, method: 'PUT', body: { data: { '2026-10': month }, version: 0 } });
    await call('/api/state', { token, method: 'PUT', body: { data: {}, version: 1 } });
    const stale = await call('/api/state', { token, method: 'PUT', body: { data: { '2026-11': month }, version: 1 } });
    assert.equal(stale.status, 409);
    assert.equal(stale.body.version, 2);
    assert.deepEqual(stale.body.data, {});
  });

  it('recusa dados com formato errado', async () => {
    const token = await sign('formato');
    for (const data of [null, [], { abc: month }, { '2026-13': month }, { '2026-10': { despesas: 'x' } }, { '2026-10': { saldoInicial: 'x' } }]) {
      const res = await call('/api/state', { token, method: 'PUT', body: { data, version: 0 } });
      assert.equal(res.status, 400, JSON.stringify(data));
    }
    const noVersion = await call('/api/state', { token, method: 'PUT', body: { data: {} } });
    assert.equal(noVersion.status, 400);
  });

  it('apaga todos os dados da conta', async () => {
    const token = await sign('apagar');
    await call('/api/state', { token, method: 'PUT', body: { data: { '2026-10': month }, version: 0 } });
    assert.equal((await call('/api/state', { token, method: 'DELETE' })).status, 204);
    assert.deepEqual((await call('/api/state', { token })).body.data, {});
  });
});

describe('navegador', () => {
  it('só o site do FinanceOS passa pelo CORS', async () => {
    const ok = await call('/api/state', { token: await sign('x'), origin: SITE });
    assert.equal(ok.status, 200);
    assert.equal(ok.headers.get('access-control-allow-origin'), SITE);
    const blocked = await call('/api/state', { token: await sign('x'), origin: 'https://malicioso.test' });
    assert.equal(blocked.status, 403);
    const preflight = await fetch(`${base}/api/state`, { method: 'OPTIONS', headers: { origin: SITE } });
    assert.equal(preflight.status, 204);
    assert.match(preflight.headers.get('access-control-allow-methods'), /PUT/);
  });

  it('responde com cabeçalhos de segurança e sem cache', async () => {
    const res = await call('/health');
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(res.headers.get('cache-control'), 'no-store');
    assert.equal(res.headers.get('x-powered-by'), null);
  });
});

describe('validação', () => {
  it('aceita o formato real dos dados (inclusive investimentos com aportes)', () => {
    const data = {
      '2026-10': {
        saldoInicial: 0,
        despesas: [{ id: '1', nome: 'Luz', planejado: 200, realizado: 0, tipo: 'fixo', subtipo: 'boleto', data: 10, autoReplicar: true, agendado: false }],
        rendas: [{ id: '2', nome: 'Salário', planejado: 5000, realizado: 5000, data: 5 }],
        investimentos: [
          { id: '3', nome: 'CDB', tipo: 'CDB', percentualCDI: 110, valorBase: { valor: 1000, data: '2026-10-01' }, aportes: [{ id: '4', valor: 100, data: '2026-10-05', origem: 'conta', status: 'feito' }] },
        ],
      },
    };
    assert.equal(invalidState(data), null);
  });
});

describe('contas excluídas no Authik', () => {
  it('percorre as páginas e apaga só quem tinha dados', async () => {
    const memory = memoryStore();
    await memory.save('excluida', { '2026-10': month }, 0);
    await memory.save('ativa', { '2026-10': month }, 0);
    const pages = {
      '': { accounts: [{ userId: 'excluida' }], next: 'p2' },
      p2: { accounts: [{ userId: 'sem-dados' }], next: null },
    };
    const fakeFetch = async (url, init) => {
      assert.match(init.headers.authorization, /^Basic /);
      return Response.json(pages[url.searchParams.get('cursor') ?? '']);
    };
    const config = { url: 'https://api.authik.test', clientId: 'id', clientSecret: 'seg', fetch: fakeFetch };
    const result = await purgeDeletedAccounts(memory, config);
    assert.deepEqual(result, { deletedAccounts: 2, purged: 1 });
    assert.equal(await memory.get('excluida'), null);
    assert.ok(await memory.get('ativa'));
  });

  it('se o Authik falhar, não apaga nada', async () => {
    const config = { url: 'https://api.authik.test', clientId: 'id', clientSecret: 'x', fetch: async () => Response.json({ code: 'X' }, { status: 401 }) };
    await assert.rejects(fetchDeletedAccounts(config, new Date()), /401/);
  });
});
