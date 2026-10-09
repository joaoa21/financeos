import { plural } from '../format.ts';
import { type FormaOuSem, totaisPorForma } from '../model/calc.ts';
import type { Mes } from '../model/types.ts';
import { Money } from '../prefs.tsx';
import { FormaIcone, nomeForma } from './CategoriaIcone.tsx';
import { IconCheck } from './Icons.tsx';

// Total das despesas do mês por forma de pagamento (cartão, boleto, pix/débito):
// é o valor a separar para cada conta assim que a renda cai.
// Com `onSelect`, cada cartão vira um filtro (clicar de novo tira o filtro).

export function PorForma({ mes, selecionada, onSelect }: { mes: Mes; selecionada?: FormaOuSem | ''; onSelect?: (forma: FormaOuSem | '') => void }) {
  const totais = totaisPorForma(mes).filter((t) => t.quantidade > 0);
  if (!totais.length) return null;
  return (
    <section className="por-forma" aria-label="Total por forma de pagamento">
      {totais.map((t) => {
        const conteudo = (
          <>
            <span className="por-forma__topo">
              <FormaIcone forma={t.forma} tamanho={30} />
              <span className="por-forma__nome">{nomeForma(t.forma)}</span>
              <span className="por-forma__qtd">{plural(t.quantidade, 'conta', 'contas')}</span>
            </span>
            <Money value={t.total} className="por-forma__total" />
            <span className={`por-forma__falta${t.falta < 0.005 ? ' por-forma__falta--ok' : ''}`}>
              {t.forma === 'sem' && t.falta >= 0.005 ? (
                'Edite as despesas para escolher a forma'
              ) : t.falta < 0.005 ? (
                <>
                  <IconCheck size={14} /> Tudo pago
                </>
              ) : t.pago > 0.004 ? (
                <>
                  Falta <Money value={t.falta} /> · pago <Money value={t.pago} />
                </>
              ) : (
                'Nada pago ainda'
              )}
            </span>
          </>
        );
        return onSelect ? (
          <button
            key={t.forma}
            type="button"
            className="cartao por-forma__item por-forma__item--botao"
            aria-pressed={selecionada === t.forma}
            title={selecionada === t.forma ? 'Mostrar todas as formas' : `Mostrar só ${nomeForma(t.forma).toLowerCase()}`}
            onClick={() => onSelect(selecionada === t.forma ? '' : t.forma)}
          >
            {conteudo}
          </button>
        ) : (
          <div key={t.forma} className="cartao por-forma__item">
            {conteudo}
          </div>
        );
      })}
    </section>
  );
}
