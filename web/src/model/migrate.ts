import { sugerirCategoria } from './categorias.ts';
import { isMonthKey, todayISO } from './dates.ts';
import type { Aporte, Despesa, Estado, Forma, Investimento, Mes, Renda } from './types.ts';

// Converte os dados de qualquer versão do FinanceOS para o formato atual.
// Roda ao carregar da API e ao importar um arquivo: nunca confia no que chegou.

type Loose = Record<string, unknown>;

export function uid(): string {
  return crypto.randomUUID();
}

export function emptyMonth(): Mes {
  return { saldoInicial: 0, despesas: [], rendas: [], investimentos: [] };
}

const num = (v: unknown, fallback = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() && Number.isFinite(Number(v)) ? Number(v) : fallback);
const str = (v: unknown, max = 200) => (typeof v === 'string' ? v.slice(0, max) : v == null ? '' : String(v).slice(0, max));
const id = (v: unknown) => (typeof v === 'string' && /^[\w-]{1,64}$/.test(v) ? v : uid());
const obj = (v: unknown): Loose => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Loose) : {});
const list = (v: unknown): Loose[] => (Array.isArray(v) ? v.map(obj) : []);
const isoDate = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : todayISO());

/** Dia do mês: aceita 15, "15" ou a data antiga "2025-03-15". */
function day(v: unknown): number | null {
  let n: number;
  if (typeof v === 'number') n = v;
  else if (typeof v === 'string' && v.includes('-')) n = parseInt(v.split('-')[2] ?? '', 10);
  else if (typeof v === 'string') n = parseInt(v, 10);
  else return null;
  return Number.isInteger(n) && n >= 1 && n <= 31 ? n : null;
}

function despesa(raw: Loose): Despesa {
  let tipo = raw.tipo === 'esporadico' ? 'esporadico' : 'fixo';
  let subtipo: Forma | null = raw.subtipo === 'cartao' || raw.subtipo === 'boleto' || raw.subtipo === 'pix' ? raw.subtipo : null;
  if (raw.tipo === 'cartao') {
    tipo = 'fixo';
    subtipo = 'cartao';
  }
  if (tipo === 'fixo' && !subtipo) subtipo = 'boleto';
  const planejado = Math.max(0, num(raw.planejado));
  const realizado = Math.max(0, num(raw.realizado));
  const pago = typeof raw.pago === 'boolean' ? raw.pago : realizado > 0;
  return {
    id: id(raw.id),
    nome: str(raw.nome) || 'Sem nome',
    planejado,
    realizado: pago ? (realizado > 0 ? realizado : planejado) : 0,
    pago,
    tipo: tipo as Despesa['tipo'],
    subtipo,
    data: day(raw.data),
    autoReplicar: raw.autoReplicar === true,
    agendado: !pago && raw.agendado === true,
    // Sem o campo (dados da versão antiga): sugere pelo nome. null = a pessoa escolheu "sem categoria".
    categoria: typeof raw.categoria === 'string' && raw.categoria ? str(raw.categoria, 40) : raw.categoria === undefined ? sugerirCategoria(str(raw.nome)) : null,
  };
}

function renda(raw: Loose): Renda {
  const planejado = Math.max(0, num(raw.planejado));
  const realizado = Math.max(0, num(raw.realizado));
  const recebido = typeof raw.recebido === 'boolean' ? raw.recebido : realizado > 0;
  return {
    id: id(raw.id),
    nome: str(raw.nome) || 'Sem nome',
    planejado,
    realizado: recebido ? (realizado > 0 ? realizado : planejado) : 0,
    recebido,
    data: day(raw.data),
    autoReplicar: raw.autoReplicar === true,
  };
}

/**
 * Aportes antigos tinham "impacto" (nenhum / planejado / realizado / confirmado) e
 * "previsto". Hoje são duas perguntas simples: de onde veio o dinheiro e se já foi feito.
 */
function aporte(raw: Loose): Aporte {
  const valor = Math.max(0, num(raw.valor));
  const data = isoDate(raw.data);
  if (raw.origem === 'conta' || raw.origem === 'externo') {
    return { id: id(raw.id), valor, data, origem: raw.origem, status: raw.status === 'previsto' ? 'previsto' : 'feito' };
  }
  const previsto = raw.previsto === true;
  switch (raw.impacto) {
    case 'realizado':
    case 'confirmado':
      return { id: id(raw.id), valor, data, origem: 'conta', status: previsto ? 'previsto' : 'feito' };
    case 'planejado':
      // Abatia da sobra, mas o dinheiro ainda não tinha saído da conta.
      return { id: id(raw.id), valor, data, origem: 'conta', status: 'previsto' };
    default:
      // "Sem impacto": previsto virava saída da conta ao confirmar; feito não mexia na conta.
      return { id: id(raw.id), valor, data, origem: previsto ? 'conta' : 'externo', status: previsto ? 'previsto' : 'feito' };
  }
}

function investimento(raw: Loose): Investimento {
  const tipo = str(raw.tipo, 40) || 'Outro';
  const aportes = list(raw.aportes).map(aporte);
  // Formato bem antigo: CDB com valorInicial/dataInicio em vez de aportes.
  if (raw.valorInicial !== undefined && !Array.isArray(raw.aportes)) {
    aportes.push({ id: uid(), valor: Math.max(0, num(raw.valorInicial)), data: isoDate(raw.dataInicio), origem: 'externo', status: 'feito' });
  }
  const pct = num(raw.percentualCDI, NaN);
  const percentualCDI = Number.isFinite(pct) && pct > 0 ? pct : tipo === 'CDB' && raw.percentualCDI === undefined ? 100 : null;
  const inv: Investimento = { id: id(raw.id), nome: str(raw.nome) || 'Investimento', tipo, percentualCDI, aportes };
  const base = obj(raw.valorBase);
  if (num(base.valor) > 0) inv.valorBase = { valor: num(base.valor), data: isoDate(base.data) };
  if (num(raw.valor) > 0) inv.valor = num(raw.valor);
  return inv;
}

function mes(raw: Loose): Mes {
  const m: Mes = {
    saldoInicial: num(raw.saldoInicial),
    despesas: list(raw.despesas).map(despesa),
    rendas: list(raw.rendas).map(renda),
    investimentos: list(raw.investimentos).map(investimento),
  };
  if (raw.fechado === true) m.fechado = true;
  return m;
}

/** Normaliza o estado inteiro. Meses com chave inválida são descartados. */
export function migrate(raw: unknown): Estado {
  const result: Estado = {};
  for (const [key, value] of Object.entries(obj(raw))) {
    if (isMonthKey(key)) result[key] = mes(obj(value));
  }
  return result;
}

/** Um mês sem nada (e sem saldo) não precisa ser guardado. */
export function isEmptyMonth(m: Mes | undefined): boolean {
  return !m || (!m.saldoInicial && !m.despesas.length && !m.rendas.length && !m.investimentos.length && !m.fechado);
}
