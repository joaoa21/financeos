import type { Estado, Mes } from './types.ts';

// Junta as alterações feitas aqui com as feitas em outro aparelho ou aba.
//
// `base` é a última versão que os dois lados conheciam; `local`, a versão desta aba;
// `remote`, a que está no servidor. Cada lançamento (pelo id) e cada campo do mês é
// decidido separadamente: fica a versão de quem mudou. Se os dois mudaram a mesma
// coisa, vale a do servidor e `conflicts` conta quantas vezes isso aconteceu.

type Item = { id: string };
const LISTS = ['despesas', 'rendas', 'investimentos'] as const;

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function merge3(base: Estado, local: Estado, remote: Estado): { estado: Estado; conflicts: number } {
  let conflicts = 0;
  const pick = <T,>(b: T | undefined, l: T | undefined, r: T | undefined): T | undefined => {
    if (same(l, b)) return r;
    if (same(r, b) || same(l, r)) return l;
    conflicts++;
    return r;
  };

  const result: Estado = {};
  const keys = new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(remote)]);
  for (const key of [...keys].sort()) {
    const b = base[key];
    const l = local[key];
    const r = remote[key];
    // Mês criado ou apagado inteiro de um lado só.
    if (!l || !r || !b) {
      const chosen = pick(b, l, r);
      if (chosen) result[key] = chosen;
      continue;
    }
    result[key] = mergeMonth(b, l, r, pick);
  }
  return { estado: result, conflicts };
}

function mergeMonth(b: Mes, l: Mes, r: Mes, pick: <T>(b: T | undefined, l: T | undefined, r: T | undefined) => T | undefined): Mes {
  const out: Mes = {
    saldoInicial: pick(b.saldoInicial, l.saldoInicial, r.saldoInicial) ?? 0,
    despesas: [],
    rendas: [],
    investimentos: [],
  };
  if (pick(b.fechado, l.fechado, r.fechado)) out.fechado = true;
  for (const list of LISTS) {
    (out[list] as Item[]) = mergeList(b[list] as Item[], l[list] as Item[], r[list] as Item[], pick);
  }
  return out;
}

function mergeList<T extends Item>(b: T[], l: T[], r: T[], pick: <U>(b: U | undefined, l: U | undefined, r: U | undefined) => U | undefined): T[] {
  const byId = (list: T[]) => new Map(list.map((item) => [item.id, item]));
  const bm = byId(b);
  const lm = byId(l);
  const rm = byId(r);
  const out: T[] = [];
  // Ordem do servidor, depois os novos desta aba.
  const order = [...r.map((x) => x.id), ...l.map((x) => x.id).filter((id) => !rm.has(id))];
  for (const id of order) {
    const chosen = pick(bm.get(id), lm.get(id), rm.get(id));
    if (chosen) out.push(chosen);
  }
  return out;
}
