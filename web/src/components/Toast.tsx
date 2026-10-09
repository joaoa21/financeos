import { createContext, type ReactNode, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { IconAlert, IconCheck, IconInfo, IconX } from './Icons';

// Avisos rápidos no canto da tela, com um botão de ação opcional (ex.: "Desfazer").

type Tipo = 'ok' | 'erro' | 'info';
interface Toast {
  id: number;
  texto: string;
  tipo: Tipo;
  acao?: { label: string; onClick: () => void };
}

type Show = (texto: string, opcoes?: { tipo?: Tipo; acao?: Toast['acao']; duracao?: number }) => void;

const ToastContext = createContext<Show>(() => {});

export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const show = useCallback<Show>(
    (texto, opcoes = {}) => {
      const id = nextId.current++;
      setToasts((list) => [...list.slice(-2), { id, texto, tipo: opcoes.tipo ?? 'ok', acao: opcoes.acao }]);
      setTimeout(() => dismiss(id), opcoes.duracao ?? (opcoes.acao ? 7000 : 3500));
    },
    [dismiss],
  );

  const value = useMemo(() => show, [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const Icone = toast.tipo === 'erro' ? IconAlert : toast.tipo === 'info' ? IconInfo : IconCheck;
  return (
    <div className={`toast toast--${toast.tipo}`}>
      <span className="toast__icone">
        <Icone size={16} />
      </span>
      <span className="toast__texto">{toast.texto}</span>
      {toast.acao && (
        <button
          type="button"
          className="toast__acao"
          onClick={() => {
            toast.acao!.onClick();
            onDismiss();
          }}
        >
          {toast.acao.label}
        </button>
      )}
      <button type="button" className="toast__fechar" aria-label="Fechar aviso" onClick={onDismiss}>
        <IconX size={14} />
      </button>
    </div>
  );
}
