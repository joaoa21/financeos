// Formatação de valores em reais e datas, sempre em português do Brasil.

const real = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const realCompacto = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 });
const porcento = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 });

export const brl = (value: number) => real.format(Math.abs(value) < 0.005 ? 0 : value);
export const brlCompacto = (value: number) => realCompacto.format(value);
export const pct = (value: number) => porcento.format(value);

/** Valor em centavos digitado num campo ("1.234,56") para número. */
export function parseMoney(text: string): number {
  const digits = text.replace(/\D/g, '');
  return digits ? Number(digits) / 100 : 0;
}

/** Número para o texto do campo de valor ("1.234,56"). */
export function moneyInput(value: number): string {
  if (!value) return '';
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** "2026-10-05" → "05 out." */
export function shortDate(iso: string): string {
  const date = new Date(`${iso}T12:00:00`);
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

export function fullDate(iso: string): string {
  const date = new Date(`${iso}T12:00:00`);
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function plural(n: number, um: string, varios: string) {
  return `${n} ${n === 1 ? um : varios}`;
}

/** Classe de cor para um valor com sinal: verde se positivo, vermelho se negativo, neutro se zero. */
export function tom(value: number): string {
  return value > 0.004 ? 'positivo' : value < -0.004 ? 'negativo' : '';
}
