// Categorias das despesas. A lista é fixa (simples de entender); "outros" cobre o resto.

export interface Categoria {
  id: string;
  nome: string;
  /** Cor do ícone (identidade da categoria; os gráficos não dependem dela). */
  cor: string;
  /** Palavras que, no nome da despesa, sugerem esta categoria. */
  palavras: string[];
}

export const CATEGORIAS: Categoria[] = [
  { id: 'moradia', nome: 'Moradia', cor: '#7C6AF2', palavras: ['aluguel', 'condominio', 'condomínio', 'iptu', 'financiamento casa', 'prestação casa'] },
  { id: 'contas', nome: 'Contas da casa', cor: '#D99A00', palavras: ['luz', 'energia', 'agua', 'água', 'gás', 'gas', 'internet', 'telefone', 'celular', 'vivo', 'claro', 'tim', 'enel', 'cemig', 'sabesp'] },
  { id: 'mercado', nome: 'Mercado', cor: '#16A34A', palavras: ['mercado', 'supermercado', 'feira', 'hortifruti', 'açougue', 'padaria'] },
  { id: 'alimentacao', nome: 'Restaurantes e delivery', cor: '#EA580C', palavras: ['ifood', 'restaurante', 'lanche', 'delivery', 'rappi', 'almoço', 'jantar'] },
  { id: 'transporte', nome: 'Transporte', cor: '#2563EB', palavras: ['uber', '99', 'gasolina', 'combustível', 'combustivel', 'estacionamento', 'ipva', 'seguro carro', 'carro', 'ônibus', 'metrô', 'pedágio'] },
  { id: 'saude', nome: 'Saúde', cor: '#E11D48', palavras: ['farmácia', 'farmacia', 'plano de saúde', 'plano de saude', 'unimed', 'médico', 'medico', 'dentista', 'academia', 'terapia', 'remédio'] },
  { id: 'educacao', nome: 'Educação', cor: '#0891B2', palavras: ['escola', 'faculdade', 'curso', 'livro', 'mensalidade', 'udemy', 'alura'] },
  { id: 'assinaturas', nome: 'Assinaturas', cor: '#9333EA', palavras: ['netflix', 'spotify', 'amazon', 'prime', 'disney', 'hbo', 'max', 'youtube', 'icloud', 'google one', 'chatgpt', 'claude', 'assinatura', 'globoplay'] },
  { id: 'lazer', nome: 'Lazer e viagens', cor: '#0EA5E9', palavras: ['viagem', 'cinema', 'show', 'bar', 'passeio', 'hotel', 'passagem', 'ingresso'] },
  { id: 'compras', nome: 'Compras', cor: '#DB2777', palavras: ['roupa', 'shopee', 'mercado livre', 'shein', 'presente', 'loja'] },
  { id: 'cuidados', nome: 'Cuidados pessoais', cor: '#C026D3', palavras: ['cabelo', 'salão', 'barbearia', 'manicure', 'estética'] },
  { id: 'pets', nome: 'Pets', cor: '#A16207', palavras: ['pet', 'ração', 'veterinário', 'veterinario'] },
  { id: 'impostos', nome: 'Impostos e taxas', cor: '#64748B', palavras: ['imposto', 'das', 'mei', 'taxa', 'tarifa', 'anuidade', 'irpf', 'inss'] },
  { id: 'dividas', nome: 'Dívidas e empréstimos', cor: '#DC2626', palavras: ['empréstimo', 'emprestimo', 'parcela', 'fatura', 'cartão', 'cartao', 'consignado'] },
  { id: 'outros', nome: 'Outros', cor: '#78716C', palavras: [] },
];

export const SEM_CATEGORIA: Categoria = { id: '', nome: 'Sem categoria', cor: '#A8A29E', palavras: [] };

export function categoria(id: string | null | undefined): Categoria {
  return CATEGORIAS.find((c) => c.id === id) ?? SEM_CATEGORIA;
}

/** Sugere a categoria pelo nome da despesa (ex.: "Netflix" → Assinaturas). */
export function sugerirCategoria(nome: string): string | null {
  const texto = ` ${nome.toLowerCase()} `;
  for (const c of CATEGORIAS) {
    if (c.palavras.some((p) => new RegExp(`[^\\p{L}\\d]${escapeRegex(p)}[^\\p{L}\\d]`, 'u').test(texto))) return c.id;
  }
  return null;
}

function escapeRegex(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Sugere o tipo pelo nome (ex.: "Tesouro Selic" → Tesouro Direto, "HGLG11" → FII). */
export function sugerirTipo(nome: string): string | null {
  // Palavra inteira: espaço, parêntese, barra ou hífen em volta (ou início/fim).
  const n = ` ${nome.toLowerCase()} `;
  const tem = (re: string) => new RegExp(`[\\s(/-](${re})[\\s)/-]`, 'u').test(n);
  if (tem('tesouro')) return 'Tesouro Direto';
  if (tem('cdb|rdb')) return 'CDB';
  if (tem('lci|lca|cri|cra|deb[eê]ntures?|poupan[cç]a')) return 'Renda Fixa';
  if (tem('fii|fiis|[a-z]{4}11')) return 'FII';
  if (tem('bitcoin|btc|eth|ethereum|cripto|criptomoedas?')) return 'Criptomoedas';
  if (tem('previd[eê]ncia|pgbl|vgbl')) return 'Previdência';
  if (tem('[a-z]{4}[3-6]|a[cç][oõ]es')) return 'Ações';
  return null;
}
