import { useMemo, useState } from 'react';
import { CategoriasChart, FluxoChart, Progresso } from '../components/Charts.tsx';
import { IconAlert, IconArrowDown, IconArrowUp, IconCalendar, IconChevronRight, IconLock, IconPencil, IconPiggy, IconSparkle, IconTrend, IconWallet } from '../components/Icons.tsx';
import { Lista, type LinhaLancamento } from '../components/Lista.tsx';
import { Confirm } from '../components/Modal.tsx';
import { useData } from '../data.tsx';
import { pct, plural, tom } from '../format.ts';
import { gastosPorCategoria, mesAnteriorComDados, resumo, situacao, valorDespesa, valorRenda } from '../model/calc.ts';
import { compareKeys, currentKey, monthName, shiftKey, shortMonthName } from '../model/dates.ts';
import { Money } from '../prefs.tsx';
import { useMes, useUi } from '../ui.tsx';

export function Visao() {
  const { estado, legado, importarLegado, descartarLegado } = useData();
  const ui = useUi();
  const { mes, key, existe } = useMes();
  const r = resumo(mes, ui.cdi.anual);
  const hoje = currentKey();
  const ehAtual = key === hoje;
  const passado = compareKeys(key, hoje) < 0;

  const pendentes = useMemo<LinhaLancamento[]>(() => {
    const linhas: LinhaLancamento[] = [
      ...mes.despesas.map((d) => ({ kind: 'despesa' as const, item: d, situacao: situacao(d, key) })),
      ...mes.rendas.map((rd) => ({ kind: 'renda' as const, item: rd, situacao: situacao(rd, key) })),
    ];
    const ordem = { atrasado: 0, hoje: 1, pendente: 2, agendado: 3, pago: 4 };
    return linhas
      .filter((l) => l.situacao !== 'pago')
      .sort((a, b) => ordem[a.situacao] - ordem[b.situacao] || (a.item.data ?? 99) - (b.item.data ?? 99));
  }, [mes, key]);

  const fluxo = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => {
        const k = shiftKey(key, i - 5);
        const m = estado[k];
        return {
          key: k,
          label: shortMonthName(k),
          renda: m ? m.rendas.reduce((s, x) => s + valorRenda(x), 0) : 0,
          despesa: m ? m.despesas.reduce((s, x) => s + valorDespesa(x), 0) : 0,
          atual: k === key,
        };
      }),
    [estado, key],
  );

  const categorias = gastosPorCategoria(mes);
  const atrasados = pendentes.filter((l) => l.situacao === 'atrasado');
  const semCategoria = mes.despesas.filter((d) => !d.categoria).length;

  if (!existe) return <MesVazio />;

  return (
    <div className="pagina">
      {legado && <AvisoLegado meses={legado.meses} onImportar={importarLegado} onDescartar={descartarLegado} />}

      <section className="destaques" aria-label="Resumo do mês">
        <article className="cartao destaque destaque--principal">
          <div className="destaque__topo">
            <span className="destaque__rotulo">
              <IconWallet size={16} /> Na conta {ehAtual ? 'agora' : passado ? 'no fim do mês' : 'previsto'}
            </span>
          </div>
          <Money value={r.naConta} className={`destaque__valor destaque__valor--grande${r.naConta < 0 ? ' negativo' : ''}`} />
          <p className="destaque__sub">
            Começou com <Money value={r.saldoInicial} />{' '}
            <button type="button" className="link link--pequeno" onClick={ui.editarSaldo}>
              <IconPencil size={13} /> editar
            </button>
            {r.agendado > 0 && (
              <>
                {' · '}
                <Money value={r.agendado} /> agendado
              </>
            )}
          </p>
        </article>

        <article className="cartao destaque">
          <span className="destaque__rotulo">
            <IconPiggy size={16} /> Sobra prevista
          </span>
          <Money value={r.sobra} className={`destaque__valor${r.sobra < 0 ? ' negativo' : ''}`} />
          <p className="destaque__sub">
            {r.economia === null ? 'Cadastre sua renda para ver quanto guarda' : r.economia >= 0 ? `Você guarda ${pct(r.economia)} da renda` : `Gastos acima da renda em ${pct(-r.economia)}`}
          </p>
        </article>

        <article className="cartao destaque">
          <span className="destaque__rotulo">
            <IconArrowDown size={16} /> A receber
          </span>
          <Money value={r.aReceber} className="destaque__valor" />
          <div className="destaque__progresso">
            <Progresso valor={r.rendaRecebida} total={r.rendaPrevista} tom="renda" />
            <span>
              <Money value={r.rendaRecebida} /> de <Money value={r.rendaPrevista} />
            </span>
          </div>
        </article>

        <article className="cartao destaque">
          <span className="destaque__rotulo">
            <IconArrowUp size={16} /> A pagar
          </span>
          <Money value={r.aPagar} className="destaque__valor" />
          <div className="destaque__progresso">
            <Progresso valor={r.despesaPaga + r.agendado} total={r.despesaPrevista} tom="despesa" />
            <span>
              <Money value={r.despesaPaga} /> pagos de <Money value={r.despesaPrevista} />
            </span>
          </div>
        </article>
      </section>

      {atrasados.length > 0 && (
        <div className="alerta" role="alert">
          <IconAlert size={18} />
          <span>
            {plural(atrasados.length, 'lançamento atrasado', 'lançamentos atrasados')} somando <Money value={atrasados.reduce((s, l) => s + l.item.planejado, 0)} />.
          </span>
          <button type="button" className="link" onClick={() => ui.go('lancamentos')}>
            Ver lançamentos
          </button>
        </div>
      )}

      <div className="grade-visao">
        <section className="cartao bloco" aria-labelledby="t-proximos">
          <header className="bloco__topo">
            <h2 id="t-proximos">
              <IconCalendar size={18} /> {passado ? 'Ficou em aberto' : 'Próximos vencimentos'}
            </h2>
            <button type="button" className="link" onClick={() => ui.go('lancamentos')}>
              Ver todos <IconChevronRight size={14} />
            </button>
          </header>
          {pendentes.length ? (
            <Lista linhas={pendentes.slice(0, 7)} compacta />
          ) : (
            <div className="vazio">
              <IconSparkle size={22} />
              <p>{mes.despesas.length || mes.rendas.length ? 'Tudo pago e recebido neste mês.' : 'Nenhum lançamento ainda.'}</p>
              {!mes.despesas.length && (
                <button type="button" className="btn btn--secundario btn--pequeno" onClick={() => ui.novoLancamento()}>
                  Adicionar lançamento
                </button>
              )}
            </div>
          )}
          {pendentes.length > 7 && (
            <button type="button" className="bloco__mais" onClick={() => ui.go('lancamentos')}>
              Mais {plural(pendentes.length - 7, 'lançamento em aberto', 'lançamentos em aberto')}
            </button>
          )}
        </section>

        <section className="cartao bloco" aria-labelledby="t-categorias">
          <header className="bloco__topo">
            <h2 id="t-categorias">Para onde vai o dinheiro</h2>
            <span className="bloco__extra">
              <Money value={r.despesaPrevista} />
            </span>
          </header>
          {categorias.length ? (
            <>
              <CategoriasChart itens={categorias} />
              {semCategoria > 0 && (
                <p className="bloco__nota">
                  {plural(semCategoria, 'despesa', 'despesas')} sem categoria.{' '}
                  <button type="button" className="link link--pequeno" onClick={() => ui.go('lancamentos')}>
                    Organizar
                  </button>
                </p>
              )}
            </>
          ) : (
            <div className="vazio">
              <p>As despesas do mês aparecem aqui, por categoria.</p>
            </div>
          )}
        </section>

        <section className="cartao bloco bloco--largo" aria-labelledby="t-fluxo">
          <header className="bloco__topo">
            <h2 id="t-fluxo">Renda e despesas</h2>
            <button type="button" className="link" onClick={() => ui.go('relatorios')}>
              Relatórios <IconChevronRight size={14} />
            </button>
          </header>
          <FluxoChart pontos={fluxo} onSelect={ui.setMes} />
        </section>

        <section className="cartao bloco" aria-labelledby="t-inv">
          <header className="bloco__topo">
            <h2 id="t-inv">
              <IconTrend size={18} /> Investimentos
            </h2>
            <button type="button" className="link" onClick={() => ui.go('investimentos')}>
              Abrir <IconChevronRight size={14} />
            </button>
          </header>
          {mes.investimentos.length ? (
            <div className="inv-resumo">
              <Money value={r.carteira} className="destaque__valor" />
              <p className="destaque__sub">
                <Money value={r.rendimentoCarteira} sinal className={tom(r.rendimentoCarteira)} /> de rendimento estimado ·{' '}
                {plural(mes.investimentos.length, 'investimento', 'investimentos')}
              </p>
              {r.aportesConta > 0 && (
                <p className="destaque__sub">
                  <Money value={r.aportesConta} /> saindo da conta para investir este mês
                </p>
              )}
            </div>
          ) : (
            <div className="vazio">
              <p>Acompanhe CDBs, Tesouro e ações rendendo pelo CDI.</p>
              <button type="button" className="btn btn--secundario btn--pequeno" onClick={ui.novoInvestimento}>
                Adicionar investimento
              </button>
            </div>
          )}
        </section>
      </div>

      {(ehAtual || passado) && !mes.fechado && (
        <section className="cartao fechar-mes">
          <div>
            <h2>
              <IconLock size={18} /> Terminou {monthName(key).split(' ')[0]}?
            </h2>
            <p>Feche o mês para começar {monthName(shiftKey(key, 1))} com o saldo certo, as contas que se repetem e os investimentos atualizados.</p>
          </div>
          <button type="button" className="btn btn--secundario" onClick={() => ui.prepararMes(shiftKey(key, 1), true)}>
            Fechar mês
          </button>
        </section>
      )}
    </div>
  );
}

/** Mês sem nada ainda: oferece trazer do mês anterior ou começar do zero. */
function MesVazio() {
  const { estado, legado, importarLegado, descartarLegado } = useData();
  const ui = useUi();
  const anterior = mesAnteriorComDados(estado, ui.mes);
  const primeiraVez = Object.keys(estado).length === 0;
  return (
    <div className="pagina">
      {legado && <AvisoLegado meses={legado.meses} onImportar={importarLegado} onDescartar={descartarLegado} />}
      <section className="cartao boas-vindas">
        <span className="boas-vindas__icone" aria-hidden="true">
          {primeiraVez ? '👋' : '🗓️'}
        </span>
        <h2>{primeiraVez ? 'Vamos organizar seu mês' : `${monthName(ui.mes)} ainda está em branco`}</h2>
        <p>
          {primeiraVez
            ? 'Comece pelo dinheiro que entra e pelas contas fixas. O FinanceOS mostra quanto vai sobrar e avisa o que vence.'
            : anterior
              ? `Traga de ${monthName(anterior)} as contas que se repetem, a renda, o saldo e os investimentos — você escolhe o quê.`
              : 'Adicione a renda e as contas deste mês.'}
        </p>
        <div className="boas-vindas__acoes">
          {anterior && (
            <button type="button" className="btn" onClick={() => ui.prepararMes(ui.mes)}>
              Trazer de {monthName(anterior).split(' ')[0]}
            </button>
          )}
          <button type="button" className={`btn${anterior ? ' btn--secundario' : ''}`} onClick={() => ui.novoLancamento(primeiraVez ? 'renda' : 'despesa')}>
            {primeiraVez ? 'Adicionar minha renda' : 'Começar do zero'}
          </button>
          {primeiraVez && (
            <button type="button" className="btn btn--secundario" onClick={ui.editarSaldo}>
              Informar saldo da conta
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

function AvisoLegado({ meses, onImportar, onDescartar }: { meses: number; onImportar: () => void; onDescartar: () => void }) {
  const [confirmar, setConfirmar] = useState(false);
  return (
    <section className="cartao aviso-legado" aria-labelledby="t-legado">
      <div>
        <h2 id="t-legado">Encontramos dados da versão anterior</h2>
        <p>
          Este navegador guarda {plural(meses, "mês", "meses")} de lançamentos do FinanceOS antigo. Quer trazer para a sua conta? Depois disso eles deixam de ficar soltos no navegador.
        </p>
      </div>
      <div className="aviso-legado__acoes">
        <button type="button" className="btn" onClick={onImportar}>
          Trazer para minha conta
        </button>
        <button type="button" className="btn btn--fantasma" onClick={() => setConfirmar(true)}>
          Apagar do navegador
        </button>
      </div>
      {confirmar && (
        <Confirm title="Apagar os dados antigos deste navegador?" confirmLabel="Apagar" danger onConfirm={onDescartar} onClose={() => setConfirmar(false)}>
          <p>Os {plural(meses, "mês", "meses")} guardados neste navegador serão apagados e não vão para a sua conta. Se não tiver certeza, traga para a conta: depois dá para limpar mês a mês.</p>
        </Confirm>
      )}
    </section>
  );
}
