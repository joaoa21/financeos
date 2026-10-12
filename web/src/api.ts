// Conversa com a API do FinanceOS. Cada chamada leva o token curto do login (Authik),
// pedido na hora e guardado só na memória.

const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';

/** Entrega o token do login para cada chamada (veja App.tsx). */
export type Token = () => Promise<string>;

/** O login não vale mais (saiu, expirou ou a conta foi excluída). */
export class UnauthorizedError extends Error {}

/** Outra aba ou outro aparelho salvou antes: `remote` é a versão atual do servidor. */
export class ConflictError extends Error {
  constructor(public readonly remote: Snapshot) {
    super('conflict');
  }
}

/** Não houve resposta (sem internet, API fora do ar). Vale tentar de novo. */
export class OfflineError extends Error {}

export interface Snapshot {
  data: unknown;
  version: number;
}

async function request(path: string, token: Token, init: RequestInit = {}): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${await token()}`, ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) throw err;
    throw new OfflineError('Sem conexão com o servidor.');
  }
  if (response.status === 401) throw new UnauthorizedError();
  if (response.status >= 500 || response.status === 429) throw new OfflineError(`O servidor respondeu ${response.status}.`);
  return response;
}

async function errorMessage(response: Response) {
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? `Erro ${response.status}`;
}

export async function loadState(token: Token): Promise<Snapshot> {
  const response = await request('/api/state', token);
  if (!response.ok) throw new Error(await errorMessage(response));
  const body = (await response.json()) as Snapshot;
  return { data: body.data ?? {}, version: Number(body.version) || 0 };
}

/** `checkpoint`: pede ao servidor que guarde a versão atual no histórico antes de trocar. */
export async function saveState(token: Token, data: unknown, version: number, checkpoint = false): Promise<number> {
  const body = checkpoint ? { data, version, checkpoint } : { data, version };
  const response = await request('/api/state', token, { method: 'PUT', body: JSON.stringify(body) });
  if (response.status === 409) {
    const body = (await response.json()) as Snapshot;
    throw new ConflictError({ data: body.data ?? {}, version: Number(body.version) || 0 });
  }
  if (!response.ok) throw new Error(await errorMessage(response));
  return Number(((await response.json()) as { version: number }).version);
}

export async function deleteState(token: Token): Promise<void> {
  const response = await request('/api/state', token, { method: 'DELETE' });
  if (!response.ok) throw new Error(await errorMessage(response));
}

/** Uma versão anterior guardada no servidor (últimos 30 dias). */
export interface Versao {
  id: number;
  savedAt: string;
  months: number;
}

export async function listHistory(token: Token): Promise<Versao[]> {
  const response = await request('/api/history', token);
  if (!response.ok) throw new Error(await errorMessage(response));
  return ((await response.json()) as { versions: Versao[] }).versions;
}

export async function loadHistory(token: Token, id: number): Promise<unknown> {
  const response = await request(`/api/history/${id}`, token);
  if (!response.ok) throw new Error(await errorMessage(response));
  return ((await response.json()) as { data: unknown }).data;
}
