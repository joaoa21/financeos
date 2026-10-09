import { type ReactNode, useEffect, useMemo, useState } from 'react';
import type { Cdi } from '../cdi.ts';
import { type SyncStatus, useData } from '../data.tsx';
import { currentKey, monthName, shiftKey } from '../model/dates.ts';
import { usePrefs } from '../prefs.tsx';
import { type Page, useRoute } from '../route.ts';
import { type Kind, type Ui, UiContext } from '../ui.tsx';
import { Configuracoes } from '../pages/Configuracoes.tsx';
import { Investimentos } from '../pages/Investimentos.tsx';
import { Lancamentos } from '../pages/Lancamentos.tsx';
import { Relatorios } from '../pages/Relatorios.tsx';
import { Visao } from '../pages/Visao.tsx';
import {
  IconChart,
  IconChevronLeft,
  IconChevronRight,
  IconCloud,
  IconCloudOff,
  IconEye,
  IconEyeOff,
  IconHome,
  IconList,
  IconLogout,
  IconPlus,
  IconSettings,
  IconTrend,
} from './Icons.tsx';
import { AporteModal, InvestimentoModal } from './InvestimentoModals.tsx';
import { LancamentoModal } from './LancamentoModal.tsx';
import { Logo, LogoMark } from './Logo.tsx';
import { Menu } from './Menu.tsx';
import { PrepararModal, SaldoModal } from './PrepararModal.tsx';

type Janela =
  | { tipo: 'lancamento'; kind: Kind; id?: string }
  | { tipo: 'preparar'; destino: string; fechar: boolean }
  | { tipo: 'saldo' }
  | { tipo: 'investimento'; id?: string }
  | { tipo: 'aporte'; invId: string };

const NAV: { page: Page; label: string; curto: string; icon: (p: { size?: number }) => ReactNode }[] = [
  { page: 'visao', label: 'Visão geral', curto: 'Início', icon: IconHome },
  { page: 'lancamentos', label: 'Lançamentos', curto: 'Lançamentos', icon: IconList },
  { page: 'investimentos', label: 'Investimentos', curto: 'Investir', icon: IconTrend },
  { page: 'relatorios', label: 'Relatórios', curto: 'Relatórios', icon: IconChart },
];

export function Shell(props: {
  user: { name: string; email: string };
  onLogout: () => void;
  cdi: Cdi;
}) {
  const { page, mes, go, setMes } = useRoute();
  const [janela, setJanela] = useState<Janela | null>(null);
  const fechar = () => setJanela(null);

  const ui = useMemo<Ui>(
    () => ({
      mes,
      setMes,
      page,
      go,
      cdi: props.cdi,
      novoLancamento: (kind = 'despesa') => setJanela({ tipo: 'lancamento', kind }),
      editarLancamento: (kind, id) => setJanela({ tipo: 'lancamento', kind, id }),
      prepararMes: (destino, fecharMes = false) => setJanela({ tipo: 'preparar', destino, fechar: fecharMes }),
      editarSaldo: () => setJanela({ tipo: 'saldo' }),
      novoInvestimento: () => setJanela({ tipo: 'investimento' }),
      editarInvestimento: (id) => setJanela({ tipo: 'investimento', id }),
      novoAporte: (invId) => setJanela({ tipo: 'aporte', invId }),
    }),
    [mes, setMes, page, go, props.cdi],
  );

  // Atalhos: N = novo lançamento; ← → = mês anterior/seguinte (fora de campos e janelas).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (janela || event.ctrlKey || event.metaKey || event.altKey) return;
      const alvo = event.target as HTMLElement;
      if (alvo.closest('input, textarea, select, [contenteditable], [role="menu"], .modal')) return;
      if (event.key === 'ArrowLeft') setMes(shiftKey(mes, -1));
      else if (event.key === 'ArrowRight') setMes(shiftKey(mes, 1));
      else if (event.key.toLowerCase() === 'n' && page !== 'configuracoes') {
        event.preventDefault();
        setJanela({ tipo: 'lancamento', kind: 'despesa' });
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [janela, mes, page, setMes]);

  const titulo = NAV.find((n) => n.page === page)?.label ?? 'Configurações';
  useEffect(() => {
    document.title = `${titulo} · ${monthName(mes)} · FinanceOS`;
  }, [titulo, mes]);

  return (
    <UiContext.Provider value={ui}>
      <div className="app">
        <aside className="lateral" aria-label="Menu principal">
          <div className="lateral__marca">
            <Logo height={24} />
          </div>
          <button type="button" className="btn btn--bloco lateral__novo" onClick={() => ui.novoLancamento()}>
            <IconPlus size={18} /> Novo lançamento
            <kbd className="atalho" aria-hidden="true">N</kbd>
          </button>
          <nav className="lateral__nav">
            {[...NAV, { page: 'configuracoes' as Page, label: 'Configurações', curto: 'Ajustes', icon: IconSettings }].map((item) => (
              <a
                key={item.page}
                href={item.page === 'visao' ? '/' : `/${item.page}`}
                className="lateral__link"
                aria-current={page === item.page ? 'page' : undefined}
                onClick={(event) => {
                  if (event.metaKey || event.ctrlKey || event.shiftKey) return;
                  event.preventDefault();
                  go(item.page);
                }}
              >
                <item.icon size={18} />
                {item.label}
              </a>
            ))}
          </nav>
          <div className="lateral__rodape">
            <Usuario user={props.user} onLogout={props.onLogout} onConfig={() => go('configuracoes')} />
          </div>
        </aside>

        <div className="principal">
          <header className="topo">
            <span className="topo__marca-movel">
              <LogoMark size={30} />
            </span>
            <h1 className="topo__titulo">{titulo}</h1>
            {page !== 'configuracoes' && <SeletorMes mes={mes} setMes={setMes} />}
            <div className="topo__acoes">
              <SyncBadge />
              <OcultarValores />
            </div>
          </header>

          <main className="conteudo" id="conteudo">
            {page === 'visao' && <Visao />}
            {page === 'lancamentos' && <Lancamentos />}
            {page === 'investimentos' && <Investimentos />}
            {page === 'relatorios' && <Relatorios />}
            {page === 'configuracoes' && <Configuracoes user={props.user} onLogout={props.onLogout} />}
          </main>
        </div>

        <nav className="abas" aria-label="Menu principal">
          {NAV.slice(0, 2).map((item) => (
            <AbaLink key={item.page} item={item} ativo={page === item.page} go={go} />
          ))}
          <button type="button" className="abas__novo" aria-label="Novo lançamento" onClick={() => ui.novoLancamento()}>
            <IconPlus size={24} />
          </button>
          {NAV.slice(2).map((item) => (
            <AbaLink key={item.page} item={item} ativo={page === item.page} go={go} />
          ))}
        </nav>
      </div>

      {janela?.tipo === 'lancamento' && <LancamentoModal key={janela.id ?? 'novo'} mesKey={mes} kind={janela.kind} id={janela.id} onClose={fechar} />}
      {janela?.tipo === 'preparar' && <PrepararModal destino={janela.destino} fechar={janela.fechar} onClose={fechar} />}
      {janela?.tipo === 'saldo' && <SaldoModal mesKey={mes} onClose={fechar} />}
      {janela?.tipo === 'investimento' && <InvestimentoModal mesKey={mes} id={janela.id} onClose={fechar} />}
      {janela?.tipo === 'aporte' && <AporteModal mesKey={mes} invId={janela.invId} onClose={fechar} />}
    </UiContext.Provider>
  );
}

function AbaLink({ item, ativo, go }: { item: (typeof NAV)[number]; ativo: boolean; go: (page: Page) => void }) {
  return (
    <a
      href={item.page === 'visao' ? '/' : `/${item.page}`}
      className="abas__link"
      aria-current={ativo ? 'page' : undefined}
      onClick={(event) => {
        event.preventDefault();
        go(item.page);
      }}
    >
      <item.icon size={22} />
      <span>{item.curto}</span>
    </a>
  );
}

function SeletorMes({ mes, setMes }: { mes: string; setMes: (mes: string) => void }) {
  const atual = currentKey();
  const { estado } = useData();
  return (
    <div className="seletor-mes">
      <button type="button" className="botao-icone" onClick={() => setMes(shiftKey(mes, -1))} aria-label={`Mês anterior (${monthName(shiftKey(mes, -1))})`} title="Mês anterior (←)">
        <IconChevronLeft size={18} />
      </button>
      <span className="seletor-mes__nome" aria-live="polite">
        {monthName(mes)}
        {estado[mes]?.fechado && <span className="selo selo--neutro">Fechado</span>}
      </span>
      <button type="button" className="botao-icone" onClick={() => setMes(shiftKey(mes, 1))} aria-label={`Próximo mês (${monthName(shiftKey(mes, 1))})`} title="Próximo mês (→)">
        <IconChevronRight size={18} />
      </button>
      {mes !== atual && (
        <button type="button" className="btn btn--pequeno btn--secundario" onClick={() => setMes(atual)}>
          Hoje
        </button>
      )}
    </div>
  );
}

const SYNC_TEXTO: Record<SyncStatus, string> = {
  salvo: 'Tudo salvo',
  salvando: 'Salvando…',
  offline: 'Sem conexão — tentando de novo',
};

function SyncBadge() {
  const { sync } = useData();
  return (
    <span className={`sync sync--${sync}`} role="status" title={SYNC_TEXTO[sync]}>
      {sync === 'offline' ? <IconCloudOff size={16} /> : <IconCloud size={16} />}
      <span className="sync__texto">{SYNC_TEXTO[sync]}</span>
    </span>
  );
}

function OcultarValores() {
  const { ocultar, setOcultar } = usePrefs();
  return (
    <button
      type="button"
      className="botao-icone"
      onClick={() => setOcultar(!ocultar)}
      aria-pressed={ocultar}
      aria-label={ocultar ? 'Mostrar valores' : 'Ocultar valores'}
      title={ocultar ? 'Mostrar valores' : 'Ocultar valores (para usar em público)'}
    >
      {ocultar ? <IconEyeOff size={18} /> : <IconEye size={18} />}
    </button>
  );
}

function Usuario({ user, onLogout, onConfig }: { user: { name: string; email: string }; onLogout: () => void; onConfig: () => void }) {
  const inicial = (user.name || user.email || '?').trim().charAt(0).toUpperCase();
  return (
    <Menu
      ariaLabel="Conta"
      align="left"
      className="usuario"
      trigger={() => (
        <>
          <span className="avatar" aria-hidden="true">{inicial}</span>
          <span className="usuario__texto">
            <span className="usuario__nome">{user.name || 'Minha conta'}</span>
            <span className="usuario__email">{user.email}</span>
          </span>
        </>
      )}
      items={[
        { label: 'Configurações', icon: <IconSettings size={16} />, onClick: onConfig },
        'separador',
        { label: 'Sair', icon: <IconLogout size={16} />, onClick: onLogout },
      ]}
    />
  );
}
