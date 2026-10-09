import { type RefObject, useEffect, useRef, useState } from 'react';
import { brl, brlCompacto } from '../format.ts';
import { categoria } from '../model/categorias.ts';
import { Money, usePrefs } from '../prefs.tsx';
import { CategoriaIcone } from './CategoriaIcone.tsx';

// Gráficos feitos à mão em SVG (sem biblioteca). Cores das séries validadas para
// daltonismo; legenda sempre visível e a tabela fica na página de relatórios.

export interface PontoFluxo {
  key: string;
  label: string;
  renda: number;
  despesa: number;
  atual?: boolean;
}

/** Topo do eixo com 4 divisões redondas (ex.: 12 mil → 3, 6, 9, 12 mil). */
function niceMax(value: number): number {
  if (value <= 0) return 100;
  const quarter = value / 4;
  const power = Math.pow(10, Math.floor(Math.log10(quarter)));
  for (const step of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 7.5, 8, 10]) if (step * power >= quarter) return step * power * 4;
  return 40 * power;
}

/** Barras agrupadas por mês: renda e despesas lado a lado. */
export function FluxoChart({ pontos, altura = 220, onSelect }: { pontos: PontoFluxo[]; altura?: number; onSelect?: (key: string) => void }) {
  const { ocultar } = usePrefs();
  const [hover, setHover] = useState<number | null>(null);
  const caixa = useRef<HTMLDivElement>(null);
  const largura = useLargura(caixa);
  const max = niceMax(Math.max(...pontos.flatMap((p) => [p.renda, p.despesa]), 0));
  const esquerda = ocultar ? 8 : 56;
  const baixo = 26;
  const topo = 10;
  const area = altura - baixo - topo;
  const grupo = (largura - esquerda) / Math.max(pontos.length, 1);
  const barra = Math.min(22, grupo * 0.3);
  const y = (v: number) => topo + area - (v / max) * area;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const atual = hover !== null ? pontos[hover] : null;

  return (
    <div className="grafico">
      <div className="grafico__legenda" aria-hidden="true">
        <span><i className="serie-renda" /> Renda</span>
        <span><i className="serie-despesa" /> Despesas</span>
      </div>
      <div className="grafico__area" ref={caixa}>
        <svg viewBox={`0 0 ${largura} ${altura}`} role="img" aria-label="Renda e despesas por mês" onMouseLeave={() => setHover(null)}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={esquerda} x2={largura} y1={y(t)} y2={y(t)} className={t === 0 ? 'grafico__base' : 'grafico__grade'} />
              {!ocultar && (
                <text x={esquerda - 8} y={y(t) + 4} textAnchor="end" className="grafico__eixo">
                  {brlCompacto(t).replace('R$', '').trim()}
                </text>
              )}
            </g>
          ))}
          {pontos.map((p, i) => {
            const cx = esquerda + grupo * i + grupo / 2;
            const hR = Math.max(p.renda > 0 ? 2 : 0, (p.renda / max) * area);
            const hD = Math.max(p.despesa > 0 ? 2 : 0, (p.despesa / max) * area);
            return (
              <g key={p.key} className={hover === i ? 'grafico__grupo grafico__grupo--ativo' : 'grafico__grupo'}>
                <rect x={esquerda + grupo * i} y={topo} width={grupo} height={area} className="grafico__alvo" onMouseEnter={() => setHover(i)} onClick={() => onSelect?.(p.key)} />
                <path d={bar(cx - barra - 1, y(0), barra, hR)} className="serie-renda" />
                <path d={bar(cx + 1, y(0), barra, hD)} className="serie-despesa" />
                <text x={cx} y={altura - 8} textAnchor="middle" className={`grafico__eixo${p.atual ? ' grafico__eixo--atual' : ''}`}>
                  {p.label}
                </text>
              </g>
            );
          })}
        </svg>
        {atual && hover !== null && (
          <div className="grafico__dica" style={{ left: `${((esquerda + grupo * hover + grupo / 2) / largura) * 100}%` }}>
            <strong>{atual.label}</strong>
            <span><i className="serie-renda" /> Renda <Money value={atual.renda} /></span>
            <span><i className="serie-despesa" /> Despesas <Money value={atual.despesa} /></span>
            <span className="grafico__dica-saldo">Saldo <Money value={atual.renda - atual.despesa} sinal /></span>
          </div>
        )}
      </div>
    </div>
  );
}

/** Largura do contêiner (o gráfico redesenha ao mudar o tamanho da tela). */
function useLargura(ref: RefObject<HTMLDivElement | null>) {
  const [w, setW] = useState(640);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new ResizeObserver(([entry]) => entry && setW(Math.max(280, Math.round(entry.contentRect.width))));
    obs.observe(el);
    return () => obs.disconnect();
  }, [ref]);
  return w;
}

/** Barra com o topo arredondado (4px) e a base reta no eixo. */
function bar(x: number, base: number, w: number, h: number) {
  if (h <= 0) return '';
  const r = Math.min(4, w / 2, h);
  return `M${x},${base} V${base - h + r} Q${x},${base - h} ${x + r},${base - h} H${x + w - r} Q${x + w},${base - h} ${x + w},${base - h + r} V${base} Z`;
}

/** Gastos por categoria: barras horizontais com o valor e a fatia do total. */
export function CategoriasChart({ itens, limite = 6 }: { itens: { id: string; total: number }[]; limite?: number }) {
  const total = itens.reduce((s, i) => s + i.total, 0);
  const visiveis = itens.slice(0, limite);
  const resto = itens.slice(limite).reduce((s, i) => s + i.total, 0);
  const linhas = resto > 0 ? [...visiveis, { id: '__resto', total: resto }] : visiveis;
  const max = Math.max(...linhas.map((l) => l.total), 1);
  return (
    <ul className="categorias">
      {linhas.map((l) => {
        const resto = l.id === '__resto';
        const c = resto ? { nome: 'Demais categorias' } : categoria(l.id);
        return (
          <li key={l.id} title={`${c.nome}: ${brl(l.total)}`}>
            <span className="categorias__icone">
              <CategoriaIcone id={resto ? 'outros' : l.id} tamanho={30} />
            </span>
            <span className="categorias__nome">{c.nome}</span>
            <span className="categorias__valor">
              <Money value={l.total} />
              <span className="categorias__pct">{Math.round((l.total / total) * 100)}%</span>
            </span>
            <span className="categorias__trilho" aria-hidden="true">
              <span style={{ width: `${(l.total / max) * 100}%` }} />
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** Barra de progresso simples (ex.: quanto das despesas já foi pago). */
export function Progresso({ valor, total, tom }: { valor: number; total: number; tom: 'renda' | 'despesa' }) {
  const pct = total > 0 ? Math.min(100, (valor / total) * 100) : 0;
  return (
    <span className={`progresso progresso--${tom}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
      <span style={{ width: `${pct}%` }} />
    </span>
  );
}
