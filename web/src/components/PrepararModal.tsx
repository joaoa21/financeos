import { type ChangeEvent, type ReactNode, useMemo, useState } from 'react';
import { useData } from '../data.tsx';
import { type OpcoesPreparo, mesAnteriorComDados, preparar, previsaoPreparo } from '../model/calc.ts';
import { monthName, shiftKey } from '../model/dates.ts';
import { emptyMonth } from '../model/migrate.ts';
import { Money } from '../prefs.tsx';
import { useUi } from '../ui.tsx';
import { MoneyInput } from './Form.tsx';
import { Modal } from './Modal.tsx';
import { useToast } from './Toast.tsx';

// Preparar um mês a partir do anterior (ou "fechar" o mês atual, que é a mesma coisa
// vista do outro lado). A pessoa vê exatamente o que vai entrar e escolhe.

export function PrepararModal(props: { destino: string; fechar: boolean; onClose: () => void }) {
  const { estado, update } = useData();
  const { cdi, setMes } = useUi();
  const toast = useToast();
  const origem = props.fechar ? shiftKey(props.destino, -1) : (mesAnteriorComDados(estado, props.destino) ?? shiftKey(props.destino, -1));
  const p = useMemo(() => previsaoPreparo(estado, origem, props.destino, cdi.anual), [estado, origem, props.destino, cdi.anual]);
  const destinoTemSaldo = !!estado[props.destino]?.saldoInicial;
  const [op, setOp] = useState<OpcoesPreparo>({
    saldo: !destinoTemSaldo,
    despesasRecorrentes: true,
    outrasFixas: p.despesasRecorrentes.length === 0,
    rendasRecorrentes: true,
    outrasRendas: p.rendasRecorrentes.length === 0,
    investimentos: true,
  });
  const set = (k: keyof OpcoesPreparo) => (e: ChangeEvent<HTMLInputElement>) => setOp((o) => ({ ...o, [k]: e.target.checked }));
  const origemExiste = !!estado[origem];

  const linhas: { key: keyof OpcoesPreparo; titulo: string; detalhe: ReactNode; n: number; itens?: string[] }[] = [
    { key: 'saldo', titulo: 'Saldo inicial', detalhe: <>Começar com <Money value={p.saldo} />, o "Na conta" de {monthName(origem)}{destinoTemSaldo ? ' (substitui o saldo atual)' : ''}</>, n: 1 },
    { key: 'despesasRecorrentes', titulo: 'Despesas que se repetem', detalhe: 'Marcadas como "Repetir todo mês". Entram como não pagas.', n: p.despesasRecorrentes.length, itens: p.despesasRecorrentes.map((d) => d.nome) },
    { key: 'outrasFixas', titulo: 'Outras despesas fixas', detalhe: 'Fixas sem repetição automática.', n: p.outrasFixas.length, itens: p.outrasFixas.map((d) => d.nome) },
    { key: 'rendasRecorrentes', titulo: 'Rendas que se repetem', detalhe: 'Entram como não recebidas.', n: p.rendasRecorrentes.length, itens: p.rendasRecorrentes.map((r) => r.nome) },
    { key: 'outrasRendas', titulo: 'Outras rendas', detalhe: 'Rendas sem repetição automática.', n: p.outrasRendas.length, itens: p.outrasRendas.map((r) => r.nome) },
    { key: 'investimentos', titulo: 'Investimentos', detalhe: 'Levados com o valor de hoje (rendimento incluído), sem o histórico de aportes.', n: p.investimentos.length, itens: p.investimentos.map((i) => i.nome) },
  ];
  const visiveis = linhas.filter((l) => l.n > 0);

  function confirmar() {
    update((draft) => {
      const next = preparar(draft, origem, props.destino, op, cdi.anual, props.fechar);
      for (const key of Object.keys(next)) draft[key] = next[key]!;
      draft[props.destino] ??= emptyMonth();
    });
    toast(props.fechar ? `${monthName(origem)} fechado. ${monthName(props.destino)} está pronto.` : `${monthName(props.destino)} preparado.`);
    setMes(props.destino);
    props.onClose();
  }

  return (
    <Modal
      title={props.fechar ? `Fechar ${monthName(origem)}` : `Preparar ${monthName(props.destino)}`}
      subtitle={props.fechar ? `E deixar ${monthName(props.destino)} pronto para usar.` : `Trazendo de ${monthName(origem)}.`}
      onClose={props.onClose}
      onSubmit={confirmar}
      footer={
        <>
          <button type="button" className="btn btn--secundario" onClick={props.onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn" disabled={!origemExiste && !props.fechar}>
            {props.fechar ? `Fechar e ir para ${monthName(props.destino).split(' ')[0]}` : 'Preparar mês'}
          </button>
        </>
      }
    >
      {!origemExiste ? (
        <p className="texto-modal">Não há dados em {monthName(origem)} para trazer.</p>
      ) : visiveis.length === 0 ? (
        <p className="texto-modal">Tudo de {monthName(origem)} já está em {monthName(props.destino)}.</p>
      ) : (
        <ul className="preparo">
          {visiveis.map((l) => (
            <li key={l.key}>
              <label className="preparo__item">
                <input type="checkbox" checked={op[l.key]} onChange={set(l.key)} />
                <span>
                  <strong>
                    {l.titulo}
                    {l.itens && <span className="contagem">{l.n}</span>}
                  </strong>
                  <span className="preparo__detalhe">{l.detalhe}</span>
                  {l.itens && <span className="preparo__itens">{l.itens.slice(0, 6).join(' · ')}{l.itens.length > 6 ? ` · +${l.itens.length - 6}` : ''}</span>}
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
      {props.fechar && <p className="campo-ajuda">O mês fechado continua editável; ele só ganha a marca de fechado. Nada que já existe em {monthName(props.destino)} é apagado ou repetido.</p>}
    </Modal>
  );
}

export function SaldoModal(props: { mesKey: string; onClose: () => void }) {
  const { estado, update } = useData();
  const toast = useToast();
  const [valor, setValor] = useState(estado[props.mesKey]?.saldoInicial ?? 0);
  const [negativo, setNegativo] = useState((estado[props.mesKey]?.saldoInicial ?? 0) < 0);
  const absoluto = Math.abs(valor);

  return (
    <Modal
      title="Saldo inicial"
      subtitle={`Quanto havia na conta no começo de ${monthName(props.mesKey)}.`}
      onClose={props.onClose}
      onSubmit={() => {
        update((draft) => {
          (draft[props.mesKey] ??= emptyMonth()).saldoInicial = negativo ? -absoluto : absoluto;
        });
        toast('Saldo inicial atualizado.');
        props.onClose();
      }}
      footer={
        <>
          <button type="button" className="btn btn--secundario" onClick={props.onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn">
            Salvar
          </button>
        </>
      }
    >
      <div className="campo-grupo">
        <label className="campo-rotulo" htmlFor="saldo-inicial">
          Valor
        </label>
        <div className="saldo-linha">
          <button type="button" className={`sinal${negativo ? ' sinal--negativo' : ''}`} onClick={() => setNegativo((n) => !n)} aria-label={negativo ? 'Saldo negativo (trocar para positivo)' : 'Saldo positivo (trocar para negativo)'}>
            {negativo ? '−' : '+'}
          </button>
          <MoneyInput id="saldo-inicial" value={absoluto} onChange={setValor} />
        </div>
        <span className="campo-ajuda">Use o "−" se a conta começou no vermelho.</span>
      </div>
    </Modal>
  );
}
