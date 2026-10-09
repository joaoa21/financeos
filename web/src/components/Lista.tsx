import type { Situacao } from '../model/calc.ts';
import { categoria } from '../model/categorias.ts';
import type { Despesa, Renda } from '../model/types.ts';
import { Money } from '../prefs.tsx';
import { type Kind, useActions, useUi } from '../ui.tsx';
import { useToast } from './Toast.tsx';
import { CategoriaIcone, RendaIcone } from './CategoriaIcone.tsx';
import { IconCalendarCheck, IconCheck, IconDots, IconPencil, IconRepeat, IconTrash } from './Icons.tsx';
import { Menu } from './Menu.tsx';

// Linhas de despesas e rendas, iguais na visão geral e na página de lançamentos.

export interface LinhaLancamento {
  kind: Kind;
  item: Despesa | Renda;
  situacao: Situacao;
}

const FORMA: Record<string, string> = { boleto: 'Boleto', cartao: 'Cartão', pix: 'Pix/débito' };

export function SituacaoSelo({ situacao, kind }: { situacao: Situacao; kind: Kind }) {
  const texto: Record<Situacao, string> = {
    pago: kind === 'despesa' ? 'Paga' : 'Recebida',
    agendado: 'Agendada',
    atrasado: 'Atrasada',
    hoje: 'Hoje',
    pendente: kind === 'despesa' ? 'A pagar' : 'A receber',
  };
  return <span className={`selo selo--${situacao}`}>{texto[situacao]}</span>;
}

export function Lista({ linhas, compacta }: { linhas: LinhaLancamento[]; compacta?: boolean }) {
  return (
    <ul className={`lista${compacta ? ' lista--compacta' : ''}`}>
      {linhas.map((linha) => (
        <Linha key={linha.item.id} linha={linha} compacta={compacta} />
      ))}
    </ul>
  );
}

function Linha({ linha, compacta }: { linha: LinhaLancamento; compacta?: boolean }) {
  const { kind, item, situacao } = linha;
  const ui = useUi();
  const actions = useActions();
  const toast = useToast();
  const despesa = kind === 'despesa' ? (item as Despesa) : null;
  const feito = situacao === 'pago';
  const cat = despesa ? categoria(despesa.categoria) : null;
  const valor = feito ? item.realizado : item.planejado;

  const meta = [
    item.data ? `${kind === 'despesa' ? 'Vence' : 'Cai'} dia ${String(item.data).padStart(2, '0')}` : null,
    despesa?.subtipo ? FORMA[despesa.subtipo] : null,
    !compacta && despesa?.tipo === 'esporadico' ? 'Esporádica' : null,
  ].filter(Boolean);

  const marcar = () => {
    const agora = actions.togglePago(kind, item.id);
    if (agora) toast(kind === 'despesa' ? `"${item.nome}" marcada como paga.` : `"${item.nome}" marcada como recebida.`, { acao: { label: 'Desfazer', onClick: () => actions.togglePago(kind, item.id) } });
  };

  return (
    <li className={`linha linha--${situacao}${feito ? ' linha--feita' : ''}`}>
      <button
        type="button"
        className={`marcar marcar--${kind}${feito ? ' marcar--feito' : ''}`}
        onClick={marcar}
        aria-pressed={feito}
        aria-label={feito ? `Desmarcar "${item.nome}"` : kind === 'despesa' ? `Marcar "${item.nome}" como paga` : `Marcar "${item.nome}" como recebida`}
        title={feito ? 'Desmarcar' : kind === 'despesa' ? 'Marcar como paga' : 'Marcar como recebida'}
      >
        <IconCheck size={14} />
      </button>
      <button type="button" className="linha__principal" onClick={() => ui.editarLancamento(kind, item.id)} title="Editar">
        <span className="linha__icone">{despesa ? <CategoriaIcone id={despesa.categoria} /> : <RendaIcone />}</span>
        <span className="linha__texto">
          <span className="linha__nome">
            {item.nome}
            {item.autoReplicar && (
              <span className="linha__repete" title="Repete todo mês" aria-label="Repete todo mês">
                <IconRepeat size={13} />
              </span>
            )}
          </span>
          <span className="linha__meta">{[!compacta && cat ? cat.nome : null, ...meta].filter(Boolean).join(' · ') || (kind === 'renda' ? 'Renda' : 'Sem data')}</span>
        </span>
      </button>
      <SituacaoSelo situacao={situacao} kind={kind} />
      <span className={`linha__valor${kind === 'renda' ? ' positivo' : ''}`}>
        <Money value={valor} sinal={kind === 'renda'} />
        {feito && item.realizado !== item.planejado && (
          <span className="linha__previsto">
            previsto <Money value={item.planejado} />
          </span>
        )}
      </span>
      <Menu
        ariaLabel={`Ações de "${item.nome}"`}
        className="linha__menu"
        trigger={() => <IconDots size={18} />}
        items={[
          { label: 'Editar', icon: <IconPencil size={16} />, onClick: () => ui.editarLancamento(kind, item.id) },
          ...(despesa && !feito
            ? [{ label: despesa.agendado ? 'Desmarcar agendamento' : 'Marcar como agendada', icon: <IconCalendarCheck size={16} />, onClick: () => actions.toggleAgendado(item.id) }]
            : []),
          'separador' as const,
          { label: 'Excluir', icon: <IconTrash size={16} />, danger: true, onClick: () => actions.removerLancamento(kind, item.id) },
        ]}
      />
    </li>
  );
}
