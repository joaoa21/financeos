import { useState } from 'react';
import { IconCheck, IconCircle, IconDots, IconPencil, IconPlus, IconTrash, IconTrend } from '../components/Icons.tsx';
import { Menu } from '../components/Menu.tsx';
import { fullDate, plural, tom } from '../format.ts';
import { valorInvestimento } from '../model/calc.ts';
import type { Investimento } from '../model/types.ts';
import { Money } from '../prefs.tsx';
import { useActions, useMes, useUi } from '../ui.tsx';

export function Investimentos() {
  const { mes } = useMes();
  const ui = useUi();
  const valores = mes.investimentos.map((i) => ({ inv: i, v: valorInvestimento(i, ui.cdi.anual) }));
  const carteira = valores.reduce((s, x) => s + x.v.atual, 0);
  const investido = valores.reduce((s, x) => s + x.v.investido, 0);
  const rendimento = carteira - investido;
  const previsto = valores.reduce((s, x) => s + x.v.previsto, 0);
  const cdiTexto = `${ui.cdi.anual.toFixed(2).replace('.', ',')}% a.a.`;

  return (
    <div className="pagina">
      <div className="barra-pagina">
        <span className={`cdi cdi--${ui.cdi.fonte}`} title={ui.cdi.fonte === 'bc' ? 'Taxa do Banco Central de hoje' : ui.cdi.fonte === 'cache' ? 'Última taxa conhecida do Banco Central' : 'Sem conexão com o Banco Central: taxa aproximada'}>
          <i aria-hidden="true" /> CDI {ui.cdi.fonte === 'reserva' ? '≈ ' : ''}
          {cdiTexto}
        </span>
        <div className="barra-pagina__acoes">
          <button type="button" className="btn" onClick={ui.novoInvestimento}>
            <IconPlus size={18} /> Novo investimento
          </button>
        </div>
      </div>

      {mes.investimentos.length === 0 ? (
        <section className="cartao boas-vindas">
          <span className="boas-vindas__icone" aria-hidden="true">
            📈
          </span>
          <h2>Nenhum investimento neste mês</h2>
          <p>Cadastre seus CDBs, Tesouro e ações. Os que rendem pelo CDI têm o valor atualizado todo dia útil com a taxa do Banco Central.</p>
          <div className="boas-vindas__acoes">
            <button type="button" className="btn" onClick={ui.novoInvestimento}>
              Adicionar investimento
            </button>
            <button type="button" className="btn btn--secundario" onClick={() => ui.prepararMes(ui.mes)}>
              Trazer do mês anterior
            </button>
          </div>
        </section>
      ) : (
        <>
          <section className="destaques destaques--3" aria-label="Resumo da carteira">
            <article className="cartao destaque destaque--principal">
              <span className="destaque__rotulo">
                <IconTrend size={16} /> Carteira hoje
              </span>
              <Money value={carteira} className="destaque__valor destaque__valor--grande" />
              <p className="destaque__sub">{plural(mes.investimentos.length, 'investimento', 'investimentos')} · valores estimados</p>
            </article>
            <article className="cartao destaque">
              <span className="destaque__rotulo">Investido</span>
              <Money value={investido} className="destaque__valor" />
              {previsto > 0 && (
                <p className="destaque__sub">
                  + <Money value={previsto} /> em aportes previstos
                </p>
              )}
            </article>
            <article className="cartao destaque">
              <span className="destaque__rotulo">Rendimento</span>
              <Money value={rendimento} sinal className={`destaque__valor ${tom(rendimento)}`} />
              <p className="destaque__sub">{investido > 0 ? `${((rendimento / investido) * 100).toFixed(2).replace('.', ',')}% sobre o investido` : '—'}</p>
            </article>
          </section>

          <div className="grade-inv">
            {valores.map(({ inv }) => (
              <CartaoInvestimento key={inv.id} inv={inv} />
            ))}
          </div>
          <p className="nota-rodape">
            O rendimento pelo CDI é uma estimativa: considera dias úteis (sem feriados) e não desconta impostos. Ao fechar o mês, cada investimento passa para o seguinte com o valor do dia.
          </p>
        </>
      )}
    </div>
  );
}

function CartaoInvestimento({ inv }: { inv: Investimento }) {
  const ui = useUi();
  const actions = useActions();
  const v = valorInvestimento(inv, ui.cdi.anual);
  const [aberto, setAberto] = useState(inv.aportes.length <= 4);
  const aportes = [...inv.aportes].sort((a, b) => a.data.localeCompare(b.data));

  return (
    <article className="cartao inv">
      <header className="inv__topo">
        <div>
          <h3 className="inv__nome">{inv.nome}</h3>
          <span className="inv__tipo">
            {inv.tipo}
            {inv.percentualCDI ? ` · ${inv.percentualCDI}% do CDI` : ''}
          </span>
        </div>
        <Menu
          ariaLabel={`Ações de "${inv.nome}"`}
          trigger={() => <IconDots size={18} />}
          items={[
            { label: 'Novo aporte', icon: <IconPlus size={16} />, onClick: () => ui.novoAporte(inv.id) },
            { label: 'Editar', icon: <IconPencil size={16} />, onClick: () => ui.editarInvestimento(inv.id) },
            'separador',
            { label: 'Excluir deste mês', icon: <IconTrash size={16} />, danger: true, onClick: () => actions.removerInvestimento(inv.id) },
          ]}
        />
      </header>
      <Money value={v.atual} className="inv__valor" />
      <p className="inv__rend">
        <Money value={v.rendimento} sinal className={tom(v.rendimento)} />
        {v.investido > 0 && !!inv.percentualCDI && <span> ({((v.rendimento / v.investido) * 100).toFixed(3).replace('.', ',')}%)</span>}
        <span className="inv__investido">
          · investido <Money value={v.investido} />
        </span>
      </p>

      {(inv.valorBase || inv.valor || aportes.length > 0) && (
        <div className="aportes">
          <button type="button" className="aportes__titulo" aria-expanded={aberto} onClick={() => setAberto((a) => !a)}>
            Histórico <span className="contagem">{aportes.length + (inv.valorBase ? 1 : 0) + (inv.valor ? 1 : 0)}</span>
          </button>
          {aberto && (
            <ul>
              {inv.valorBase && (
                <li className="aporte aporte--base">
                  <span className="aporte__marca" aria-hidden="true" />
                  <span>Trazido do mês anterior · {fullDate(inv.valorBase.data)}</span>
                  <Money value={inv.valorBase.valor} />
                </li>
              )}
              {!!inv.valor && (
                <li className="aporte aporte--base">
                  <span className="aporte__marca" aria-hidden="true" />
                  <span>Valor já investido</span>
                  <Money value={inv.valor} />
                </li>
              )}
              {aportes.map((a) => (
                <li key={a.id} className={`aporte${a.status === 'previsto' ? ' aporte--previsto' : ''}`}>
                  <button
                    type="button"
                    className={`aporte__marca aporte__marca--botao${a.status === 'feito' ? ' aporte__marca--feito' : ''}`}
                    onClick={() => actions.toggleAporte(inv.id, a.id)}
                    aria-label={a.status === 'feito' ? 'Voltar para previsto' : 'Confirmar aporte'}
                    title={a.status === 'feito' ? 'Voltar para previsto' : 'Confirmar aporte'}
                  >
                    {a.status === 'feito' ? <IconCheck size={12} /> : <IconCircle size={12} />}
                  </button>
                  <span>
                    {fullDate(a.data)}
                    <span className="aporte__info">
                      {a.status === 'previsto' ? 'Previsto' : 'Feito'} · {a.origem === 'conta' ? 'da conta' : 'de fora'}
                    </span>
                  </span>
                  <Money value={a.valor} />
                  <button type="button" className="botao-icone botao-icone--mini" aria-label="Excluir aporte" title="Excluir aporte" onClick={() => actions.removerAporte(inv.id, a.id)}>
                    <IconTrash size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <button type="button" className="btn btn--secundario btn--pequeno inv__aporte" onClick={() => ui.novoAporte(inv.id)}>
        <IconPlus size={16} /> Novo aporte
      </button>
    </article>
  );
}
