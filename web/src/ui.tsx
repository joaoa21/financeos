import { createContext, useContext } from 'react';
import type { Cdi } from './cdi.ts';
import { useToast } from './components/Toast.tsx';
import { useData } from './data.tsx';
import { monthName } from './model/dates.ts';
import { emptyMonth } from './model/migrate.ts';
import type { Aporte, Estado, Mes } from './model/types.ts';
import type { Page } from './route.ts';

// O que qualquer tela pode pedir ao "casco" do app: mês escolhido, troca de página
// e as janelas de cadastro (que ficam num lugar só, em Shell.tsx).

export type Kind = 'despesa' | 'renda';

export interface Ui {
  mes: string;
  setMes: (mes: string) => void;
  page: Page;
  go: (page: Page) => void;
  cdi: Cdi;
  novoLancamento: (kind?: Kind) => void;
  editarLancamento: (kind: Kind, id: string) => void;
  prepararMes: (destino: string, fechar?: boolean) => void;
  editarSaldo: () => void;
  novoInvestimento: () => void;
  editarInvestimento: (id: string) => void;
  novoAporte: (invId: string) => void;
}

export const UiContext = createContext<Ui | null>(null);

export function useUi(): Ui {
  const value = useContext(UiContext);
  if (!value) throw new Error('useUi precisa estar dentro do Shell.');
  return value;
}

/** O mês escolhido (vazio se ainda não existe) e se ele já existe nos dados. */
export function useMes(): { mes: Mes; key: string; existe: boolean } {
  const { estado } = useData();
  const { mes: key } = useUi();
  const mes = estado[key];
  return { mes: mes ?? emptyMonth(), key, existe: !!mes };
}

/** Ações do dia a dia, com aviso e "Desfazer" quando apagam algo. */
export function useActions() {
  const { update } = useData();
  const { mes: key } = useUi();
  const toast = useToast();

  const month = (draft: Estado) => (draft[key] ??= emptyMonth());

  /** Tira um item de uma lista do mês e oferece "Desfazer" (que devolve só aquele item). */
  function remover(list: 'despesas' | 'rendas' | 'investimentos', id: string, texto: (nome: string) => string) {
    let removido: { id: string; nome: string } | undefined;
    let posicao = 0;
    update((draft) => {
      const itens = month(draft)[list] as { id: string; nome: string }[];
      posicao = itens.findIndex((x) => x.id === id);
      if (posicao >= 0) [removido] = itens.splice(posicao, 1);
    });
    if (!removido) return;
    const item = removido;
    toast(texto(item.nome), {
      acao: {
        label: 'Desfazer',
        onClick: () =>
          update((draft) => {
            const itens = month(draft)[list] as { id: string }[];
            if (!itens.some((x) => x.id === item.id)) itens.splice(Math.min(posicao, itens.length), 0, item);
          }),
      },
    });
  }

  return {
    togglePago(kind: Kind, id: string) {
      let feito = false;
      update((draft) => {
        const m = month(draft);
        if (kind === 'despesa') {
          const d = m.despesas.find((x) => x.id === id);
          if (!d) return;
          d.pago = !d.pago;
          d.realizado = d.pago ? d.planejado : 0;
          if (d.pago) d.agendado = false;
          feito = d.pago;
        } else {
          const r = m.rendas.find((x) => x.id === id);
          if (!r) return;
          r.recebido = !r.recebido;
          r.realizado = r.recebido ? r.planejado : 0;
          feito = r.recebido;
        }
      });
      return feito;
    },

    toggleAgendado(id: string) {
      let agendado = false;
      update((draft) => {
        const d = month(draft).despesas.find((x) => x.id === id);
        if (!d || d.pago) return;
        d.agendado = !d.agendado;
        agendado = d.agendado;
      });
      toast(agendado ? 'Pagamento marcado como agendado.' : 'Agendamento desmarcado.');
    },

    removerLancamento(kind: Kind, id: string) {
      remover(kind === 'despesa' ? 'despesas' : 'rendas', id, (nome) => `"${nome}" foi excluída.`);
    },

    removerInvestimento(id: string) {
      remover('investimentos', id, (nome) => `"${nome}" foi excluído deste mês.`);
    },

    toggleAporte(invId: string, aporteId: string) {
      let status = '';
      update((draft) => {
        const a = month(draft).investimentos.find((i) => i.id === invId)?.aportes.find((x) => x.id === aporteId);
        if (!a) return;
        a.status = a.status === 'feito' ? 'previsto' : 'feito';
        status = a.status;
      });
      toast(status === 'feito' ? 'Aporte confirmado.' : 'Aporte voltou para previsto.');
    },

    removerAporte(invId: string, aporteId: string) {
      let removido: Aporte | undefined;
      update((draft) => {
        const inv = month(draft).investimentos.find((i) => i.id === invId);
        if (!inv) return;
        removido = inv.aportes.find((a) => a.id === aporteId);
        inv.aportes = inv.aportes.filter((a) => a.id !== aporteId);
      });
      if (!removido) return;
      const aporte = removido;
      toast('Aporte excluído.', {
        acao: {
          label: 'Desfazer',
          onClick: () =>
            update((draft) => {
              const inv = month(draft).investimentos.find((i) => i.id === invId);
              if (inv && !inv.aportes.some((a) => a.id === aporte.id)) inv.aportes.push(aporte);
            }),
        },
      });
    },

    limparMes() {
      let antes: Mes | undefined;
      update((draft) => {
        antes = draft[key];
        delete draft[key];
      });
      if (!antes) return;
      const mes = antes;
      toast(`${monthName(key)} foi limpo.`, {
        acao: {
          label: 'Desfazer',
          onClick: () =>
            update((draft) => {
              draft[key] = mes;
            }),
        },
      });
    },
  };
}
