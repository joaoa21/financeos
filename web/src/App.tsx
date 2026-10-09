import { useCallback, useMemo, useState } from 'react';
import { AuthProvider, useAuth } from '@central-auth/sdk-react';
import { type Token, UnauthorizedError } from './api.ts';
import { useCdi } from './cdi.ts';
import { Entrada, RedefinirSenha, VerificarEmail } from './components/Entrada.tsx';
import { LogoMark } from './components/Logo.tsx';
import { Shell } from './components/Shell.tsx';
import { ToastProvider, useToast } from './components/Toast.tsx';
import { DataProvider } from './data.tsx';
import { PrefsProvider } from './prefs.tsx';

// Endereço de login do FinanceOS no Authik (ex.: https://auth.financeos.com.br). Não é segredo.
const AUTH_URL = import.meta.env.VITE_AUTH_URL as string | undefined;

/** Validade do token, lida do próprio token (só para saber quando pedir outro). */
function expiresAt(token: string): number {
  try {
    const payload = token.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/');
    return Number(JSON.parse(atob(payload)).exp) * 1000 || 0;
  } catch {
    return 0;
  }
}

function Carregando({ texto }: { texto: string }) {
  return (
    <main className="carregando" aria-busy="true">
      <LogoMark size={44} />
      <span className="carregando__barra" aria-hidden="true" />
      <p>{texto}</p>
    </main>
  );
}

function Painel() {
  const auth = useAuth();
  const toast = useToast();
  const cdi = useCdi();
  const [path, setPath] = useState(location.pathname);
  const userId = auth.user?.id;

  // Token do login só na memória: um por conta, reaproveitado até 1 minuto antes de vencer.
  const token = useMemo<Token>(() => {
    let cached: { value: string; until: number } | null = null;
    let pending: Promise<string> | null = null;
    return () => {
      if (cached && cached.until > Date.now()) return Promise.resolve(cached.value);
      pending ??= auth
        .getToken()
        .then((result) => {
          if (!result.ok) throw new UnauthorizedError();
          cached = { value: result.data, until: expiresAt(result.data) - 60_000 };
          return result.data;
        })
        .finally(() => {
          pending = null;
        });
      return pending;
    };
    // Conta nova (entrou outra pessoa) = token novo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const logout = useCallback(() => {
    void auth.logout();
  }, [auth]);

  const onUnauthorized = useCallback(() => {
    toast('Sua sessão terminou. Entre de novo para continuar.', { tipo: 'info' });
    void auth.refresh();
  }, [auth, toast]);

  const onConflict = useCallback((conflitos: number) => {
    toast(
      conflitos === 1
        ? 'Uma alteração também foi feita em outro aparelho e a versão de lá foi mantida. Confira o último item que você mexeu.'
        : `${conflitos} alterações também foram feitas em outro aparelho e as versões de lá foram mantidas. Confira os últimos itens que você mexeu.`,
      { tipo: 'info', duracao: 10000 },
    );
  }, [toast]);

  const inicio = () => {
    history.replaceState(null, '', '/');
    setPath('/');
  };
  if (path === '/verificar-email') return <VerificarEmail onPronto={inicio} />;
  if (path === '/redefinir-senha') return <RedefinirSenha onPronto={inicio} />;
  if (auth.status === 'loading') return <Carregando texto="Conferindo sua sessão…" />;
  if (auth.status === 'anonymous' || !auth.user) return <Entrada inicial={path === '/criar-conta' ? 'criar' : 'entrar'} />;

  const user = auth.user;
  return (
    <DataProvider key={user.id} token={token} onUnauthorized={onUnauthorized} onConflict={onConflict}>
      {(load, retry) =>
        load === 'carregando' ? (
          <Carregando texto="Carregando seus dados…" />
        ) : load === 'erro' ? (
          <main className="carregando">
            <LogoMark size={44} />
            <h1>Não conseguimos carregar seus dados</h1>
            <p>Confira sua internet. Nada foi perdido: seus dados estão guardados no servidor.</p>
            <button type="button" className="btn" onClick={retry}>
              Tentar de novo
            </button>
          </main>
        ) : (
          <Shell user={{ name: user.name, email: user.email }} onLogout={logout} cdi={cdi} />
        )
      }
    </DataProvider>
  );
}

export default function App() {
  if (!AUTH_URL)
    return (
      <main className="carregando">
        <p>Falta VITE_AUTH_URL (endereço de login do FinanceOS) na configuração do site.</p>
      </main>
    );
  return (
    <PrefsProvider>
      <ToastProvider>
        <AuthProvider authURL={AUTH_URL}>
          <Painel />
        </AuthProvider>
      </ToastProvider>
    </PrefsProvider>
  );
}
