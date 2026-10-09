import { useState } from 'react';
import { useData } from '../data.tsx';
import { brl } from '../format.ts';
import { cdiDiario } from '../model/calc.ts';
import { monthName, todayISO } from '../model/dates.ts';
import { sugerirTipo } from '../model/categorias.ts';
import { emptyMonth, uid } from '../model/migrate.ts';
import { type Aporte, INV_TIPOS } from '../model/types.ts';
import { useActions, useUi } from '../ui.tsx';
import { ChoiceCards, Field, MoneyInput, Segmented, Switch } from './Form.tsx';
import { IconTrash } from './Icons.tsx';
import { Modal } from './Modal.tsx';
import { useToast } from './Toast.tsx';

// Cadastrar/editar investimento e registrar aportes.

const ORIGENS: { value: Aporte['origem']; title: string; text: string }[] = [
  { value: 'conta', title: 'Da minha conta deste mês', text: 'Abate da sobra prevista. Quando feito, sai do "Na conta".' },
  { value: 'externo', title: 'De fora', text: 'Já estava investido, veio de outra conta ou é rendimento. Não mexe no mês.' },
];

const INDEXADOS = new Set(['CDB', 'Tesouro Direto', 'Renda Fixa']);

export function InvestimentoModal(props: { mesKey: string; id?: string; onClose: () => void }) {
  const { estado, update } = useData();
  const { cdi } = useUi();
  const actions = useActions();
  const toast = useToast();
  const existente = props.id ? estado[props.mesKey]?.investimentos.find((i) => i.id === props.id) : undefined;
  const [nome, setNome] = useState(existente?.nome ?? '');
  const [tipo, setTipo] = useState(existente?.tipo ?? 'CDB');
  const [cdiOn, setCdiOn] = useState(existente ? existente.percentualCDI != null : true);
  const [pct, setPct] = useState(String(existente?.percentualCDI ?? 100));
  const [valor, setValor] = useState(0);
  const [data, setData] = useState(todayISO());
  const [origem, setOrigem] = useState<Aporte['origem']>('externo');
  const [base, setBase] = useState(existente?.valor ?? 0);
  const [tentou, setTentou] = useState(false);
  const [tipoManual, setTipoManual] = useState(!!existente);

  const pctNum = Number(pct.replace(',', '.'));
  const erros = {
    nome: !nome.trim() ? 'Dê um nome, por exemplo "CDB Nubank".' : null,
    pct: cdiOn && !(pctNum > 0 && pctNum <= 300) ? 'Use um percentual entre 1 e 300.' : null,
  };
  const taxaAA = cdiOn && pctNum > 0 ? (Math.pow(1 + cdiDiario(cdi.anual) * (pctNum / 100), 252) - 1) * 100 : null;

  function salvar() {
    setTentou(true);
    if (erros.nome || erros.pct) return;
    update((draft) => {
      const m = (draft[props.mesKey] ??= emptyMonth());
      const percentualCDI = cdiOn ? pctNum : null;
      const atual = m.investimentos.find((i) => i.id === props.id);
      if (atual) {
        Object.assign(atual, { nome: nome.trim().slice(0, 120), tipo, percentualCDI });
        if (base > 0) atual.valor = base;
        else delete atual.valor;
      } else {
        m.investimentos.push({
          id: uid(),
          nome: nome.trim().slice(0, 120),
          tipo,
          percentualCDI,
          aportes: valor > 0 ? [{ id: uid(), valor, data, origem, status: data > todayISO() ? 'previsto' : 'feito' }] : [],
        });
      }
    });
    toast(existente ? 'Investimento atualizado.' : 'Investimento adicionado.');
    props.onClose();
  }

  return (
    <Modal
      title={existente ? 'Editar investimento' : 'Novo investimento'}
      subtitle={monthName(props.mesKey)}
      onClose={props.onClose}
      onSubmit={salvar}
      footer={
        <>
          {existente && (
            <button
              type="button"
              className="btn btn--fantasma btn--perigo-texto rodape-esquerda"
              onClick={() => {
                actions.removerInvestimento(existente.id);
                props.onClose();
              }}
            >
              <IconTrash size={16} /> Excluir
            </button>
          )}
          <button type="button" className="btn btn--secundario" onClick={props.onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn">
            {existente ? 'Salvar' : 'Adicionar'}
          </button>
        </>
      }
    >
      <Field label="Nome" error={tentou ? erros.nome : null}>
        {(id) => <input id={id} className="campo" maxLength={120} placeholder="Ex.: CDB Nubank, Tesouro Selic, PETR4" value={nome} onChange={(e) => {
          setNome(e.target.value);
          const sugerido = !tipoManual ? sugerirTipo(e.target.value) : null;
          if (sugerido) {
            setTipo(sugerido);
            setCdiOn(INDEXADOS.has(sugerido));
          }
        }} />}
      </Field>
      <Field label="Tipo">
        {(id) => (
          <select
            id={id}
            className="campo"
            value={tipo}
            onChange={(e) => {
              setTipoManual(true);
              setTipo(e.target.value);
              if (!existente) setCdiOn(INDEXADOS.has(e.target.value));
            }}
          >
            {(INV_TIPOS.includes(tipo) ? INV_TIPOS : [...INV_TIPOS, tipo]).map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        )}
      </Field>
      <Switch checked={cdiOn} onChange={setCdiOn} label="Rende pelo CDI" hint="O valor atual é estimado com a taxa do CDI de cada dia útil." />
      {cdiOn && (
        <Field
          label="Percentual do CDI"
          error={erros.pct}
          hint={taxaAA !== null ? `≈ ${taxaAA.toFixed(2).replace('.', ',')}% ao ano com o CDI de ${cdi.anual.toFixed(2).replace('.', ',')}%` : undefined}
        >
          {(id) => (
            <span className="campo-sufixo">
              <input id={id} className="campo" inputMode="decimal" value={pct} onChange={(e) => setPct(e.target.value.replace(/[^\d.,]/g, '').slice(0, 6))} />
              <span aria-hidden="true">% do CDI</span>
            </span>
          )}
        </Field>
      )}

      {existente ? (
        !cdiOn || existente.valor ? (
          <Field label="Valor já investido (sem data)" hint="Use para ajustar o saldo de investimentos que não rendem pelo CDI. Os aportes somam a ele.">
            {(id) => <MoneyInput id={id} value={base} onChange={setBase} />}
          </Field>
        ) : null
      ) : (
        <fieldset className="grupo">
          <legend>Primeiro aporte (opcional)</legend>
          <div className="campos-linha">
            <Field label="Valor">{(id) => <MoneyInput id={id} value={valor} onChange={setValor} />}</Field>
            <Field label="Data">{(id) => <input id={id} type="date" className="campo" value={data} onChange={(e) => setData(e.target.value)} />}</Field>
          </div>
          {valor > 0 && <ChoiceCards name="origem-inicial" value={origem} onChange={setOrigem} options={ORIGENS} />}
        </fieldset>
      )}
    </Modal>
  );
}

export function AporteModal(props: { mesKey: string; invId: string; onClose: () => void }) {
  const { estado, update } = useData();
  const toast = useToast();
  const inv = estado[props.mesKey]?.investimentos.find((i) => i.id === props.invId);
  const [valor, setValor] = useState(0);
  const [data, setData] = useState(todayISO());
  const [origem, setOrigem] = useState<Aporte['origem']>('conta');
  const [status, setStatus] = useState<Aporte['status']>('feito');
  const [tentou, setTentou] = useState(false);
  if (!inv) return null;

  function salvar() {
    setTentou(true);
    if (valor <= 0 || !data) return;
    update((draft) => {
      draft[props.mesKey]?.investimentos.find((i) => i.id === props.invId)?.aportes.push({ id: uid(), valor, data, origem, status });
    });
    toast(status === 'feito' ? `Aporte de ${brl(valor)} registrado.` : `Aporte de ${brl(valor)} previsto.`);
    props.onClose();
  }

  return (
    <Modal
      title="Novo aporte"
      subtitle={inv.nome}
      onClose={props.onClose}
      onSubmit={salvar}
      footer={
        <>
          <button type="button" className="btn btn--secundario" onClick={props.onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn">
            Registrar aporte
          </button>
        </>
      }
    >
      <div className="campos-linha">
        <Field label="Valor" error={tentou && valor <= 0 ? 'Informe o valor.' : null}>
          {(id) => <MoneyInput id={id} value={valor} onChange={setValor} invalid={tentou && valor <= 0} />}
        </Field>
        <Field label="Data">
          {(id) => (
            <input
              id={id}
              type="date"
              className="campo"
              value={data}
              onChange={(e) => {
                setData(e.target.value);
                setStatus(e.target.value > todayISO() ? 'previsto' : 'feito');
              }}
            />
          )}
        </Field>
      </div>
      <div className="campo-grupo">
        <span className="campo-rotulo">Situação</span>
        <Segmented
          ariaLabel="Situação do aporte"
          value={status}
          onChange={setStatus}
          options={[
            { value: 'feito', label: 'Já fiz' },
            { value: 'previsto', label: 'Vou fazer' },
          ]}
        />
        <span className="campo-ajuda">{status === 'previsto' ? 'Aporte previsto não entra na carteira até ser confirmado.' : 'Entra na carteira e começa a render a partir do próximo dia útil.'}</span>
      </div>
      <div className="campo-grupo">
        <span className="campo-rotulo">De onde vem o dinheiro?</span>
        <ChoiceCards name="origem" value={origem} onChange={setOrigem} options={ORIGENS} />
      </div>
    </Modal>
  );
}
