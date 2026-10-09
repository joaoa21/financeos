import { businessDaysBetween, compareKeys, currentKey, todayISO } from './dates.ts';
import { emptyMonth, uid } from './migrate.ts';
import type { Despesa, Estado, Forma, Investimento, Mes, Renda } from './types.ts';

// Todas as contas do FinanceOS num lugar só (as telas só mostram o resultado).

/** CDI anual usado quando não dá para consultar o Banco Central. */
export const CDI_RESERVA_AA = 14.9;

export function cdiDiario(cdiAnual: number): number {
  return Math.pow(1 + cdiAnual / 100, 1 / 252) - 1;
}

const sum = <T,>(items: T[], value: (item: T) => number) => items.reduce((total, item) => total + value(item), 0);

/** Quanto a despesa pesa no mês: o valor pago, se já foi paga; senão, o previsto. */
export const valorDespesa = (d: Despesa) => (d.pago ? d.realizado : d.planejado);
export const valorRenda = (r: Renda) => (r.recebido ? r.realizado : r.planejado);

export interface ValorInvestimento {
  /** Valor estimado hoje. */
  atual: number;
  /** Quanto foi colocado (sem rendimento). */
  investido: number;
  rendimento: number;
  /** Aportes ainda não feitos. */
  previsto: number;
}

export function valorInvestimento(inv: Investimento, cdiAnual: number, ate = todayISO()): ValorInvestimento {
  const taxa = inv.percentualCDI ? cdiDiario(cdiAnual) * (inv.percentualCDI / 100) : 0;
  const render = (valor: number, desde: string) => (taxa ? valor * Math.pow(1 + taxa, businessDaysBetween(desde, ate)) : valor);
  let atual = inv.valor ?? 0;
  let investido = inv.valor ?? 0;
  if (inv.valorBase) {
    atual += render(inv.valorBase.valor, inv.valorBase.data);
    investido += inv.valorBase.valor;
  }
  let previsto = 0;
  for (const a of inv.aportes) {
    if (a.status === 'previsto') {
      previsto += a.valor;
      continue;
    }
    atual += render(a.valor, a.data);
    investido += a.valor;
  }
  return { atual, investido, rendimento: atual - investido, previsto };
}

export interface Resumo {
  saldoInicial: number;
  rendaPrevista: number;
  rendaRecebida: number;
  aReceber: number;
  despesaPrevista: number;
  despesaPaga: number;
  agendado: number;
  aPagar: number;
  /** Aportes que saem do dinheiro do mês (feitos ou previstos). */
  aportesConta: number;
  aportesFeitos: number;
  /** O que deve sobrar no fim do mês, se tudo acontecer como previsto. */
  sobra: number;
  /** O que deveria estar na conta agora. */
  naConta: number;
  /** Parte da renda que não vira despesa (investir conta como guardar). */
  economia: number | null;
  carteira: number;
  rendimentoCarteira: number;
}

export function resumo(m: Mes, cdiAnual: number): Resumo {
  const rendaPrevista = sum(m.rendas, valorRenda);
  const rendaRecebida = sum(m.rendas, (r) => (r.recebido ? r.realizado : 0));
  const despesaPrevista = sum(m.despesas, valorDespesa);
  const despesaPaga = sum(m.despesas, (d) => (d.pago ? d.realizado : 0));
  const agendado = sum(m.despesas, (d) => (!d.pago && d.agendado ? d.planejado : 0));
  const aportes = m.investimentos.flatMap((i) => i.aportes).filter((a) => a.origem === 'conta');
  const aportesConta = sum(aportes, (a) => a.valor);
  const aportesFeitos = sum(aportes, (a) => (a.status === 'feito' ? a.valor : 0));
  const valores = m.investimentos.map((i) => valorInvestimento(i, cdiAnual));
  return {
    saldoInicial: m.saldoInicial,
    rendaPrevista,
    rendaRecebida,
    aReceber: rendaPrevista - rendaRecebida,
    despesaPrevista,
    despesaPaga,
    agendado,
    aPagar: despesaPrevista - despesaPaga - agendado,
    aportesConta,
    aportesFeitos,
    sobra: m.saldoInicial + rendaPrevista - despesaPrevista - aportesConta,
    naConta: m.saldoInicial + rendaRecebida - despesaPaga - agendado - aportesFeitos,
    economia: rendaPrevista > 0 ? (rendaPrevista - despesaPrevista) / rendaPrevista : null,
    carteira: sum(valores, (v) => v.atual),
    rendimentoCarteira: sum(valores, (v) => v.rendimento),
  };
}

export type Situacao = 'pago' | 'agendado' | 'atrasado' | 'hoje' | 'pendente';

/** Situação de uma despesa ou renda no mês `key`, vista de hoje. */
export function situacao(item: Despesa | Renda, key: string, now = new Date()): Situacao {
  if ('pago' in item ? item.pago : item.recebido) return 'pago';
  if ('agendado' in item && item.agendado) return 'agendado';
  const atual = currentKey(now);
  const cmp = compareKeys(key, atual);
  if (cmp < 0) return 'atrasado';
  if (cmp > 0 || item.data == null) return 'pendente';
  if (item.data < now.getDate()) return 'atrasado';
  if (item.data === now.getDate()) return 'hoje';
  return 'pendente';
}

/** Gastos do mês agrupados por categoria, do maior para o menor. */
export function gastosPorCategoria(m: Mes): { id: string; total: number }[] {
  const totals = new Map<string, number>();
  for (const d of m.despesas) totals.set(d.categoria ?? '', (totals.get(d.categoria ?? '') ?? 0) + valorDespesa(d));
  return [...totals].map(([id, total]) => ({ id, total })).filter((c) => c.total > 0).sort((a, b) => b.total - a.total);
}

// ─── Preparar o mês seguinte ─────────────────────────────────────

export interface OpcoesPreparo {
  saldo: boolean;
  despesasRecorrentes: boolean;
  outrasFixas: boolean;
  rendasRecorrentes: boolean;
  outrasRendas: boolean;
  investimentos: boolean;
}

export interface PrevisaoPreparo {
  saldo: number;
  despesasRecorrentes: Despesa[];
  outrasFixas: Despesa[];
  rendasRecorrentes: Renda[];
  outrasRendas: Renda[];
  investimentos: Investimento[];
}

const nomeKey = (nome: string) => nome.trim().toLowerCase();

/** O que pode ser trazido de `origem` para `destino` (sem repetir o que já está lá). */
export function previsaoPreparo(estado: Estado, origem: string, destino: string, cdiAnual: number): PrevisaoPreparo {
  const de = estado[origem] ?? emptyMonth();
  const para = estado[destino] ?? emptyMonth();
  const despesasExistentes = new Set(para.despesas.map((d) => nomeKey(d.nome)));
  const rendasExistentes = new Set(para.rendas.map((r) => nomeKey(r.nome)));
  const invExistentes = new Set(para.investimentos.map((i) => `${nomeKey(i.nome)}|${i.tipo}`));
  const despesas = de.despesas.filter((d) => d.tipo === 'fixo' && !despesasExistentes.has(nomeKey(d.nome)));
  const rendas = de.rendas.filter((r) => !rendasExistentes.has(nomeKey(r.nome)));
  return {
    saldo: resumo(de, cdiAnual).naConta,
    despesasRecorrentes: despesas.filter((d) => d.autoReplicar),
    outrasFixas: despesas.filter((d) => !d.autoReplicar),
    rendasRecorrentes: rendas.filter((r) => r.autoReplicar),
    outrasRendas: rendas.filter((r) => !r.autoReplicar),
    investimentos: de.investimentos.filter((i) => !invExistentes.has(`${nomeKey(i.nome)}|${i.tipo}`)),
  };
}

/** Investimento levado para o mês seguinte com o valor de hoje, sem o histórico de aportes. */
export function consolidar(inv: Investimento, cdiAnual: number, hoje = todayISO()): Investimento {
  const { atual } = valorInvestimento(inv, cdiAnual, hoje);
  const novo: Investimento = { id: uid(), nome: inv.nome, tipo: inv.tipo, percentualCDI: inv.percentualCDI, aportes: [] };
  if (atual > 0) {
    if (inv.percentualCDI) novo.valorBase = { valor: round2(atual), data: hoje };
    else novo.valor = round2(atual);
  }
  return novo;
}

/** Devolve um estado novo com o mês `destino` preparado a partir de `origem`. */
export function preparar(estado: Estado, origem: string, destino: string, opcoes: OpcoesPreparo, cdiAnual: number, fecharOrigem: boolean): Estado {
  const p = previsaoPreparo(estado, origem, destino, cdiAnual);
  const para: Mes = structuredClone(estado[destino] ?? emptyMonth());
  if (opcoes.saldo) para.saldoInicial = round2(p.saldo);
  const novaDespesa = (d: Despesa): Despesa => ({ ...d, id: uid(), pago: false, realizado: 0, agendado: false });
  const novaRenda = (r: Renda): Renda => ({ ...r, id: uid(), recebido: false, realizado: 0 });
  if (opcoes.despesasRecorrentes) para.despesas.push(...p.despesasRecorrentes.map(novaDespesa));
  if (opcoes.outrasFixas) para.despesas.push(...p.outrasFixas.map(novaDespesa));
  if (opcoes.rendasRecorrentes) para.rendas.push(...p.rendasRecorrentes.map(novaRenda));
  if (opcoes.outrasRendas) para.rendas.push(...p.outrasRendas.map(novaRenda));
  if (opcoes.investimentos) para.investimentos.push(...p.investimentos.map((i) => consolidar(i, cdiAnual)));
  const next: Estado = { ...estado, [destino]: para };
  if (fecharOrigem && estado[origem]) next[origem] = { ...estado[origem]!, fechado: true };
  return next;
}

/** Mês anterior mais recente que tem dados (para "trazer do mês anterior"). */
export function mesAnteriorComDados(estado: Estado, key: string): string | null {
  const keys = Object.keys(estado).filter((k) => compareKeys(k, key) < 0).sort();
  return keys.length ? keys[keys.length - 1]! : null;
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

// ─── Por forma de pagamento ──────────────────────────────────────

export type FormaOuSem = Forma | 'sem';

export interface TotalForma {
  forma: FormaOuSem;
  /** Tudo o que sai por essa forma no mês (pago pelo valor pago, o resto pelo previsto). */
  total: number;
  pago: number;
  /** Ainda não pago (inclui os agendados: o dinheiro ainda precisa estar na conta). */
  falta: number;
  quantidade: number;
}

/**
 * Totais das despesas do mês por forma de pagamento (cartão, boleto, pix/débito), para
 * separar o dinheiro de cada conta assim que a renda cai. "sem" só aparece se houver
 * despesa sem forma definida (dados antigos).
 */
export function totaisPorForma(m: Mes): TotalForma[] {
  const ordem: FormaOuSem[] = ['cartao', 'boleto', 'pix', 'sem'];
  return ordem
    .map((forma) => {
      const itens = m.despesas.filter((d) => (d.subtipo ?? 'sem') === forma);
      const pago = sum(itens, (d) => (d.pago ? d.realizado : 0));
      const falta = sum(itens, (d) => (d.pago ? 0 : d.planejado));
      return { forma, total: pago + falta, pago, falta, quantidade: itens.length };
    })
    .filter((t) => t.forma !== 'sem' || t.quantidade > 0);
}
