import { useMemo, useState } from 'react';
import { exportarCsvMes } from '../arquivos.ts';
import { Segmented } from '../components/Form.tsx';
import { IconCopy, IconDots, IconDownload, IconPlus, IconSearch, IconTrash, IconX } from '../components/Icons.tsx';
import { Lista, type LinhaLancamento } from '../components/Lista.tsx';
import { Menu } from '../components/Menu.tsx';
import { Confirm } from '../components/Modal.tsx';
import { plural } from '../format.ts';
import { type Situacao, situacao } from '../model/calc.ts';
import { CATEGORIAS } from '../model/categorias.ts';
import { monthName, shiftKey } from '../model/dates.ts';
import { Money } from '../prefs.tsx';
import { type Kind, useActions, useMes, useUi } from '../ui.tsx';

type Filtro = 'todos' | 'abertos' | 'feitos' | 'fixas' | 'esporadicas';
type Ordem = 'dia' | 'valor' | 'nome';

const GRUPOS: { id: string; titulo: (k: Kind) => string; situacoes: Situacao[] }[] = [
  { id: 'atrasado', titulo: () => 'Atrasados', situacoes: ['atrasado'] },
  { id: 'hoje', titulo: (k) => (k === 'despesa' ? 'Vencem hoje' : 'Caem hoje'), situacoes: ['hoje'] },
  { id: 'aberto', titulo: (k) => (k === 'despesa' ? 'A pagar' : 'A receber'), situacoes: ['pendente', 'agendado'] },
  { id: 'feito', titulo: (k) => (k === 'despesa' ? 'Pagas' : 'Recebidas'), situacoes: ['pago'] },
];

export function Lancamentos() {
  const { mes, key, existe } = useMes();
  const ui = useUi();
  const actions = useActions();
  const [kind, setKind] = useState<Kind>('despesa');
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [busca, setBusca] = useState('');
  const [ordem, setOrdem] = useState<Ordem>('dia');
  const [cat, setCat] = useState('');
  const [limpar, setLimpar] = useState(false);

  const linhas = useMemo<LinhaLancamento[]>(() => {
    const itens = kind === 'despesa' ? mes.despesas : mes.rendas;
    const termo = busca.trim().toLowerCase();
    return itens
      .map((item) => ({ kind, item, situacao: situacao(item, key) }))
      .filter(({ item, situacao: s }) => {
        if (termo && !item.nome.toLowerCase().includes(termo)) return false;
        if (filtro === 'abertos' && s === 'pago') return false;
        if (filtro === 'feitos' && s !== 'pago') return false;
        if (kind === 'despesa') {
          const d = item as (typeof mes.despesas)[number];
          if (filtro === 'fixas' && d.tipo !== 'fixo') return false;
          if (filtro === 'esporadicas' && d.tipo !== 'esporadico') return false;
          if (cat && (d.categoria ?? '') !== (cat === '__sem' ? '' : cat)) return false;
        }
        return true;
      })
      .sort((a, b) =>
        ordem === 'valor'
          ? b.item.planejado - a.item.planejado
          : ordem === 'nome'
            ? a.item.nome.localeCompare(b.item.nome, 'pt-BR')
            : (a.item.data ?? 99) - (b.item.data ?? 99) || a.item.nome.localeCompare(b.item.nome, 'pt-BR'),
      );
  }, [mes, key, kind, filtro, busca, ordem, cat]);

  const total = linhas.reduce((s, l) => s + (l.situacao === 'pago' ? l.item.realizado : l.item.planejado), 0);
  const feito = linhas.filter((l) => l.situacao === 'pago').reduce((s, l) => s + l.item.realizado, 0);
  const totais = {
    despesa: mes.despesas.length,
    renda: mes.rendas.length,
  };
  const filtrando = !!busca || filtro !== 'todos' || !!cat;
  const categoriasUsadas = CATEGORIAS.filter((c) => mes.despesas.some((d) => d.categoria === c.id));

  return (
    <div className="pagina">
      <div className="barra-pagina">
        <Segmented
          size="grande"
          ariaLabel="Mostrar"
          value={kind}
          onChange={(k) => {
            setKind(k);
            setFiltro('todos');
            setCat('');
          }}
          options={[
            { value: 'despesa', label: <>Despesas <span className="contagem">{totais.despesa}</span></> },
            { value: 'renda', label: <>Renda <span className="contagem">{totais.renda}</span></> },
          ]}
        />
        <div className="barra-pagina__acoes">
          <button type="button" className="btn" onClick={() => ui.novoLancamento(kind)}>
            <IconPlus size={18} /> {kind === 'despesa' ? 'Nova despesa' : 'Nova renda'}
          </button>
          <Menu
            ariaLabel="Mais ações do mês"
            trigger={() => <IconDots size={18} />}
            className="menu--botao"
            items={[
              { label: `Trazer do mês anterior`, icon: <IconCopy size={16} />, onClick: () => ui.prepararMes(key) },
              { label: 'Baixar planilha do mês (CSV)', icon: <IconDownload size={16} />, onClick: () => exportarCsvMes(mes, key, ui.cdi.anual), disabled: !existe },
              'separador',
              { label: `Limpar ${monthName(key).split(' ')[0]}`, icon: <IconTrash size={16} />, danger: true, onClick: () => setLimpar(true), disabled: !existe },
            ]}
          />
        </div>
      </div>

      <div className="filtros">
        <label className="busca">
          <IconSearch size={16} />
          <input type="search" placeholder="Buscar pelo nome" aria-label="Buscar pelo nome" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </label>
        <div className="chips" role="group" aria-label="Filtrar">
          {(
            [
              ['todos', 'Todos'],
              ['abertos', kind === 'despesa' ? 'A pagar' : 'A receber'],
              ['feitos', kind === 'despesa' ? 'Pagas' : 'Recebidas'],
              ...(kind === 'despesa' ? [['fixas', 'Fixas'], ['esporadicas', 'Esporádicas']] : []),
            ] as [Filtro, string][]
          ).map(([id, label]) => (
            <button key={id} type="button" className="chip" aria-pressed={filtro === id} onClick={() => setFiltro(id)}>
              {label}
            </button>
          ))}
        </div>
        <div className="filtros__direita">
          {kind === 'despesa' && (categoriasUsadas.length > 0 || mes.despesas.some((d) => !d.categoria)) && (
            <select className="campo campo--pequeno" aria-label="Categoria" value={cat} onChange={(e) => setCat(e.target.value)}>
              <option value="">Todas as categorias</option>
              {categoriasUsadas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.emoji} {c.nome}
                </option>
              ))}
              {mes.despesas.some((d) => !d.categoria) && <option value="__sem">🏷️ Sem categoria</option>}
            </select>
          )}
          <select className="campo campo--pequeno" aria-label="Ordenar por" value={ordem} onChange={(e) => setOrdem(e.target.value as Ordem)}>
            <option value="dia">Por dia</option>
            <option value="valor">Por valor</option>
            <option value="nome">Por nome</option>
          </select>
        </div>
      </div>

      {linhas.length === 0 ? (
        <div className="cartao vazio vazio--grande">
          {filtrando ? (
            <>
              <p>Nada encontrado com esses filtros.</p>
              <button
                type="button"
                className="btn btn--secundario btn--pequeno"
                onClick={() => {
                  setBusca('');
                  setFiltro('todos');
                  setCat('');
                }}
              >
                <IconX size={14} /> Limpar filtros
              </button>
            </>
          ) : (
            <>
              <p>{kind === 'despesa' ? 'Nenhuma despesa' : 'Nenhuma renda'} em {monthName(key)}.</p>
              <div className="boas-vindas__acoes">
                <button type="button" className="btn btn--pequeno" onClick={() => ui.novoLancamento(kind)}>
                  <IconPlus size={16} /> Adicionar
                </button>
                <button type="button" className="btn btn--secundario btn--pequeno" onClick={() => ui.prepararMes(key)}>
                  Trazer de {monthName(shiftKey(key, -1)).split(' ')[0]}
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        <>
          {ordem === 'dia'
            ? GRUPOS.map((g) => {
                const doGrupo = linhas.filter((l) => g.situacoes.includes(l.situacao));
                if (!doGrupo.length) return null;
                const soma = doGrupo.reduce((s, l) => s + (l.situacao === 'pago' ? l.item.realizado : l.item.planejado), 0);
                return (
                  <section key={g.id} className={`cartao grupo-lista grupo-lista--${g.id}`} aria-label={g.titulo(kind)}>
                    <header className="grupo-lista__topo">
                      <h2>
                        {g.titulo(kind)} <span className="contagem">{doGrupo.length}</span>
                      </h2>
                      <Money value={soma} />
                    </header>
                    <Lista linhas={doGrupo} />
                  </section>
                );
              })
            : (
                <section className="cartao grupo-lista">
                  <Lista linhas={linhas} />
                </section>
              )}
          <footer className="totais" aria-label="Totais">
            <span>
              {plural(linhas.length, 'lançamento', 'lançamentos')}
              {filtrando ? ' (filtrados)' : ''}
            </span>
            <span>
              Total <Money value={total} />
            </span>
            <span>
              {kind === 'despesa' ? 'Pago' : 'Recebido'} <Money value={feito} />
            </span>
            <span>
              Falta <Money value={Math.max(0, total - feito)} />
            </span>
          </footer>
        </>
      )}

      {limpar && (
        <Confirm title={`Limpar ${monthName(key)}?`} confirmLabel="Limpar mês" danger onConfirm={actions.limparMes} onClose={() => setLimpar(false)}>
          <p>
            Apaga todas as despesas, rendas, investimentos e o saldo inicial de {monthName(key)}. Os outros meses não mudam. Você poderá desfazer logo em seguida.
          </p>
        </Confirm>
      )}
    </div>
  );
}
