import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { brl } from './format.ts';
import { storage } from './storage.ts';

// Preferências deste navegador: tema e "ocultar valores" (para abrir o app em público).

export type Tema = 'claro' | 'escuro' | 'sistema';

interface Prefs {
  tema: Tema;
  setTema: (tema: Tema) => void;
  ocultar: boolean;
  setOcultar: (ocultar: boolean) => void;
}

const PrefsContext = createContext<Prefs | null>(null);

export function usePrefs(): Prefs {
  const value = useContext(PrefsContext);
  if (!value) throw new Error('usePrefs precisa estar dentro de <PrefsProvider>.');
  return value;
}

function initialTema(): Tema {
  const saved = storage.get('fos_tema');
  return saved === 'claro' || saved === 'escuro' ? saved : 'sistema';
}

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [tema, setTemaState] = useState<Tema>(initialTema);
  const [ocultar, setOcultarState] = useState(() => storage.get('fos_ocultar') === '1');
  const [escuroSistema, setEscuroSistema] = useState(() => matchMedia('(prefers-color-scheme: dark)').matches);

  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setEscuroSistema(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const escuro = tema === 'escuro' || (tema === 'sistema' && escuroSistema);
  useEffect(() => {
    document.documentElement.dataset.theme = escuro ? 'dark' : 'light';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', escuro ? '#121110' : '#F7F5F2');
  }, [escuro]);

  const value = useMemo<Prefs>(
    () => ({
      tema,
      setTema: (next) => {
        setTemaState(next);
        if (next === 'sistema') storage.remove('fos_tema');
        else storage.set('fos_tema', next);
      },
      ocultar,
      setOcultar: (next) => {
        setOcultarState(next);
        storage.set('fos_ocultar', next ? '1' : '0');
      },
    }),
    [tema, ocultar],
  );

  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

/** Valor em reais (respeita "ocultar valores"). `sinal` mostra + nos positivos. */
export function Money({ value, sinal, className }: { value: number; sinal?: boolean; className?: string }) {
  const { ocultar } = usePrefs();
  if (ocultar) return <span className={`valor valor--oculto ${className ?? ''}`} aria-label="valor oculto">R$ •••••</span>;
  const texto = brl(value);
  return <span className={`valor ${className ?? ''}`}>{sinal && value > 0.004 ? `+${texto}` : texto}</span>;
}
