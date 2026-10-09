// Conferência do que o site manda salvar. Não é a regra de negócio (essa fica no site),
// é a garantia de que só entra no banco algo com o formato esperado e de tamanho razoável.

const MONTH_KEY = /^\d{4}-(0[1-9]|1[0-2])$/;
const MAX_MONTHS = 600; // 50 anos
const MAX_ITEMS = 1000; // por lista, por mês
const MAX_STRING = 500;
const MAX_DEPTH = 6;
const LISTS = ['despesas', 'rendas', 'investimentos'];

/** Devolve null se estiver tudo certo, ou uma frase dizendo o que está errado. */
export function invalidState(data) {
  if (!isPlainObject(data)) return 'data deve ser um objeto';
  const keys = Object.keys(data);
  if (keys.length > MAX_MONTHS) return 'meses demais';
  for (const key of keys) {
    if (!MONTH_KEY.test(key)) return `mês inválido: ${key.slice(0, 20)}`;
    const month = data[key];
    if (!isPlainObject(month)) return `${key}: deve ser um objeto`;
    for (const list of LISTS) {
      if (month[list] === undefined) continue;
      if (!Array.isArray(month[list])) return `${key}.${list}: deve ser uma lista`;
      if (month[list].length > MAX_ITEMS) return `${key}.${list}: itens demais`;
      if (!month[list].every(isPlainObject)) return `${key}.${list}: itens inválidos`;
    }
    if (month.saldoInicial !== undefined && !Number.isFinite(month.saldoInicial)) return `${key}.saldoInicial: número inválido`;
    const problem = invalidValue(month, 0);
    if (problem) return `${key}: ${problem}`;
  }
  return null;
}

function invalidValue(value, depth) {
  if (depth > MAX_DEPTH) return 'estrutura profunda demais';
  if (value === null || typeof value === 'boolean') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? null : 'número inválido';
  if (typeof value === 'string') return value.length > MAX_STRING ? 'texto longo demais' : null;
  if (Array.isArray(value)) {
    if (value.length > MAX_ITEMS) return 'lista longa demais';
    for (const item of value) {
      const problem = invalidValue(item, depth + 1);
      if (problem) return problem;
    }
    return null;
  }
  if (isPlainObject(value)) {
    for (const [key, item] of Object.entries(value)) {
      if (key.length > 64) return 'nome de campo longo demais';
      const problem = invalidValue(item, depth + 1);
      if (problem) return problem;
    }
    return null;
  }
  return 'tipo inválido';
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
