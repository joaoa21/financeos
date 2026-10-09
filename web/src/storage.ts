// Preferências guardadas no navegador (tema, ocultar valores, cotação do CDI).
// Os dados financeiros NÃO ficam aqui: vivem só na API, ligados à conta.
// O navegador pode bloquear o armazenamento (ex.: janela anônima): por isso tudo
// fica dentro de try/catch e o site funciona mesmo sem ele.

export const storage = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      localStorage.setItem(key, value);
    } catch {
      // sem armazenamento: vale só até fechar a aba
    }
  },
  remove(key: string) {
    try {
      localStorage.removeItem(key);
    } catch {
      // idem
    }
  },
};

/** Chaves em que a versão antiga guardava todos os dados financeiros no navegador. */
export const LEGACY_KEYS = ['fos_v3', 'fos_v2'];

export function legacyData(): unknown | null {
  for (const key of LEGACY_KEYS) {
    const raw = storage.get(key);
    if (!raw) continue;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && Object.keys(parsed).length) return parsed;
    } catch {
      // arquivo corrompido: ignora
    }
  }
  return null;
}

export function forgetLegacyData() {
  for (const key of [...LEGACY_KEYS, 'fos_cdi']) storage.remove(key);
}
