import { request } from 'node:http';
import { createRemoteJWKSet, customFetch, jwtVerify } from 'jose';

// Login das contas pelo Authik (autenticador próprio do dono).
// O site pede ao Authik um token curto (vale 5 minutos) e manda aqui em
// "Authorization: Bearer ...". A API confere a assinatura com as chaves públicas
// do Authik e fica sabendo qual conta está pedindo, sem guardar senha nenhuma.

/**
 * @param {{ authURL: string, audience: string, keys?: import('jose').JWTVerifyGetKey }} options
 *   authURL: endereço de login do FinanceOS, ex.: https://auth.financeos.com.br
 *   audience: nome interno da aplicação no painel do Authik (financeos)
 *   keys: só para testes, chaves já carregadas no lugar de buscar no Authik
 * @returns {(token: string | null) => Promise<string | null>} ID da conta, ou null se o token não vale
 */
export function authikVerifier({ authURL, audience, keys }) {
  const url = new URL(authURL);
  if (url.pathname !== '/' || url.search || url.hash) {
    throw new Error('AUTH_URL deve ser só a origem, ex.: https://auth.financeos.com.br');
  }
  if (!audience) throw new Error('AUTH_AUDIENCE não definido');
  // As chaves públicas ficam em cache; se o Authik trocar de chave, são buscadas de novo.
  const jwks = keys ?? createRemoteJWKSet(new URL('/api/auth/jwks', url.origin), localDev(url));
  return async (token) => {
    if (typeof token !== 'string' || !token || token.length > 4096) return null;
    try {
      const { payload } = await jwtVerify(token, jwks, {
        issuer: url.origin,
        audience,
        algorithms: ['EdDSA'],
      });
      return typeof payload.sub === 'string' && payload.sub ? payload.sub : null;
    } catch {
      return null;
    }
  };
}

/** Lê o token de um cabeçalho Authorization ("Bearer ..."). */
export function bearerToken(authorization) {
  const match = /^Bearer ([A-Za-z0-9._-]+)$/.exec(authorization ?? '');
  return match ? match[1] : null;
}

/**
 * Só no desenvolvimento (auth.financeos.localhost): o Node do Windows não encontra
 * endereços *.localhost (o navegador encontra). As chaves são buscadas em 127.0.0.1,
 * com o endereço certo no cabeçalho Host, que é o que o Authik usa para saber de qual
 * aplicação se trata. (O fetch do Node ignora um Host trocado; por isso o módulo http.)
 */
function localDev(url) {
  if (!url.hostname.endsWith('.localhost')) return undefined;
  return {
    [customFetch]: (target, init) =>
      new Promise((resolve, reject) => {
        const { pathname, search } = new URL(target);
        const req = request(
          { host: '127.0.0.1', port: url.port || 80, path: pathname + search, headers: { host: url.host }, signal: init.signal },
          (res) => {
            const chunks = [];
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('error', reject);
            res.on('end', () =>
              resolve(
                new Response(Buffer.concat(chunks), {
                  status: res.statusCode ?? 502,
                  headers: { 'content-type': res.headers['content-type'] ?? 'application/json' },
                }),
              ),
            );
          },
        );
        req.on('error', reject);
        req.end();
      }),
  };
}
