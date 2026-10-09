import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ConflictError, deleteState, loadState, OfflineError, saveState, type Token, UnauthorizedError } from './api.ts';
import { merge3 } from './model/merge.ts';
import { isEmptyMonth, migrate } from './model/migrate.ts';
import type { Estado } from './model/types.ts';
import { forgetLegacyData, legacyData } from './storage.ts';

// Os dados financeiros da conta: carregados da API ao entrar e salvos sozinhos
// pouco depois de cada mudança. Cada salvamento diz em qual versão se baseou;
// se outra aba ou aparelho salvou antes, nada é sobrescrito: as duas versões são
// juntadas lançamento por lançamento (model/merge.ts) e salvas de novo.

export type SyncStatus = 'salvo' | 'salvando' | 'offline';

interface DataContextValue {
  estado: Estado;
  sync: SyncStatus;
  /** Altera os dados. `recipe` recebe uma cópia e pode mudá-la à vontade. Devolve o estado anterior (para desfazer). */
  update: (recipe: (draft: Estado) => void) => Estado;
  /** Troca tudo de uma vez (desfazer, importar). */
  replace: (estado: Estado) => void;
  /** Apaga todos os dados da conta no servidor. */
  wipe: () => Promise<void>;
  /** Dados da versão antiga guardados neste navegador (só quando a conta ainda está vazia). */
  legado: { meses: number } | null;
  importarLegado: () => void;
  descartarLegado: () => void;
}

const DataContext = createContext<DataContextValue | null>(null);

export function useData(): DataContextValue {
  const value = useContext(DataContext);
  if (!value) throw new Error('useData precisa estar dentro de <DataProvider>.');
  return value;
}

const RETRY_MS = [3_000, 10_000, 30_000, 60_000];

function prune(estado: Estado): Estado {
  for (const key of Object.keys(estado)) if (isEmptyMonth(estado[key])) delete estado[key];
  return estado;
}

export function DataProvider(props: {
  token: Token;
  onUnauthorized: () => void;
  /** Outra aba ou aparelho mudou exatamente o mesmo que esta aba (vale a versão de lá). */
  onConflict: (conflitos: number) => void;
  children: (loading: 'carregando' | 'erro' | 'pronto', retry: () => void) => ReactNode;
}) {
  const { token, onUnauthorized, onConflict } = props;
  const [load, setLoad] = useState<'carregando' | 'erro' | 'pronto'>('carregando');
  const [estado, setEstado] = useState<Estado>({});
  const [sync, setSync] = useState<SyncStatus>('salvo');
  const [legado, setLegado] = useState<{ meses: number } | null>(null);
  const [attempt, setAttempt] = useState(0);

  const current = useRef<Estado>({});
  /** Última versão que esta aba e o servidor têm em comum (base da mescla). */
  const base = useRef<Estado>({});
  const version = useRef(0);
  const dirty = useRef(false);
  const saving = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const failures = useRef(0);
  const lastLoad = useRef(0);
  const handlers = useRef({ onUnauthorized, onConflict });
  handlers.current = { onUnauthorized, onConflict };

  const apply = useCallback((next: Estado) => {
    current.current = next;
    setEstado(next);
  }, []);

  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    if (saving.current || !dirty.current) return;
    saving.current = true;
    setSync('salvando');
    const snapshot = current.current;
    try {
      version.current = await saveState(token, snapshot, version.current);
      base.current = snapshot;
      failures.current = 0;
      if (current.current === snapshot) {
        dirty.current = false;
        setSync('salvo');
      }
    } catch (err) {
      if (err instanceof ConflictError) {
        const remote = migrate(err.remote.data);
        const { estado: merged, conflicts } = merge3(base.current, current.current, remote);
        version.current = err.remote.version;
        base.current = remote;
        apply(merged);
        if (JSON.stringify(merged) === JSON.stringify(remote)) {
          dirty.current = false;
          setSync('salvo');
        } else {
          timer.current = setTimeout(() => void flush(), 50);
        }
        if (conflicts) handlers.current.onConflict(conflicts);
      } else if (err instanceof UnauthorizedError) {
        setSync('offline');
        handlers.current.onUnauthorized();
      } else {
        // Sem conexão ou erro do servidor: tenta de novo, cada vez esperando mais.
        setSync('offline');
        const wait = RETRY_MS[Math.min(failures.current, RETRY_MS.length - 1)]!;
        failures.current++;
        timer.current = setTimeout(() => void flush(), wait);
        if (!(err instanceof OfflineError)) console.error(err);
      }
    } finally {
      saving.current = false;
    }
    // Mudou algo enquanto salvava: salva de novo.
    if (dirty.current && current.current !== snapshot && failures.current === 0) timer.current = setTimeout(() => void flush(), 300);
  }, [token, apply]);

  const schedule = useCallback(() => {
    dirty.current = true;
    setSync('salvando');
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), 700);
  }, [flush]);

  // Carrega ao entrar.
  useEffect(() => {
    let alive = true;
    setLoad('carregando');
    loadState(token)
      .then((snap) => {
        if (!alive) return;
        version.current = snap.version;
        lastLoad.current = Date.now();
        const data = migrate(snap.data);
        base.current = data;
        apply(data);
        const antigo = Object.keys(data).length === 0 ? legacyData() : null;
        setLegado(antigo ? { meses: Object.keys(migrate(antigo)).length } : null);
        setLoad('pronto');
      })
      .catch((err) => {
        if (!alive) return;
        if (err instanceof UnauthorizedError) handlers.current.onUnauthorized();
        else setLoad('erro');
      });
    return () => {
      alive = false;
    };
  }, [token, apply, attempt]);

  // Ao voltar para a aba: busca alterações feitas em outro aparelho.
  useEffect(() => {
    if (load !== 'pronto') return;
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      if (dirty.current || saving.current) {
        void flush();
        return;
      }
      if (Date.now() - lastLoad.current < 20_000) return;
      lastLoad.current = Date.now();
      loadState(token)
        .then((snap) => {
          if (dirty.current || saving.current || snap.version === version.current) return;
          version.current = snap.version;
          const data = migrate(snap.data);
          base.current = data;
          apply(data);
        })
        .catch(() => {});
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onVisible);
    };
  }, [load, token, flush, apply]);

  // Fechar a aba com alteração ainda não salva: o navegador pergunta antes.
  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty.current && !saving.current) return;
      void flush();
      event.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [flush]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const update = useCallback(
    (recipe: (draft: Estado) => void) => {
      const previous = current.current;
      const draft = structuredClone(previous);
      recipe(draft);
      apply(prune(draft));
      schedule();
      return previous;
    },
    [apply, schedule],
  );

  const replace = useCallback(
    (next: Estado) => {
      apply(prune(structuredClone(next)));
      schedule();
    },
    [apply, schedule],
  );

  const wipe = useCallback(async () => {
    clearTimeout(timer.current);
    await deleteState(token);
    version.current = 0;
    dirty.current = false;
    base.current = {};
    apply({});
    setSync('salvo');
  }, [token, apply]);

  const importarLegado = useCallback(() => {
    const antigo = legacyData();
    if (antigo) replace(migrate(antigo));
    forgetLegacyData();
    setLegado(null);
  }, [replace]);

  const descartarLegado = useCallback(() => {
    forgetLegacyData();
    setLegado(null);
  }, []);

  const value = useMemo(
    () => ({ estado, sync, update, replace, wipe, legado, importarLegado, descartarLegado }),
    [estado, sync, update, replace, wipe, legado, importarLegado, descartarLegado],
  );

  return <DataContext.Provider value={value}>{props.children(load, () => setAttempt((n) => n + 1))}</DataContext.Provider>;
}
