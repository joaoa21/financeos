import type { CSSProperties, ReactNode } from 'react';
import { categoria } from '../model/categorias.ts';
import type { FormaOuSem } from '../model/calc.ts';

// Ícones das categorias e das formas de pagamento: mesmo traço dos ícones do menu
// (estilo Lucide), dentro de um quadrado com o fundo tingido pela cor da categoria.

const DESENHOS: Record<string, ReactNode> = {
  moradia: (
    <>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9v11a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9" />
    </>
  ),
  contas: <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />,
  mercado: (
    <>
      <circle cx="8" cy="20.5" r="1.3" />
      <circle cx="18" cy="20.5" r="1.3" />
      <path d="M2.5 3h2.2l2.5 12.1a2 2 0 0 0 2 1.6h8.7a2 2 0 0 0 1.9-1.5L21.5 8H5.6" />
    </>
  ),
  alimentacao: (
    <>
      <path d="M4 2.5v6.5a2.5 2.5 0 0 0 2.5 2.5h1A2.5 2.5 0 0 0 10 9V2.5M7 2.5v19" />
      <path d="M20 15V2.5a4.5 4.5 0 0 0-4.5 4.5v6a2 2 0 0 0 2 2H20Zm0 0v6.5" />
    </>
  ),
  transporte: (
    <>
      <path d="M5 17H3.5a1 1 0 0 1-1-1v-3.3a2 2 0 0 1 .3-1L5 8h10.5l3.5 3.6 2.2.6a1 1 0 0 1 .8 1V16a1 1 0 0 1-1 1H19" />
      <path d="M9 17h6M5.5 11.5h13" />
      <circle cx="7" cy="17" r="2" />
      <circle cx="17" cy="17" r="2" />
    </>
  ),
  saude: (
    <>
      <path d="M19.5 13.5C21 12 22 10.4 22 8.5A5.5 5.5 0 0 0 12 5.3 5.5 5.5 0 0 0 2 8.5c0 2 1 3.5 2.5 5L12 21l7.5-7.5Z" />
      <path d="M3.5 12h5l1.5-3 3 6 1.5-3h6" />
    </>
  ),
  educacao: (
    <>
      <path d="M22 9.5 12 4.5 2 9.5l10 5 10-5Z" />
      <path d="M6 11.5V16c3.3 3 8.7 3 12 0v-4.5M22 9.5v5" />
    </>
  ),
  assinaturas: (
    <>
      <rect x="2.5" y="6.5" width="19" height="14" rx="2.5" />
      <path d="m16.5 2.5-4.5 4-4.5-4" />
      <path d="m10.5 11 4 2.5-4 2.5Z" />
    </>
  ),
  lazer: <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2a1 1 0 0 0-1.1.5l-.3.5a1 1 0 0 0 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3a1 1 0 0 0 1.3.3l.5-.2a1 1 0 0 0 .5-1.2Z" />,
  compras: (
    <>
      <path d="M6 2.5 3.5 6v13.5a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2V6L18 2.5Z" />
      <path d="M3.5 6h17M16 10a4 4 0 0 1-8 0" />
    </>
  ),
  cuidados: (
    <>
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12" />
    </>
  ),
  pets: (
    <>
      <circle cx="11" cy="4.5" r="2" />
      <circle cx="18" cy="8" r="2" />
      <circle cx="20" cy="15.5" r="2" />
      <path d="M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.8 1C6.5 17.5 5.5 17 4.5 16.8A3.5 3.5 0 0 1 5.5 10Z" />
    </>
  ),
  impostos: (
    <>
      <path d="M4.5 2.5v19l2-1 2 1 2-1 2 1 2-1 2 1 2-1 1 .5v-19l-1 .5-2-1-2 1-2-1-2 1-2-1-2 1-2-1Z" />
      <path d="M15.5 8.5h-5a1.75 1.75 0 0 0 0 3.5h3a1.75 1.75 0 0 1 0 3.5h-5M12 7v10" />
    </>
  ),
  dividas: (
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
      <path d="M2.5 10h19M6.5 15h3" />
    </>
  ),
  outros: (
    <>
      <path d="M21 8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.7Z" />
      <path d="m3.3 7 8.7 5 8.7-5M12 22V12" />
    </>
  ),
  '': (
    <>
      <path d="M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4Z" />
      <circle cx="7.5" cy="7.5" r="1.2" />
    </>
  ),
};

const FORMAS: Record<FormaOuSem, { desenho: ReactNode; cor: string; nome: string }> = {
  cartao: {
    nome: 'Cartão',
    cor: '#7C6AF2',
    desenho: (
      <>
        <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
        <path d="M2.5 10h19M6.5 15h3" />
      </>
    ),
  },
  boleto: {
    nome: 'Boleto',
    cor: '#0891B2',
    desenho: <path d="M3.5 5v14M6.5 5v14M10 5v14M12.5 5v14M16 5v14M18 5v14M20.5 5v14" />,
  },
  pix: {
    nome: 'Pix/débito',
    cor: '#16A34A',
    desenho: <path d="M8 3 4 7l4 4M4 7h16M16 21l4-4-4-4M20 17H4" />,
  },
  sem: {
    nome: 'Sem forma definida',
    cor: '#A8A29E',
    desenho: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5v.5M12 17h.01" />
      </>
    ),
  },
};

function Quadro({ cor, tamanho, children, titulo }: { cor: string; tamanho: number; children: ReactNode; titulo?: string }) {
  return (
    <span className="icone-quadro" style={{ '--cor': cor, width: tamanho, height: tamanho } as CSSProperties} title={titulo} aria-hidden={titulo ? undefined : true}>
      <svg
        width={Math.round(tamanho * 0.5)}
        height={Math.round(tamanho * 0.5)}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {children}
      </svg>
    </span>
  );
}

export function CategoriaIcone({ id, tamanho = 36 }: { id: string | null | undefined; tamanho?: number }) {
  const c = categoria(id);
  return (
    <Quadro cor={c.cor} tamanho={tamanho}>
      {DESENHOS[c.id] ?? DESENHOS['']}
    </Quadro>
  );
}

export function FormaIcone({ forma, tamanho = 36 }: { forma: FormaOuSem; tamanho?: number }) {
  const f = FORMAS[forma];
  return (
    <Quadro cor={f.cor} tamanho={tamanho}>
      {f.desenho}
    </Quadro>
  );
}

export const nomeForma = (forma: FormaOuSem) => FORMAS[forma].nome;

export function RendaIcone({ tamanho = 36 }: { tamanho?: number }) {
  return (
    <Quadro cor="#0F8A5F" tamanho={tamanho}>
      <rect x="2.5" y="6" width="19" height="12" rx="2.5" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M6 12h.01M18 12h.01" />
    </Quadro>
  );
}

/** Ícone grande das telas vazias (boas-vindas, mês em branco). */
export function IconeDestaque({ children }: { children: ReactNode }) {
  return (
    <span className="icone-destaque" aria-hidden="true">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </span>
  );
}
