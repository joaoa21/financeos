import { useMemo, useState } from 'react';
import { CategoriasChart, FluxoChart } from '../components/Charts.tsx';
import { Segmented } from '../components/Form.tsx';
import { useData } from '../data.tsx';
import { pct, tom } from '../format.ts';
import { gastosPorCategoria, resumo } from '../model/calc.ts';
import { monthName, shiftKey, shortMonthName } from '../model/dates.ts';
import { emptyMonth } from '../model/migrate.ts';
import { Money } from '../prefs.tsx';
import { useUi } from '../ui.tsx';

export function Relatorios() {
  const { estado } = useData();
  const ui = useUi();
  const [periodo, setPeriodo] = useState<'6' | '12'>('12');
  const n = Number(periodo);

  const meses = useMemo(
    () =>
      Array.from({ length: n }, (_, i) => {
        const key = shiftKey(ui.mes, i - n + 1);
        const m = estado[key];
        const r = m ? resumo(m, ui.cdi.anual) : null;
        return { key, existe: !!m, renda: r?.rendaPrevista ?? 0, despesa: r?.despesaPrevista ?? 0, sobra: r?.sobra ?? 0, investido: r?.aportesConta ?? 0, economia: r?.economia ?? null };
      }),
    [estado, ui.mes, ui.cdi.anual, n],
  );

  const comDados = meses.filter((m) => m.existe);
  const totalRenda = comDados.reduce((s, m) => s + m.renda, 0);
  const totalDespesa = comDados.reduce((s, m) => s + m.despesa, 0);
  const totalInvestido = comDados.reduce((s, m) => s + m.investido, 0);
  const mediaDespesa = comDados.length ? totalDespesa / comDados.length : 0;

  const categorias = useMemo(() => {
    const juntos = emptyMonth();
    for (const m of meses) if (estado[m.key]) juntos.despesas.push(...estado[m.key]!.despesas);
    return gastosPorCategoria(juntos);
  }, [estado, meses]);

  return (
    <div className="pagina">
      <div className="barra-pagina">
        <p className="barra-pagina__texto">
          De {monthName(meses[0]!.key)} a {monthName(ui.mes)}
        </p>
        <Segmented
          ariaLabel="Período"
          value={periodo}
          onChange={setPeriodo}
          options={[
            { value: '6', label: '6 meses' },
            { value: '12', label: '12 meses' },
          ]}
        />
      </div>

      {comDados.length === 0 ? (
        <section className="cartao boas-vindas">
          <span className="boas-vindas__icone" aria-hidden="true">
            📊
          </span>
          <h2>Ainda não há meses para comparar</h2>
          <p>Os relatórios aparecem conforme você registra seus meses.</p>
        </section>
      ) : (
        <>
          <section className="destaques" aria-label="Totais do período">
            <article className="cartao destaque">
              <span className="destaque__rotulo">Renda no período</span>
              <Money value={totalRenda} className="destaque__valor" />
            </article>
            <article className="cartao destaque">
              <span className="destaque__rotulo">Despesas no período</span>
              <Money value={totalDespesa} className="destaque__valor" />
              <p className="destaque__sub">
                Média de <Money value={mediaDespesa} /> por mês
              </p>
            </article>
            <article className="cartao destaque">
              <span className="destaque__rotulo">Guardado</span>
              <Money value={totalRenda - totalDespesa} sinal className={`destaque__valor ${tom(totalRenda - totalDespesa)}`} />
              <p className="destaque__sub">{totalRenda > 0 ? `${pct((totalRenda - totalDespesa) / totalRenda)} da renda` : '—'}</p>
            </article>
            <article className="cartao destaque">
              <span className="destaque__rotulo">Investido da conta</span>
              <Money value={totalInvestido} className="destaque__valor" />
            </article>
          </section>

          <section className="cartao bloco" aria-labelledby="t-fluxo-rel">
            <header className="bloco__topo">
              <h2 id="t-fluxo-rel">Renda e despesas por mês</h2>
              <span className="bloco__extra">Clique num mês para abri-lo</span>
            </header>
            <FluxoChart
              altura={260}
              pontos={meses.map((m) => ({ key: m.key, label: shortMonthName(m.key), renda: m.renda, despesa: m.despesa, atual: m.key === ui.mes }))}
              onSelect={(key) => {
                ui.setMes(key);
                ui.go('visao');
              }}
            />
          </section>

          <div className="grade-visao">
            <section className="cartao bloco bloco--largo" aria-labelledby="t-tabela">
              <header className="bloco__topo">
                <h2 id="t-tabela">Mês a mês</h2>
              </header>
              <div className="tabela-rolagem">
                <table className="tabela">
                  <thead>
                    <tr>
                      <th scope="col">Mês</th>
                      <th scope="col">Renda</th>
                      <th scope="col">Despesas</th>
                      <th scope="col">Sobra prevista</th>
                      <th scope="col">Guardou</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...meses].reverse().map((m) => (
                      <tr key={m.key} className={m.existe ? undefined : 'tabela__vazia'}>
                        <th scope="row">
                          <button
                            type="button"
                            className="link"
                            onClick={() => {
                              ui.setMes(m.key);
                              ui.go('visao');
                            }}
                          >
                            {monthName(m.key)}
                          </button>
                          {estado[m.key]?.fechado && <span className="selo selo--neutro">Fechado</span>}
                        </th>
                        {m.existe ? (
                          <>
                            <td><Money value={m.renda} /></td>
                            <td><Money value={m.despesa} /></td>
                            <td className={m.sobra < 0 ? 'negativo' : undefined}><Money value={m.sobra} /></td>
                            <td>{m.economia === null ? '—' : pct(m.economia)}</td>
                          </>
                        ) : (
                          <td colSpan={4} className="tabela__sem">Sem dados</td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="cartao bloco" aria-labelledby="t-cat-rel">
              <header className="bloco__topo">
                <h2 id="t-cat-rel">Gastos por categoria</h2>
              </header>
              {categorias.length ? <CategoriasChart itens={categorias} limite={8} /> : <div className="vazio"><p>Sem despesas no período.</p></div>}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
