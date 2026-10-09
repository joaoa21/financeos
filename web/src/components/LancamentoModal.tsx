import { useId, useMemo, useState } from 'react';
import { useData } from '../data.tsx';
import { daysInMonth, monthName } from '../model/dates.ts';
import { CATEGORIAS, categoria as achaCategoria, sugerirCategoria } from '../model/categorias.ts';
import { CategoriaIcone } from './CategoriaIcone.tsx';
import { IconChevronDown } from './Icons.tsx';
import { emptyMonth, uid } from '../model/migrate.ts';
import type { Despesa, Forma, Renda, TipoDespesa } from '../model/types.ts';
import { useToast } from './Toast.tsx';
import { type Kind, useActions } from '../ui.tsx';
import { Field, MoneyInput, Segmented, Switch } from './Form.tsx';
import { Modal } from './Modal.tsx';
import { IconTrash } from './Icons.tsx';

// Cadastrar ou editar uma despesa ou renda do mês.

interface Form {
  kind: Kind;
  nome: string;
  valor: number;
  dia: string;
  categoria: string;
  tipo: TipoDespesa;
  forma: Forma;
  recorrente: boolean;
  feito: boolean;
  valorFeito: number;
  agendado: boolean;
}

export function LancamentoModal(props: { mesKey: string; kind: Kind; id?: string; onClose: () => void }) {
  const { estado, update } = useData();
  const actions = useActions();
  const toast = useToast();
  const listId = useId();
  const mes = estado[props.mesKey] ?? emptyMonth();
  const existente = props.id
    ? props.kind === 'despesa'
      ? mes.despesas.find((d) => d.id === props.id)
      : mes.rendas.find((r) => r.id === props.id)
    : undefined;
  const editando = !!existente;

  const [form, setForm] = useState<Form>(() => {
    const d = existente as Despesa | undefined;
    const r = existente as Renda | undefined;
    return {
      kind: props.kind,
      nome: existente?.nome ?? '',
      valor: existente?.planejado ?? 0,
      dia: existente?.data ? String(existente.data) : '',
      categoria: d?.categoria ?? '',
      tipo: d?.tipo ?? 'fixo',
      forma: d?.subtipo ?? 'boleto',
      recorrente: existente?.autoReplicar ?? false,
      feito: (props.kind === 'despesa' ? d?.pago : r?.recebido) ?? false,
      valorFeito: existente?.realizado || existente?.planejado || 0,
      agendado: d?.agendado ?? false,
    };
  });
  const [tentou, setTentou] = useState(false);
  const [categoriaManual, setCategoriaManual] = useState(!!form.categoria);
  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));
  const despesa = form.kind === 'despesa';

  // Nomes já usados (para completar) e o último lançamento com cada nome.
  const historico = useMemo(() => {
    const map = new Map<string, Despesa | Renda>();
    for (const key of Object.keys(estado).sort()) {
      for (const item of despesa ? estado[key]!.despesas : estado[key]!.rendas) map.set(item.nome.trim().toLowerCase(), item);
    }
    return map;
  }, [estado, despesa]);

  function mudarNome(nome: string) {
    const patch: Partial<Form> = { nome };
    const anterior = !editando ? historico.get(nome.trim().toLowerCase()) : undefined;
    if (anterior) {
      // Mesmo nome de um lançamento anterior: traz valor, dia e jeito de pagar.
      if (!form.valor) patch.valor = anterior.planejado;
      if (!form.dia && anterior.data) patch.dia = String(anterior.data);
      patch.recorrente = anterior.autoReplicar;
      if ('tipo' in anterior) {
        patch.tipo = anterior.tipo;
        if (anterior.subtipo) patch.forma = anterior.subtipo;
        if (!categoriaManual && anterior.categoria) patch.categoria = anterior.categoria;
      }
    } else if (despesa && !categoriaManual) {
      patch.categoria = sugerirCategoria(nome) ?? '';
    }
    set(patch);
  }

  const repetido =
    !editando && form.nome.trim() && (despesa ? mes.despesas : mes.rendas).some((item) => item.nome.trim().toLowerCase() === form.nome.trim().toLowerCase())
      ? `Já existe "${form.nome.trim()}" em ${monthName(props.mesKey)}.`
      : null;
  const maxDia = daysInMonth(props.mesKey);
  const diaNum = form.dia ? Number(form.dia) : null;
  const erros = {
    nome: !form.nome.trim() ? 'Dê um nome, por exemplo "Aluguel".' : null,
    valor: form.valor <= 0 ? 'Informe o valor.' : null,
    dia: diaNum !== null && (!Number.isInteger(diaNum) || diaNum < 1 || diaNum > 31) ? `Use um dia de 1 a ${maxDia}.` : null,
  };
  const valido = !erros.nome && !erros.valor && !erros.dia;

  function salvar() {
    setTentou(true);
    if (!valido) return;
    const base = {
      nome: form.nome.trim().slice(0, 120),
      planejado: form.valor,
      data: diaNum,
      autoReplicar: form.recorrente,
    };
    update((draft) => {
      const m = (draft[props.mesKey] ??= emptyMonth());
      if (despesa) {
        const item: Omit<Despesa, 'id'> = {
          ...base,
          pago: form.feito,
          realizado: form.feito ? form.valorFeito || form.valor : 0,
          agendado: !form.feito && form.agendado,
          tipo: form.tipo,
          subtipo: form.forma,
          categoria: form.categoria || null,
        };
        const atual = m.despesas.find((d) => d.id === props.id);
        if (atual) Object.assign(atual, item);
        else m.despesas.push({ id: uid(), ...item });
      } else {
        const item: Omit<Renda, 'id'> = { ...base, recebido: form.feito, realizado: form.feito ? form.valorFeito || form.valor : 0 };
        const atual = m.rendas.find((r) => r.id === props.id);
        if (atual) Object.assign(atual, item);
        else m.rendas.push({ id: uid(), ...item });
      }
    });
    toast(editando ? 'Alterações salvas.' : `${despesa ? 'Despesa' : 'Renda'} adicionada em ${monthName(props.mesKey)}.`);
    props.onClose();
  }

  const titulo = editando ? (despesa ? 'Editar despesa' : 'Editar renda') : 'Novo lançamento';

  return (
    <Modal
      title={titulo}
      subtitle={monthName(props.mesKey)}
      onClose={props.onClose}
      onSubmit={salvar}
      footer={
        <>
          {editando && (
            <button
              type="button"
              className="btn btn--fantasma btn--perigo-texto rodape-esquerda"
              onClick={() => {
                actions.removerLancamento(form.kind, props.id!);
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
            {editando ? 'Salvar' : 'Adicionar'}
          </button>
        </>
      }
    >
      {!editando && (
        <Segmented
          size="grande"
          ariaLabel="Tipo de lançamento"
          value={form.kind}
          onChange={(kind) => set({ kind })}
          options={[
            { value: 'despesa', label: 'Despesa' },
            { value: 'renda', label: 'Renda' },
          ]}
        />
      )}

      <Field label="Nome" error={tentou ? erros.nome : null} hint={repetido}>
        {(id) => (
          <>
            <input
              id={id}
              className="campo"
              list={listId}
              autoComplete="off"
              maxLength={120}
              placeholder={despesa ? 'Ex.: Aluguel, Netflix, Mercado' : 'Ex.: Salário, Freela'}
              aria-invalid={(tentou && !!erros.nome) || undefined}
              value={form.nome}
              onChange={(e) => mudarNome(e.target.value)}
            />
            <datalist id={listId}>
              {[...historico.values()].map((item) => (
                <option key={item.id} value={item.nome} />
              ))}
            </datalist>
          </>
        )}
      </Field>

      <div className="campos-linha">
        <Field label="Valor" error={tentou ? erros.valor : null}>
          {(id) => <MoneyInput id={id} value={form.valor} onChange={(valor) => set({ valor, valorFeito: form.feito ? form.valorFeito : valor })} invalid={tentou && !!erros.valor} />}
        </Field>
        <Field label={despesa ? 'Vence no dia' : 'Cai no dia'} error={erros.dia} hint="Opcional">
          {(id) => (
            <input
              id={id}
              className="campo"
              type="number"
              inputMode="numeric"
              min={1}
              max={31}
              placeholder="—"
              aria-invalid={!!erros.dia || undefined}
              value={form.dia}
              onChange={(e) => set({ dia: e.target.value.slice(0, 2) })}
            />
          )}
        </Field>
      </div>

      {despesa && (
        <>
          <EscolherCategoria
            value={form.categoria}
            onChange={(categoria) => {
              setCategoriaManual(true);
              set({ categoria });
            }}
          />
          <div className="campos-linha">
            <div className="campo-grupo">
              <span className="campo-rotulo">Tipo</span>
              <Segmented
                ariaLabel="Tipo da despesa"
                value={form.tipo}
                onChange={(tipo) => set({ tipo, recorrente: tipo === 'fixo' ? form.recorrente : false })}
                options={[
                  { value: 'fixo', label: 'Fixa' },
                  { value: 'esporadico', label: 'Esporádica' },
                ]}
              />
            </div>
            <div className="campo-grupo">
              <span className="campo-rotulo">Forma de pagamento</span>
              <Segmented
                ariaLabel="Forma de pagamento"
                value={form.forma}
                onChange={(forma) => set({ forma })}
                options={[
                  { value: 'pix', label: 'Pix/débito' },
                  { value: 'boleto', label: 'Boleto' },
                  { value: 'cartao', label: 'Cartão' },
                ]}
              />
            </div>
          </div>
        </>
      )}

      <div className="interruptores">
        {(!despesa || form.tipo === 'fixo') && (
          <Switch
            checked={form.recorrente}
            onChange={(recorrente) => set({ recorrente })}
            label="Repetir todo mês"
            hint="Entra sozinha quando você preparar o próximo mês."
          />
        )}
        <Switch
          checked={form.feito}
          onChange={(feito) => set({ feito, valorFeito: form.valorFeito || form.valor, agendado: feito ? false : form.agendado })}
          label={despesa ? 'Já está paga' : 'Já recebi'}
        />
        {form.feito && (
          <Field label={despesa ? 'Valor pago' : 'Valor recebido'} hint="Se foi diferente do previsto (juros, desconto…)." className="recuo">
            {(id) => <MoneyInput id={id} value={form.valorFeito} onChange={(valorFeito) => set({ valorFeito })} />}
          </Field>
        )}
        {despesa && !form.feito && (
          <Switch
            checked={form.agendado}
            onChange={(agendado) => set({ agendado })}
            label="Pagamento agendado no banco"
            hint={'O dinheiro já sai do "Na conta", mas a despesa continua aberta até você marcar como paga.'}
          />
        )}
      </div>
    </Modal>
  );
}

/**
 * Categoria escolhida por ícone: o botão mostra a atual e abre, dentro do próprio
 * formulário, a grade com todas (sem menu flutuante, que a janela cortaria).
 */
function EscolherCategoria({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const [aberto, setAberto] = useState(false);
  const atual = achaCategoria(value);
  const opcoes = [...CATEGORIAS, { ...achaCategoria(''), id: '' }];
  return (
    <div className="campo-grupo">
      <span className="campo-rotulo" id="rotulo-categoria">
        Categoria
      </span>
      <button
        type="button"
        className="campo escolher-categoria"
        aria-expanded={aberto}
        aria-labelledby="rotulo-categoria escolher-categoria-valor"
        onClick={() => setAberto((a) => !a)}
      >
        <CategoriaIcone id={value} tamanho={26} />
        <span id="escolher-categoria-valor">{atual.nome}</span>
        <IconChevronDown size={16} />
      </button>
      {aberto && (
        <div className="grade-categorias" role="radiogroup" aria-labelledby="rotulo-categoria">
          {opcoes.map((c) => (
            <button
              key={c.id || 'sem'}
              type="button"
              role="radio"
              aria-checked={c.id === value}
              className="grade-categorias__opcao"
              onClick={() => {
                onChange(c.id);
                setAberto(false);
              }}
            >
              <CategoriaIcone id={c.id} tamanho={28} />
              <span>{c.nome}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
