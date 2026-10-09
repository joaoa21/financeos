import { useCallback, useEffect, useState } from 'react';
import { currentKey, isMonthKey } from './model/dates.ts';

// Endereços do app: a página fica no caminho e o mês em ?mes=AAAA-MM (só quando não é o atual).
// Assim recarregar ou compartilhar o link mantém onde a pessoa estava.

export type Page = 'visao' | 'lancamentos' | 'investimentos' | 'relatorios' | 'configuracoes';

const PATHS: Record<Page, string> = {
  visao: '/',
  lancamentos: '/lancamentos',
  investimentos: '/investimentos',
  relatorios: '/relatorios',
  configuracoes: '/configuracoes',
};

function read(): { page: Page; mes: string } {
  const page = (Object.keys(PATHS) as Page[]).find((p) => PATHS[p] === location.pathname) ?? 'visao';
  const mes = new URLSearchParams(location.search).get('mes');
  return { page, mes: isMonthKey(mes) ? mes : currentKey() };
}

function write(page: Page, mes: string, replace = false) {
  const query = mes === currentKey() ? '' : `?mes=${mes}`;
  const url = PATHS[page] + query;
  if (url === location.pathname + location.search) return;
  if (replace) history.replaceState(null, '', url);
  else history.pushState(null, '', url);
}

export function useRoute() {
  const [route, setRoute] = useState(read);

  useEffect(() => {
    // Caminho desconhecido (ex.: /entrar com a conta aberta): vai para a visão geral.
    write(route.page, route.mes, true);
    const onPop = () => setRoute(read());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const go = useCallback((page: Page) => {
    setRoute((r) => {
      write(page, r.mes);
      return { ...r, page };
    });
    window.scrollTo({ top: 0 });
  }, []);

  const setMes = useCallback((mes: string) => {
    setRoute((r) => {
      write(r.page, mes, true);
      return { ...r, mes };
    });
  }, []);

  return { ...route, go, setMes };
}
