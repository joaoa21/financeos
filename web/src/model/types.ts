// Formato dos dados guardados na API: um objeto com um mês por chave ("2026-10").
// Os nomes dos campos vêm da versão anterior do FinanceOS, para os dados antigos
// continuarem valendo (veja migrate.ts).

export type Forma = 'boleto' | 'cartao' | 'pix';
export type TipoDespesa = 'fixo' | 'esporadico';

export interface Despesa {
  id: string;
  nome: string;
  /** Valor previsto. */
  planejado: number;
  /** Valor efetivamente pago (vale quando `pago`). */
  realizado: number;
  pago: boolean;
  tipo: TipoDespesa;
  subtipo: Forma | null;
  /** Dia do vencimento (1 a 31) ou null. */
  data: number | null;
  /** Repetir nos próximos meses. */
  autoReplicar: boolean;
  /** Pagamento já agendado no banco: o dinheiro está comprometido. */
  agendado: boolean;
  categoria?: string | null;
}

export interface Renda {
  id: string;
  nome: string;
  planejado: number;
  realizado: number;
  recebido: boolean;
  data: number | null;
  autoReplicar: boolean;
}

export interface Aporte {
  id: string;
  valor: number;
  /** AAAA-MM-DD */
  data: string;
  /** "conta": sai do dinheiro deste mês. "externo": já estava investido ou veio de fora. */
  origem: 'conta' | 'externo';
  status: 'feito' | 'previsto';
}

export interface Investimento {
  id: string;
  nome: string;
  tipo: string;
  /** Rende pelo CDI quando é um número (ex.: 110 = 110% do CDI). */
  percentualCDI: number | null;
  /** Valor já investido sem data (não rende pelo CDI). */
  valor?: number;
  /** Valor consolidado trazido do mês anterior, rendendo a partir de `data`. */
  valorBase?: { valor: number; data: string };
  aportes: Aporte[];
}

export interface Mes {
  saldoInicial: number;
  despesas: Despesa[];
  rendas: Renda[];
  investimentos: Investimento[];
  /** O mês foi fechado (o seguinte já foi preparado). */
  fechado?: boolean;
}

export type Estado = Record<string, Mes>;

export const INV_TIPOS = ['CDB', 'Tesouro Direto', 'Renda Fixa', 'Ações', 'FII', 'Criptomoedas', 'Previdência', 'Outro'];
