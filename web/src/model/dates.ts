// Meses e dias. As chaves de mês são "AAAA-MM"; datas completas, "AAAA-MM-DD".

export const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export function monthKey(year: number, month: number): string {
  const date = new Date(year, month, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function parseKey(key: string): { year: number; month: number } {
  const [y, m] = key.split('-');
  return { year: Number(y), month: Number(m) - 1 };
}

export function shiftKey(key: string, delta: number): string {
  const { year, month } = parseKey(key);
  return monthKey(year, month + delta);
}

export function isMonthKey(value: string | null): value is string {
  return !!value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

/** Data de hoje no horário do aparelho, como "AAAA-MM-DD". */
export function todayISO(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function currentKey(now = new Date()): string {
  return monthKey(now.getFullYear(), now.getMonth());
}

export function monthName(key: string): string {
  const { year, month } = parseKey(key);
  return `${MESES[month]} ${year}`;
}

export function shortMonthName(key: string): string {
  const { year, month } = parseKey(key);
  return `${MESES[month]!.slice(0, 3)}/${String(year).slice(2)}`;
}

export function daysInMonth(key: string): number {
  const { year, month } = parseKey(key);
  return new Date(year, month + 1, 0).getDate();
}

/** Comparação de meses: negativo se `a` vem antes de `b`. */
export function compareKeys(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Dias úteis (segunda a sexta) depois de `from` até `to`, inclusive `to`.
 * Um aporte feito hoje ainda não rendeu nada hoje. Feriados não entram na conta
 * (por isso o rendimento é uma estimativa).
 */
export function businessDaysBetween(from: string, to: string): number {
  const start = new Date(`${from}T12:00:00`);
  const end = new Date(`${to}T12:00:00`);
  if (!(start < end)) return 0;
  const totalDays = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  const weeks = Math.floor(totalDays / 7);
  let count = weeks * 5;
  const cursor = new Date(start);
  cursor.setDate(cursor.getDate() + weeks * 7);
  while (cursor < end) {
    cursor.setDate(cursor.getDate() + 1);
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) count++;
  }
  return count;
}
