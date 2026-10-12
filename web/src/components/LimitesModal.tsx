import { useState } from 'react';
import { useData } from '../data.tsx';
import { gastosPorCategoria, limitesDoMes } from '../model/calc.ts';
import { CATEGORIAS } from '../model/categorias.ts';
import { monthName } from '../model/dates.ts';
import { emptyMonth } from '../model/migrate.ts';
import { Money } from '../prefs.tsx';
import { CategoriaIcone } from './CategoriaIcone.tsx';
import { MoneyInput } from './Form.tsx';
import { Modal } from './Modal.tsx';
import { useToast } from './Toast.tsx';

// Limite de gasto por categoria. Vale do mês escolhido em diante, até ser mudado de novo.

export function LimitesModal(props: { mesKey: string; onClose: () => void }) {
  const { estado, update } = useData();
  const toast = useToast();
  const atuais = limitesDoMes(estado, props.mesKey).limites;
  const [valores, setValores] = useState<Record<string, number>>(() => ({ ...atuais }));
  const gastos = new Map(gastosPorCategoria(estado[props.mesKey] ?? emptyMonth()).map((c) => [c.id, c.total]));
  // Primeiro as categorias com gasto ou limite, depois as demais. Fixa ao abrir (não pula enquanto digita).
  const [ordem] = useState(() => [...CATEGORIAS].sort((a, b) => Number(!!(atuais[b.id] || gastos.get(b.id))) - Number(!!(atuais[a.id] || gastos.get(a.id)))));

  function salvar() {
    const limpos = Object.fromEntries(Object.entries(valores).filter(([, v]) => v > 0));
    update((draft) => {
      (draft[props.mesKey] ??= emptyMonth()).orcamentos = limpos;
    });
    const n = Object.keys(limpos).length;
    toast(n ? `Limites salvos. Valem de ${monthName(props.mesKey)} em diante.` : 'Limites removidos.');
    props.onClose();
  }

  return (
    <Modal
      title="Limites por categoria"
      subtitle={`Valem de ${monthName(props.mesKey)} em diante, até você mudar.`}
      onClose={props.onClose}
      onSubmit={salvar}
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
      <p className="campo-ajuda">Deixe em branco as categorias sem limite. O app avisa quando o previsto do mês chega perto ou passa do limite.</p>
      <ul className="limites-form">
        {ordem.map((c) => (
          <li key={c.id}>
            <CategoriaIcone id={c.id} tamanho={30} />
            <span className="limites-form__texto">
              <span className="limites-form__nome">{c.nome}</span>
              <span className="campo-ajuda">
                {gastos.get(c.id) ? (
                  <>
                    <Money value={gastos.get(c.id)!} /> neste mês
                  </>
                ) : (
                  'Sem gastos neste mês'
                )}
              </span>
            </span>
            <MoneyInput value={valores[c.id] ?? 0} onChange={(v) => setValores((x) => ({ ...x, [c.id]: v }))} ariaLabel={`Limite para ${c.nome}`} />
          </li>
        ))}
      </ul>
    </Modal>
  );
}
